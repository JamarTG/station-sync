package payroll

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.PayrollHandler{DB: db}

	// ── Legacy period-based payroll (preserved) ──────────────────────────────
	g.GET("/payroll/weekly-summary", h.WeeklySummary)

	periods := g.Group("/payroll/periods")
	periods.GET("", h.ListPeriods)
	periods.POST("", h.CreatePeriod)
	periods.PATCH("/:id", h.UpdatePeriod)
	periods.DELETE("/:id", h.DeletePeriod)
	periods.GET("/:id/records", h.ListRecords)
	periods.PATCH("/:id/records/:recordId", h.UpdateRecord)
	periods.PATCH("/:id/publish", h.PublishPeriod)

	g.GET("/users/:id/payroll", h.ListRecordsForUser)

	// ── Payroll config ────────────────────────────────────────────────────────
	g.GET("/payroll/config", h.GetPayrollConfig)
	g.PUT("/payroll/config", h.UpsertPayrollConfig)

	// ── Tax rule sets & rules ─────────────────────────────────────────────────
	g.GET("/payroll/tax-rule-sets", h.GetTaxRuleSets)
	g.POST("/payroll/tax-rule-sets", h.CreateTaxRuleSet)
	g.PATCH("/payroll/tax-rule-sets/:id/activate", h.ActivateTaxRuleSet)
	g.GET("/payroll/tax-rule-sets/:id/rules", h.GetTaxRules)
	g.PUT("/payroll/tax-rule-sets/:id/rules", h.UpsertTaxRule)

	// ── Salary preview (no DB write) ─────────────────────────────────────────
	g.POST("/payroll/salary-preview", h.PreviewSalary)

	// ── Employee compensation ─────────────────────────────────────────────────
	g.GET("/payroll/compensation", h.ListCompensation)
	g.PUT("/payroll/compensation/:id", h.UpsertCompensation)

	// ── Payroll runs (state machine) ─────────────────────────────────────────
	g.GET("/payroll/runs", h.ListPayrollRuns)
	g.POST("/payroll/runs", h.CreatePayrollRun)
	g.GET("/payroll/runs/:id", h.GetPayrollRun)
	g.PATCH("/payroll/runs/:id/approve", h.ApprovePayrollRun)
	g.PATCH("/payroll/runs/:id/lock", h.LockPayrollRun)
	g.GET("/payroll/runs/:id/lines", h.GetRunLines)
	g.PATCH("/payroll/runs/:id/lines/:lineId", h.OverrideRunLine)

	// ── Analytics & audit ────────────────────────────────────────────────────
	g.GET("/payroll/analytics", h.GetPayrollAnalytics)
	g.GET("/payroll/audit-log", h.GetAuditLog)
}
