package sync

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(r *gin.RouterGroup, db *pgxpool.Pool) {
	h := handlers.NewSyncHandler(db)

	// ── Synchronization engine ───────────────────────────────────────────────
	r.POST("/sync/handshake", h.Handshake)
	r.POST("/sync/upload",    h.Upload)
	r.GET("/sync/download",   h.Download)
	r.GET("/sync/status",     h.Status)

	// ── Conflict review ──────────────────────────────────────────────────────
	r.GET("/sync/conflicts",       h.ListConflicts)
	r.PATCH("/sync/conflicts/:id", h.ResolveConflict)
}
