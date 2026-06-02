package sps

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(r *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.SPSHandler{DB: db}

	// Score a specific closed shift
	r.POST("/shifts/:shiftId/score", h.ScoreShift)

	// Leaderboard — GET /rankings?scope=company|branch
	r.GET("/rankings", h.GetRankings)

	// Per-supervisor lifetime stats
	r.GET("/users/:id/sps", h.GetSupervisorStats)

	// Current user's own stats
	r.GET("/sps/me", h.GetMyStats)
}
