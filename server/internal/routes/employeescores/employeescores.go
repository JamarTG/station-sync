package employeescores

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(r *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.EmployeeScoresHandler{DB: db}

	// ── CPS — Cashier Performance Score ──────────────────────────────────────
	r.GET("/cps/rankings",          h.GetCPSRankings)
	r.GET("/cps/tier-distribution", h.GetCPSTierDistribution)
	r.GET("/users/:id/cps",         h.GetCashierStats)

	// ── APS — Attendant Performance Score ────────────────────────────────────
	r.GET("/aps/rankings",          h.GetAPSRankings)
	r.GET("/aps/tier-distribution", h.GetAPSTierDistribution)
	r.GET("/users/:id/aps",         h.GetAttendantStats)

	// ── Feedback (used by both CPS & APS customer service category) ──────────
	r.POST("/employees/:id/feedback", h.SubmitFeedback)
}
