package holidays

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(r *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.HolidayHandler{DB: db}

	// ── Calendar & self-service ──────────────────────────────────────────────
	r.GET("/holidays/calendar", h.GetHolidayCalendar)
	r.GET("/holidays/upcoming", h.GetUpcomingHolidays)

	// ── Admin holiday management (company / emergency) ───────────────────────
	r.GET("/holidays", h.ListHolidays)
	r.POST("/holidays", h.CreateHoliday)
	r.DELETE("/holidays/:id", h.DeleteHoliday)

	// ── Premium pay rules ────────────────────────────────────────────────────
	r.GET("/holidays/pay-rules", h.GetPayRules)
	r.PUT("/holidays/pay-rules", h.UpsertPayRules)
	r.POST("/holidays/pay-preview", h.PreviewHolidayPay)

	// ── Holiday shift sign-ups ───────────────────────────────────────────────
	r.GET("/holidays/signups", h.ListSignups)
	r.POST("/holidays/signups", h.CreateSignup)
	r.PATCH("/holidays/signups/:id", h.ReviewSignup)

	// ── Forecast, analytics, compliance, AI ──────────────────────────────────
	r.GET("/holidays/forecast", h.GetHolidayForecast)
	r.GET("/holidays/analytics", h.GetHolidayAnalytics)
	r.GET("/holidays/compliance", h.GetComplianceAlerts)
	r.GET("/holidays/insights", h.GetHolidayInsights)
}
