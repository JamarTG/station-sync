package fuelintelligence

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(r *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.FuelIntelligenceHandler{DB: db}

	// Fuel Performance Score
	r.GET("/fuel/fps", h.GetFPS)

	// Tank-level analytics
	r.GET("/fuel/tanks/summary", h.GetTanksSummary)

	// Per-grade revenue / loss analytics
	r.GET("/fuel/grades/analytics", h.GetGradeAnalytics)

	// Delivery verification summary
	r.GET("/fuel/deliveries/summary", h.GetDeliverySummary)

	// Reorder intelligence
	r.GET("/fuel/reorder", h.GetReorderStatus)

	// Alerts
	r.GET("/fuel/alerts", h.GetAlerts)
	r.PATCH("/fuel/alerts/:alertId/resolve", h.ResolveAlert)
	r.POST("/fuel/alerts/check", h.CheckAlerts)
}
