package model

import "time"

// ═══════════════════════════════════════════════════════════════════════════════
// Offline-First Sync Models
// ═══════════════════════════════════════════════════════════════════════════════

// ChangeItem is a single row change uploaded from an edge station to the cloud
// (or downloaded from cloud to edge). It carries the optimistic-concurrency
// metadata needed for conflict detection.
type ChangeItem struct {
	Entity      string                 `json:"entity"`
	EntityID    string                 `json:"entity_id"`
	Op          string                 `json:"op"` // insert | update | delete
	Payload     map[string]interface{} `json:"payload"`
	Version     int64                  `json:"version"`
	BaseVersion int64                  `json:"base_version,omitempty"`
	HLC         string                 `json:"hlc"`
	Seq         int64                  `json:"seq,omitempty"`
}

// ChangeEnvelope is the body of POST /sync/upload.
type ChangeEnvelope struct {
	StationID string       `json:"station_id"`
	FromSeq   int64        `json:"from_seq"`
	Items     []ChangeItem `json:"items"`
	Checksum  string       `json:"checksum,omitempty"`
}

// ItemResult reports the cloud's decision for one uploaded change.
type ItemResult struct {
	EntityID      string `json:"entity_id"`
	Status        string `json:"status"`               // accepted | conflict | ignored
	ServerVersion int64  `json:"server_version,omitempty"`
	Resolution    string `json:"resolution,omitempty"` // lww | merged | needs_review
}

// UploadResult is returned from POST /sync/upload.
type UploadResult struct {
	Results     []ItemResult `json:"results"`
	Accepted    int          `json:"accepted"`
	Conflicts   int          `json:"conflicts"`
	MaxSeq      int64        `json:"max_seq"`
	CloudCursor string       `json:"cloud_cursor"`
}

// DownloadResult is returned from GET /sync/download.
type DownloadResult struct {
	Items      []ChangeItem `json:"items"`
	CloudCursor string      `json:"cloud_cursor"`
	HasMore    bool         `json:"has_more"`
}

// HandshakeRequest registers a station and exchanges clock + schema versions.
type HandshakeRequest struct {
	StationID     string `json:"station_id"`
	SchemaVersion int    `json:"schema_version"`
	EdgeHLC       string `json:"edge_hlc"`
	AppVersion    string `json:"app_version"`
}

// HandshakeResponse tells the edge where to resume.
type HandshakeResponse struct {
	StationID      string `json:"station_id"`
	CloudHLC       string `json:"cloud_hlc"`
	UploadSeq      int64  `json:"upload_seq"`      // resume uploads after this
	DownloadCursor string `json:"download_cursor"` // resume downloads after this
	SchemaVersion  int    `json:"schema_version"`
	ServerTime     string `json:"server_time"`
}

// SyncStatus is a lightweight health/lag snapshot for the dashboard.
type SyncStatus struct {
	Online            bool       `json:"online"`
	PendingChanges    int        `json:"pending_changes"`     // change_log not yet synced
	PendingEvents     int        `json:"pending_events"`      // event_store not yet synced
	OutboxQueued      int        `json:"outbox_queued"`
	OutboxDead        int        `json:"outbox_dead"`
	OpenConflicts     int        `json:"open_conflicts"`
	LastSyncAt        *time.Time `json:"last_sync_at"`
	LastHandshakeAt   *time.Time `json:"last_handshake_at"`
	ServerTime        time.Time  `json:"server_time"`
}

// DomainEvent is an append-only event in the event store.
type DomainEvent struct {
	EventID     string                 `json:"event_id"`
	StreamID    string                 `json:"stream_id"`
	StreamType  string                 `json:"stream_type"`
	SeqInStream int                    `json:"seq_in_stream"`
	EventType   string                 `json:"event_type"`
	EventVersion int                   `json:"event_version"`
	Payload     map[string]interface{} `json:"payload"`
	Metadata    map[string]interface{} `json:"metadata"`
	BusinessID  string                 `json:"business_id"`
	StationID   *string                `json:"station_id"`
	ActorID     *string                `json:"actor_id"`
	OccurredAt  time.Time              `json:"occurred_at"`
	HLC         string                 `json:"hlc"`
	RecordedAt  time.Time              `json:"recorded_at"`
}

// ConflictEntry mirrors a conflict_log row for review UIs.
type ConflictEntry struct {
	ID           string                 `json:"id"`
	Entity       string                 `json:"entity"`
	EntityID     string                 `json:"entity_id"`
	LocalVersion *int64                 `json:"local_version"`
	CloudVersion *int64                 `json:"cloud_version"`
	LocalPayload map[string]interface{} `json:"local_payload"`
	CloudPayload map[string]interface{} `json:"cloud_payload"`
	Resolution   string                 `json:"resolution"`
	ResolvedBy   *string                `json:"resolved_by"`
	ResolvedAt   *time.Time             `json:"resolved_at"`
	CreatedAt    time.Time              `json:"created_at"`
}
