package payroll

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.PayrollHandler{DB: db}

	g.GET("/payroll/weekly-summary", h.WeeklySummary)

	periods := g.Group("/payroll/periods")
	periods.GET("", h.ListPeriods)
	periods.POST("", h.CreatePeriod)
	periods.GET("/:id/records", h.ListRecords)
	periods.PATCH("/:id/records/:recordId", h.UpdateRecord)
	periods.PATCH("/:id/publish", h.PublishPeriod)

	g.GET("/users/:id/payroll", h.ListRecordsForUser)
}
