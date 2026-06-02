package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

// SyncHandler powers the offline-first synchronization engine (cloud side).
type SyncHandler struct {
	DB  *pgxpool.Pool
	HLC *HLC
}

// NewSyncHandler builds a handler with a cloud-node HLC.
func NewSyncHandler(db *pgxpool.Pool) *SyncHandler {
	return &SyncHandler{DB: db, HLC: NewHLC("cloud")}
}

// Entities whose conflicts must never auto-merge — money & legal records.
var humanReviewEntities = map[string]bool{
	"payroll_run_lines":   true,
	"payroll_records":     true,
	"deposits":            true, // cash reconciliation
	"employee_compensation": true,
}

// stationID resolves the station identifier from auth context: branch acts as
// the station; falls back to empty (NULL) when unavailable.
func stationID(c *gin.Context) string {
	if b := c.GetString("branch_id"); b != "" {
		return b
	}
	return ""
}

func nullableUUID(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// ─── POST /sync/handshake ───────────────────────────────────────────────────
//
// A station registers / re-registers and learns where to resume.
func (h *SyncHandler) Handshake(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body model.HandshakeRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.StationID == "" {
		body.StationID = stationID(c)
	}
	if body.StationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "station_id required (no branch in context)"})
		return
	}
	// Advance cloud clock past the edge's clock (causality).
	cloudHLC := h.HLC.Now()
	if body.EdgeHLC != "" {
		cloudHLC = h.HLC.Update(body.EdgeHLC)
	}

	var uploadSeq int64
	var downloadCursor string
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO sync_cursors (station_id, business_id, last_handshake_at, schema_version)
		VALUES ($1::uuid, $2::uuid, NOW(), $3)
		ON CONFLICT (station_id) DO UPDATE
		  SET last_handshake_at = NOW(),
		      schema_version = EXCLUDED.schema_version,
		      business_id = EXCLUDED.business_id
		RETURNING upload_seq, download_cursor`,
		body.StationID, nullableUUID(businessID), maxInt(body.SchemaVersion, 1),
	).Scan(&uploadSeq, &downloadCursor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.HandshakeResponse{
		StationID:      body.StationID,
		CloudHLC:       cloudHLC,
		UploadSeq:      uploadSeq,
		DownloadCursor: downloadCursor,
		SchemaVersion:  maxInt(body.SchemaVersion, 1),
		ServerTime:     time.Now().UTC().Format(time.RFC3339),
	})
}

// ─── POST /sync/upload ──────────────────────────────────────────────────────
//
// Idempotent batch ingest. Each item is conflict-checked against the generic
// sync_entity_state store using HLC-based last-write-wins, with money/legal
// entities flagged for human review on overlap.
func (h *SyncHandler) Upload(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")

	var env model.ChangeEnvelope
	if err := c.ShouldBindJSON(&env); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if env.StationID == "" {
		env.StationID = stationID(c)
	}

	// Idempotency: replay the stored result if this key was already processed.
	idemKey := c.GetHeader("Idempotency-Key")
	if idemKey == "" {
		idemKey = deriveIdemKey(env)
	}
	var stored []byte
	if err := h.DB.QueryRow(ctx,
		`SELECT result FROM sync_idempotency WHERE idempotency_key = $1`, idemKey,
	).Scan(&stored); err == nil {
		var prev model.UploadResult
		if json.Unmarshal(stored, &prev) == nil {
			c.JSON(http.StatusOK, prev)
			return
		}
	}

	res := model.UploadResult{Results: make([]model.ItemResult, 0, len(env.Items))}

	for _, item := range env.Items {
		ir := h.applyItem(ctx, businessID, env.StationID, item)
		res.Results = append(res.Results, ir)
		switch ir.Status {
		case "accepted":
			res.Accepted++
		case "conflict":
			res.Conflicts++
		}
		if item.Seq > res.MaxSeq {
			res.MaxSeq = item.Seq
		}
	}

	res.CloudCursor = h.HLC.Now()

	// Advance the station's upload cursor + persist idempotency result.
	if env.StationID != "" {
		_, _ = h.DB.Exec(ctx, `
			INSERT INTO sync_cursors (station_id, business_id, upload_seq, last_sync_at)
			VALUES ($1::uuid, $2::uuid, $3, NOW())
			ON CONFLICT (station_id) DO UPDATE
			  SET upload_seq = GREATEST(sync_cursors.upload_seq, EXCLUDED.upload_seq),
			      last_sync_at = NOW()`,
			env.StationID, nullableUUID(businessID), res.MaxSeq)
	}
	resJSON, _ := json.Marshal(res)
	_, _ = h.DB.Exec(ctx,
		`INSERT INTO sync_idempotency (idempotency_key, station_id, result)
		 VALUES ($1, $2::uuid, $3) ON CONFLICT (idempotency_key) DO NOTHING`,
		idemKey, nullableUUID(env.StationID), resJSON)

	c.JSON(http.StatusOK, res)
}

// applyItem performs HLC-based conflict resolution for a single change.
func (h *SyncHandler) applyItem(ctx context.Context, businessID, stationID string, item model.ChangeItem) model.ItemResult {
	h.HLC.Update(item.HLC) // keep cloud clock ahead of received clocks

	var existVersion int64
	var existHLC string
	var existDeleted bool
	err := h.DB.QueryRow(ctx,
		`SELECT version, hlc, deleted FROM sync_entity_state WHERE entity=$1 AND entity_id=$2::uuid`,
		item.Entity, item.EntityID,
	).Scan(&existVersion, &existHLC, &existDeleted)

	payloadJSON, _ := json.Marshal(item.Payload)
	deleted := item.Op == "delete"

	// First time we've seen this entity — accept unconditionally.
	if err == pgx.ErrNoRows {
		newVersion := item.Version
		if newVersion == 0 {
			newVersion = 1
		}
		h.upsertState(ctx, businessID, stationID, item, payloadJSON, newVersion, deleted)
		return model.ItemResult{EntityID: item.EntityID, Status: "accepted", ServerVersion: newVersion}
	}
	if err != nil {
		return model.ItemResult{EntityID: item.EntityID, Status: "ignored"}
	}

	// Stale write — incoming HLC is older than what we already have.
	if item.HLC != "" && existHLC != "" && CompareHLC(item.HLC, existHLC) <= 0 {
		return model.ItemResult{EntityID: item.EntityID, Status: "ignored", ServerVersion: existVersion}
	}

	// Concurrent edit detection: the edit was based on a version that is no
	// longer current → overlap conflict.
	overlap := item.BaseVersion != 0 && item.BaseVersion != existVersion
	resolution := "lww"
	if overlap {
		needsReview := humanReviewEntities[item.Entity]
		if needsReview {
			resolution = "needs_review"
		}
		h.logConflict(ctx, businessID, item, existVersion, payloadJSON, needsReview)
		if needsReview {
			// Do NOT auto-apply money/legal conflicts — leave current value,
			// surface for a human.
			return model.ItemResult{EntityID: item.EntityID, Status: "conflict",
				ServerVersion: existVersion, Resolution: resolution}
		}
	}

	// LWW: incoming is newer by HLC → apply.
	newVersion := existVersion + 1
	h.upsertState(ctx, businessID, stationID, item, payloadJSON, newVersion, deleted)
	status := "accepted"
	if overlap {
		status = "conflict" // applied, but flagged as a (merged/lww) conflict
	}
	return model.ItemResult{EntityID: item.EntityID, Status: status, ServerVersion: newVersion, Resolution: resolution}
}

func (h *SyncHandler) upsertState(ctx context.Context, businessID, stationID string, item model.ChangeItem, payloadJSON []byte, version int64, deleted bool) {
	_, _ = h.DB.Exec(ctx, `
		INSERT INTO sync_entity_state
		  (entity, entity_id, business_id, station_id, version, hlc, payload, deleted, row_seq, updated_at)
		VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, nextval('sync_state_seq'), NOW())
		ON CONFLICT (entity, entity_id) DO UPDATE
		  SET version=$5, hlc=$6, payload=$7, deleted=$8,
		      row_seq=nextval('sync_state_seq'), updated_at=NOW()`,
		item.Entity, item.EntityID, nullableUUID(businessID), nullableUUID(stationID),
		version, item.HLC, payloadJSON, deleted)
}

func (h *SyncHandler) logConflict(ctx context.Context, businessID string, item model.ChangeItem, cloudVersion int64, localPayload []byte, needsReview bool) {
	var cloudPayload []byte
	h.DB.QueryRow(ctx, `SELECT payload FROM sync_entity_state WHERE entity=$1 AND entity_id=$2::uuid`,
		item.Entity, item.EntityID).Scan(&cloudPayload)
	resolution := "lww"
	if needsReview {
		resolution = "needs_review"
	}
	_, _ = h.DB.Exec(ctx, `
		INSERT INTO conflict_log
		  (business_id, entity, entity_id, local_version, cloud_version,
		   local_payload, cloud_payload, resolution)
		VALUES ($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8)`,
		nullableUUID(businessID), item.Entity, item.EntityID,
		item.BaseVersion, cloudVersion, localPayload, cloudPayload, resolution)
}

// ─── GET /sync/download ───────────────────────────────────────────────────────
//
// Returns entity-state changes after the caller's cursor (row_seq). Used by an
// edge to pull cloud-authored reference data and cross-station updates.
func (h *SyncHandler) Download(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	since, _ := strconv.ParseInt(c.DefaultQuery("since", "0"), 10, 64)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "500"))
	if limit <= 0 || limit > 2000 {
		limit = 500
	}

	rows, err := h.DB.Query(ctx, `
		SELECT entity, entity_id::text, version, hlc, payload, deleted, row_seq
		FROM sync_entity_state
		WHERE business_id = $1::uuid AND row_seq > $2
		ORDER BY row_seq
		LIMIT $3`,
		nullableUUID(businessID), since, limit+1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	out := model.DownloadResult{Items: []model.ChangeItem{}}
	var lastSeq int64
	count := 0
	for rows.Next() {
		count++
		if count > limit {
			out.HasMore = true
			break
		}
		var it model.ChangeItem
		var payload []byte
		var deleted bool
		var rowSeq int64
		if err := rows.Scan(&it.Entity, &it.EntityID, &it.Version, &it.HLC, &payload, &deleted, &rowSeq); err != nil {
			continue
		}
		_ = json.Unmarshal(payload, &it.Payload)
		it.Op = "update"
		if deleted {
			it.Op = "delete"
		}
		it.Seq = rowSeq
		lastSeq = rowSeq
		out.Items = append(out.Items, it)
	}
	out.CloudCursor = strconv.FormatInt(lastSeq, 10)
	if lastSeq == 0 {
		out.CloudCursor = strconv.FormatInt(since, 10)
	}
	c.JSON(http.StatusOK, out)
}

// ─── GET /sync/status ─────────────────────────────────────────────────────────
func (h *SyncHandler) Status(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	sid := stationID(c)

	var st model.SyncStatus
	st.Online = true
	st.ServerTime = time.Now().UTC()

	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM change_log WHERE synced_at IS NULL`).Scan(&st.PendingChanges)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM event_store WHERE synced_at IS NULL AND business_id=$1::uuid`,
		nullableUUID(businessID)).Scan(&st.PendingEvents)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM sync_outbox WHERE status IN ('queued','failed')`).Scan(&st.OutboxQueued)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM sync_outbox WHERE status='dead'`).Scan(&st.OutboxDead)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM conflict_log WHERE resolution='needs_review' AND business_id=$1::uuid`,
		nullableUUID(businessID)).Scan(&st.OpenConflicts)

	if sid != "" {
		h.DB.QueryRow(ctx,
			`SELECT last_sync_at, last_handshake_at FROM sync_cursors WHERE station_id=$1::uuid`, sid,
		).Scan(&st.LastSyncAt, &st.LastHandshakeAt)
	}
	c.JSON(http.StatusOK, st)
}

// ─── GET /sync/conflicts ────────────────────────────────────────────────────────
func (h *SyncHandler) ListConflicts(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, entity, entity_id::text, local_version, cloud_version,
		       local_payload, cloud_payload, resolution, resolved_by::text, resolved_at, created_at
		FROM conflict_log
		WHERE business_id=$1::uuid AND resolution='needs_review'
		ORDER BY created_at DESC LIMIT 100`, nullableUUID(businessID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	out := []model.ConflictEntry{}
	for rows.Next() {
		var e model.ConflictEntry
		var lp, cp []byte
		if err := rows.Scan(&e.ID, &e.Entity, &e.EntityID, &e.LocalVersion, &e.CloudVersion,
			&lp, &cp, &e.Resolution, &e.ResolvedBy, &e.ResolvedAt, &e.CreatedAt); err != nil {
			continue
		}
		_ = json.Unmarshal(lp, &e.LocalPayload)
		_ = json.Unmarshal(cp, &e.CloudPayload)
		out = append(out, e)
	}
	c.JSON(http.StatusOK, out)
}

// ─── PATCH /sync/conflicts/:id ────────────────────────────────────────────────
// Human resolution: pick 'local' or 'cloud' and apply it to the entity state.
func (h *SyncHandler) ResolveConflict(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	id := c.Param("id")
	var body struct {
		Choice string `json:"choice"` // 'local' | 'cloud'
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var entity, entityID string
	var localPayload, cloudPayload []byte
	var localVersion int64
	err := h.DB.QueryRow(ctx,
		`SELECT entity, entity_id::text, local_payload, cloud_payload, COALESCE(local_version,0)
		 FROM conflict_log WHERE id=$1 AND business_id=$2::uuid`,
		id, nullableUUID(businessID),
	).Scan(&entity, &entityID, &localPayload, &cloudPayload, &localVersion)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "conflict not found"})
		return
	}

	if body.Choice == "local" {
		_, _ = h.DB.Exec(ctx, `
			UPDATE sync_entity_state
			SET payload=$1, version=version+1, hlc=$2, row_seq=nextval('sync_state_seq'), updated_at=NOW()
			WHERE entity=$3 AND entity_id=$4::uuid`,
			localPayload, h.HLC.Now(), entity, entityID)
	}
	_, err = h.DB.Exec(ctx,
		`UPDATE conflict_log SET resolution='resolved', resolved_by=NULLIF($1,'')::uuid, resolved_at=NOW() WHERE id=$2`,
		c.GetString("user_id"), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "resolved", "applied": body.Choice})
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func deriveIdemKey(env model.ChangeEnvelope) string {
	b, _ := json.Marshal(env)
	sum := sha256.Sum256(b)
	return env.StationID + ":" + hex.EncodeToString(sum[:16])
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// AppendEvent is a reusable helper any handler can call to record a domain
// event in the append-only event store with proper per-stream sequencing and an
// HLC stamp. Safe to call from a goroutine.
func AppendEvent(ctx context.Context, db *pgxpool.Pool, hlc *HLC, e model.DomainEvent) error {
	if e.HLC == "" && hlc != nil {
		e.HLC = hlc.Now()
	}
	if e.OccurredAt.IsZero() {
		e.OccurredAt = time.Now().UTC()
	}
	payloadJSON, _ := json.Marshal(e.Payload)
	metaJSON, _ := json.Marshal(e.Metadata)

	// Determine next sequence number for the stream (optimistic; UNIQUE guards).
	var nextSeq int
	db.QueryRow(ctx,
		`SELECT COALESCE(MAX(seq_in_stream),0)+1 FROM event_store WHERE stream_id=$1::uuid`,
		e.StreamID,
	).Scan(&nextSeq)

	_, err := db.Exec(ctx, `
		INSERT INTO event_store
		  (stream_id, stream_type, seq_in_stream, event_type, event_version,
		   payload, metadata, business_id, station_id, actor_id, occurred_at, hlc)
		VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8::uuid,$9::uuid,$10::uuid,$11,$12)
		ON CONFLICT (stream_id, seq_in_stream) DO NOTHING`,
		e.StreamID, e.StreamType, nextSeq, e.EventType, maxInt(e.EventVersion, 1),
		payloadJSON, metaJSON, e.BusinessID, derefOr(e.StationID), derefOr(e.ActorID),
		e.OccurredAt, e.HLC)
	return err
}

func derefOr(s *string) interface{} {
	if s == nil || *s == "" {
		return nil
	}
	return *s
}
