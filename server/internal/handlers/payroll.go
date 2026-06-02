package handlers

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type PayrollHandler struct {
	DB *pgxpool.Pool
}

// calcDeductions is a backward-compatible wrapper that uses the engine with
// default JA tax config (monthly frequency). Existing handlers call this.
// New handlers call CalculateDeductions directly with a loaded TaxConfig.
func calcDeductions(gross float64) (nis, nht, edTax, paye float64) {
	res := CalculateDeductions(gross, "Monthly", defaultJATaxConfig)
	return res.NISEmployee, res.NHTEmployee, res.EdTaxEmployee, res.PAYE
}

func (h *PayrollHandler) ListPeriods(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT id::text, start_date, end_date, status, created_at
		 FROM payroll_periods WHERE business_id = $1 ORDER BY start_date DESC`, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	periods := []model.PayrollPeriod{}
	for rows.Next() {
		var p model.PayrollPeriod
		if err := rows.Scan(&p.ID, &p.StartDate, &p.EndDate, &p.Status, &p.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		periods = append(periods, p)
	}
	c.JSON(http.StatusOK, periods)
}

func (h *PayrollHandler) CreatePeriod(c *gin.Context) {
	var body struct {
		StartDate string   `json:"start_date" binding:"required"`
		EndDate   string   `json:"end_date" binding:"required"`
		UserIDs   []string `json:"user_ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startDate, err := time.Parse("2006-01-02", body.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_date format, use YYYY-MM-DD"})
		return
	}
	endDate, err := time.Parse("2006-01-02", body.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_date format, use YYYY-MM-DD"})
		return
	}
	if !endDate.After(startDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "end_date must be after start_date"})
		return
	}

	ctx := c.Request.Context()
	businessID := c.GetString("business_id")

	var period model.PayrollPeriod
	err = h.DB.QueryRow(ctx,
		`INSERT INTO payroll_periods (business_id, start_date, end_date)
		 VALUES ($1, $2, $3)
		 RETURNING id::text, start_date, end_date, status, created_at`,
		businessID, startDate, endDate,
	).Scan(&period.ID, &period.StartDate, &period.EndDate, &period.Status, &period.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Fetch active employees with pay configured (optionally filtered to specific user IDs)
	type empRow struct {
		id      string
		payRate float64
		payType string
	}
	var empRows pgx.Rows
	if len(body.UserIDs) > 0 {
		empRows, err = h.DB.Query(ctx,
			`SELECT id::text, pay_rate, pay_type FROM users
			 WHERE business_id = $1 AND active = true AND pay_rate IS NOT NULL AND pay_type IS NOT NULL
			   AND id = ANY($2::uuid[])`,
			businessID, body.UserIDs)
	} else {
		empRows, err = h.DB.Query(ctx,
			`SELECT id::text, pay_rate, pay_type FROM users
			 WHERE business_id = $1 AND active = true AND pay_rate IS NOT NULL AND pay_type IS NOT NULL`,
			businessID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer empRows.Close()

	var employees []empRow
	for empRows.Next() {
		var e empRow
		if err := empRows.Scan(&e.id, &e.payRate, &e.payType); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		employees = append(employees, e)
	}
	empRows.Close()

	periodDays := endDate.Sub(startDate).Hours()/24 + 1

	for _, emp := range employees {
		var gross float64
		var hoursWorked *float64

		if emp.payType == "Hourly" {
			// Sum hours from shift_attendance for this period
			var totalSeconds float64
			err = h.DB.QueryRow(ctx, `
				SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (clock_out - clock_in))), 0)
				FROM shift_attendance sa
				JOIN shifts s ON s.id = sa.shift_id
				WHERE sa.user_id = $1
				  AND s.date >= $2 AND s.date <= $3
				  AND sa.clock_out IS NOT NULL`,
				emp.id, startDate, endDate,
			).Scan(&totalSeconds)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			hours := math.Round(totalSeconds/3600*100) / 100
			hoursWorked = &hours
			gross = math.Round(hours*emp.payRate*100) / 100
		} else {
			// Salary: prorate by days in period vs days in the month
			daysInMonth := float64(daysInMonthOf(startDate))
			gross = math.Round((emp.payRate/daysInMonth)*periodDays*100) / 100
		}

		nis, nht, edTax, paye := calcDeductions(gross)
		netPay := math.Round((gross-nis-nht-edTax-paye)*100) / 100

		_, err = h.DB.Exec(ctx, `
			INSERT INTO payroll_records
			  (period_id, user_id, gross_pay, nis, nht, ed_tax, paye, net_pay, hours_worked)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (period_id, user_id) DO NOTHING`,
			period.ID, emp.id, gross, nis, nht, edTax, paye, netPay, hoursWorked,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusCreated, period)
}

const recordSelectCols = `
	pr.id::text, pr.period_id::text, pp.start_date, pp.end_date, pp.status,
	pr.user_id::text, u.name, u.role,
	pr.gross_pay, pr.nis, pr.nht, pr.ed_tax, pr.paye, pr.net_pay,
	pr.hours_worked, pr.overage, pr.shortage, pr.created_at`

func scanRecord(rows interface{ Scan(...any) error }, r *model.PayrollRecord) error {
	return rows.Scan(
		&r.ID, &r.PeriodID, &r.PeriodStartDate, &r.PeriodEndDate, &r.PeriodStatus,
		&r.UserID, &r.UserName, &r.UserRole,
		&r.GrossPay, &r.NIS, &r.NHT, &r.EdTax, &r.PAYE, &r.NetPay,
		&r.HoursWorked, &r.Overage, &r.Shortage, &r.CreatedAt,
	)
}

func (h *PayrollHandler) ListRecords(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT `+recordSelectCols+`
		FROM payroll_records pr
		JOIN payroll_periods pp ON pp.id = pr.period_id
		JOIN users u ON u.id = pr.user_id
		WHERE pr.period_id = $1 AND pp.business_id = $2
		ORDER BY u.name`, c.Param("id"), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	records := []model.PayrollRecord{}
	for rows.Next() {
		var r model.PayrollRecord
		if err := scanRecord(rows, &r); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		records = append(records, r)
	}
	c.JSON(http.StatusOK, records)
}

func (h *PayrollHandler) ListRecordsForUser(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT `+recordSelectCols+`
		FROM payroll_records pr
		JOIN payroll_periods pp ON pp.id = pr.period_id
		JOIN users u ON u.id = pr.user_id
		WHERE pr.user_id = $1
		ORDER BY pp.start_date DESC`, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	records := []model.PayrollRecord{}
	for rows.Next() {
		var r model.PayrollRecord
		if err := scanRecord(rows, &r); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		records = append(records, r)
	}
	c.JSON(http.StatusOK, records)
}

func (h *PayrollHandler) DeletePeriod(c *gin.Context) {
	businessID := c.GetString("business_id")
	periodID := c.Param("id")

	var status string
	err := h.DB.QueryRow(c.Request.Context(),
		`SELECT status FROM payroll_periods WHERE id = $1 AND business_id = $2`,
		periodID, businessID,
	).Scan(&status)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "period not found"})
		return
	}
	if status != "Draft" {
		c.JSON(http.StatusConflict, gin.H{"error": "only Draft periods can be deleted"})
		return
	}

	_, err = h.DB.Exec(c.Request.Context(),
		`DELETE FROM payroll_periods WHERE id = $1 AND business_id = $2`,
		periodID, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *PayrollHandler) UpdatePeriod(c *gin.Context) {
	businessID := c.GetString("business_id")
	periodID := c.Param("id")

	var body struct {
		StartDate string `json:"start_date" binding:"required"`
		EndDate   string `json:"end_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startDate, err := time.Parse("2006-01-02", body.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_date"})
		return
	}
	endDate, err := time.Parse("2006-01-02", body.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_date"})
		return
	}
	if !endDate.After(startDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "end_date must be after start_date"})
		return
	}

	ctx := c.Request.Context()

	var status string
	err = h.DB.QueryRow(ctx,
		`SELECT status FROM payroll_periods WHERE id = $1 AND business_id = $2`,
		periodID, businessID,
	).Scan(&status)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "period not found"})
		return
	}
	if status != "Draft" {
		c.JSON(http.StatusConflict, gin.H{"error": "only Draft periods can be edited"})
		return
	}

	// Update dates
	var period model.PayrollPeriod
	err = h.DB.QueryRow(ctx,
		`UPDATE payroll_periods SET start_date = $1, end_date = $2
		 WHERE id = $3 AND business_id = $4
		 RETURNING id::text, start_date, end_date, status, created_at`,
		startDate, endDate, periodID, businessID,
	).Scan(&period.ID, &period.StartDate, &period.EndDate, &period.Status, &period.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Delete existing records and regenerate with new dates
	if _, err = h.DB.Exec(ctx, `DELETE FROM payroll_records WHERE period_id = $1`, periodID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type empRow struct {
		id      string
		payRate float64
		payType string
	}
	empRows, err := h.DB.Query(ctx,
		`SELECT id::text, pay_rate, pay_type FROM users
		 WHERE business_id = $1 AND active = true AND pay_rate IS NOT NULL AND pay_type IS NOT NULL`,
		businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer empRows.Close()

	var employees []empRow
	for empRows.Next() {
		var e empRow
		if err := empRows.Scan(&e.id, &e.payRate, &e.payType); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		employees = append(employees, e)
	}
	empRows.Close()

	periodDays := endDate.Sub(startDate).Hours()/24 + 1
	for _, emp := range employees {
		var gross float64
		var hoursWorked *float64
		if emp.payType == "Hourly" {
			var totalSeconds float64
			err = h.DB.QueryRow(ctx, `
				SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (clock_out - clock_in))), 0)
				FROM shift_attendance sa
				JOIN shifts s ON s.id = sa.shift_id
				WHERE sa.user_id = $1 AND s.date >= $2 AND s.date <= $3 AND sa.clock_out IS NOT NULL`,
				emp.id, startDate, endDate,
			).Scan(&totalSeconds)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			hours := math.Round(totalSeconds/3600*100) / 100
			hoursWorked = &hours
			gross = math.Round(hours*emp.payRate*100) / 100
		} else {
			daysInMonth := float64(daysInMonthOf(startDate))
			gross = math.Round((emp.payRate/daysInMonth)*periodDays*100) / 100
		}
		nis, nht, edTax, paye := calcDeductions(gross)
		netPay := math.Round((gross-nis-nht-edTax-paye)*100) / 100
		_, err = h.DB.Exec(ctx, `
			INSERT INTO payroll_records
			  (period_id, user_id, gross_pay, nis, nht, ed_tax, paye, net_pay, hours_worked)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (period_id, user_id) DO NOTHING`,
			period.ID, emp.id, gross, nis, nht, edTax, paye, netPay, hoursWorked,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, period)
}

func (h *PayrollHandler) PublishPeriod(c *gin.Context) {
	businessID := c.GetString("business_id")
	periodID := c.Param("id")
	_, err := h.DB.Exec(c.Request.Context(),
		`UPDATE payroll_periods SET status = 'Published' WHERE id = $1 AND business_id = $2`,
		periodID, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *PayrollHandler) WeeklySummary(c *gin.Context) {
	businessID := c.GetString("business_id")
	now := time.Now()
	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	weekStart := now.AddDate(0, 0, -(weekday - 1))
	weekEnd := weekStart.AddDate(0, 0, 6)

	var totalOverage, totalShortage float64
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT COALESCE(SUM(pr.overage), 0), COALESCE(SUM(pr.shortage), 0)
		FROM payroll_records pr
		JOIN payroll_periods pp ON pp.id = pr.period_id
		WHERE pp.business_id = $1 AND pp.end_date >= $2 AND pp.start_date <= $3`,
		businessID,
		weekStart.Format("2006-01-02"),
		weekEnd.Format("2006-01-02"),
	).Scan(&totalOverage, &totalShortage)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"total_overage":  totalOverage,
		"total_shortage": totalShortage,
		"week_start":     weekStart.Format("2006-01-02"),
		"week_end":       weekEnd.Format("2006-01-02"),
	})
}

func (h *PayrollHandler) UpdateRecord(c *gin.Context) {
	periodID := c.Param("id")
	recordID := c.Param("recordId")

	var body struct {
		Overage  float64 `json:"overage"`
		Shortage float64 `json:"shortage"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()

	businessID := c.GetString("business_id")

	var gross, nis, nht, edTax, paye float64
	err := h.DB.QueryRow(ctx, `
		SELECT pr.gross_pay, pr.nis, pr.nht, pr.ed_tax, pr.paye
		FROM payroll_records pr
		JOIN payroll_periods pp ON pp.id = pr.period_id
		WHERE pr.id = $1 AND pr.period_id = $2 AND pp.business_id = $3`,
		recordID, periodID, businessID,
	).Scan(&gross, &nis, &nht, &edTax, &paye)
	if err == pgx.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	overage  := math.Round(body.Overage*100) / 100
	shortage := math.Round(body.Shortage*100) / 100
	netPay   := math.Round((gross-nis-nht-edTax-paye+overage-shortage)*100) / 100

	_, err = h.DB.Exec(ctx,
		`UPDATE payroll_records SET overage=$1, shortage=$2, net_pay=$3 WHERE id=$4`,
		overage, shortage, netPay, recordID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var r model.PayrollRecord
	if err := scanRecord(h.DB.QueryRow(ctx,
		`SELECT `+recordSelectCols+`
		 FROM payroll_records pr
		 JOIN payroll_periods pp ON pp.id = pr.period_id
		 JOIN users u ON u.id = pr.user_id
		 WHERE pr.id = $1`, recordID,
	), &r); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, r)
}

func daysInMonthOf(t time.Time) int {
	return time.Date(t.Year(), t.Month()+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

// ─── writeAudit is a fire-and-forget helper for payroll audit log entries. ────
func writeAudit(ctx context.Context, db *pgxpool.Pool, businessID, entityType, entityID, action, actorID, actorName string, before, after interface{}, reason string) {
	beforeJSON, _ := json.Marshal(before)
	afterJSON, _ := json.Marshal(after)
	_, _ = db.Exec(ctx, `
		INSERT INTO payroll_audit_log
		  (business_id, entity_type, entity_id, action, actor_id, actor_name, before_val, after_val, reason)
		VALUES ($1,$2,$3,$4,NULLIF($5,'')::uuid,$6,$7,$8,NULLIF($9,''))`,
		businessID, entityType, entityID, action, actorID, actorName, beforeJSON, afterJSON, reason)
}

// ══════════════════════════════════════════════════════════════════════════════
// Payroll Config
// ══════════════════════════════════════════════════════════════════════════════

// GetPayrollConfig  GET /payroll/config
func (h *PayrollHandler) GetPayrollConfig(c *gin.Context) {
	businessID := c.GetString("business_id")
	var cfg model.PayrollConfig
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT id::text, business_id::text, frequency, pay_day, currency,
		       overtime_multiplier, double_time_multiplier, created_at, updated_at
		FROM payroll_config WHERE business_id = $1`, businessID,
	).Scan(&cfg.ID, &cfg.BusinessID, &cfg.Frequency, &cfg.PayDay, &cfg.Currency,
		&cfg.OvertimeMultiplier, &cfg.DoubleTimeMultiplier, &cfg.CreatedAt, &cfg.UpdatedAt)
	if err != nil {
		// Return defaults if not yet configured
		c.JSON(http.StatusOK, model.PayrollConfig{
			BusinessID: businessID, Frequency: "Monthly", Currency: "JMD",
			OvertimeMultiplier: 1.5, DoubleTimeMultiplier: 2.0,
		})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

// UpsertPayrollConfig  PUT /payroll/config
func (h *PayrollHandler) UpsertPayrollConfig(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		Frequency            string  `json:"frequency"`
		PayDay               *int    `json:"pay_day"`
		Currency             string  `json:"currency"`
		OvertimeMultiplier   float64 `json:"overtime_multiplier"`
		DoubleTimeMultiplier float64 `json:"double_time_multiplier"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Currency == "" {
		body.Currency = "JMD"
	}
	if body.OvertimeMultiplier <= 0 {
		body.OvertimeMultiplier = 1.5
	}
	if body.DoubleTimeMultiplier <= 0 {
		body.DoubleTimeMultiplier = 2.0
	}
	var cfg model.PayrollConfig
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO payroll_config
		  (business_id, frequency, pay_day, currency, overtime_multiplier, double_time_multiplier)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (business_id) DO UPDATE
		  SET frequency=$2, pay_day=$3, currency=$4,
		      overtime_multiplier=$5, double_time_multiplier=$6, updated_at=NOW()
		RETURNING id::text, business_id::text, frequency, pay_day, currency,
		          overtime_multiplier, double_time_multiplier, created_at, updated_at`,
		businessID, body.Frequency, body.PayDay, body.Currency,
		body.OvertimeMultiplier, body.DoubleTimeMultiplier,
	).Scan(&cfg.ID, &cfg.BusinessID, &cfg.Frequency, &cfg.PayDay, &cfg.Currency,
		&cfg.OvertimeMultiplier, &cfg.DoubleTimeMultiplier, &cfg.CreatedAt, &cfg.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	go writeAudit(context.Background(), h.DB, businessID, "payroll_config", cfg.ID, "updated",
		c.GetString("user_id"), c.GetString("user_name"), nil, cfg, "")
	c.JSON(http.StatusOK, cfg)
}

// ══════════════════════════════════════════════════════════════════════════════
// Tax Rule Sets & Rules
// ══════════════════════════════════════════════════════════════════════════════

// GetTaxRuleSets  GET /payroll/tax-rule-sets
func (h *PayrollHandler) GetTaxRuleSets(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, business_id::text, name, effective_from::text,
		       effective_to::text, is_active, created_at
		FROM tax_rule_sets WHERE business_id = $1 ORDER BY effective_from DESC`, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var sets []model.TaxRuleSet
	for rows.Next() {
		var s model.TaxRuleSet
		if err := rows.Scan(&s.ID, &s.BusinessID, &s.Name, &s.EffectiveFrom,
			&s.EffectiveTo, &s.IsActive, &s.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		sets = append(sets, s)
	}
	if sets == nil {
		sets = []model.TaxRuleSet{}
	}
	c.JSON(http.StatusOK, sets)
}

// CreateTaxRuleSet  POST /payroll/tax-rule-sets
func (h *PayrollHandler) CreateTaxRuleSet(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		Name          string `json:"name" binding:"required"`
		EffectiveFrom string `json:"effective_from" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var s model.TaxRuleSet
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO tax_rule_sets (business_id, name, effective_from, created_by)
		VALUES ($1,$2,$3,NULLIF($4,'')::uuid)
		RETURNING id::text, business_id::text, name, effective_from::text,
		          effective_to::text, is_active, created_at`,
		businessID, body.Name, body.EffectiveFrom, c.GetString("user_id"),
	).Scan(&s.ID, &s.BusinessID, &s.Name, &s.EffectiveFrom, &s.EffectiveTo, &s.IsActive, &s.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, s)
}

// ActivateTaxRuleSet  PATCH /payroll/tax-rule-sets/:id/activate
func (h *PayrollHandler) ActivateTaxRuleSet(c *gin.Context) {
	businessID := c.GetString("business_id")
	setID := c.Param("id")
	ctx := c.Request.Context()

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback(ctx)

	// Deactivate all others
	if _, err = tx.Exec(ctx,
		`UPDATE tax_rule_sets SET is_active=false WHERE business_id=$1`, businessID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Activate the target
	var s model.TaxRuleSet
	if err = tx.QueryRow(ctx, `
		UPDATE tax_rule_sets SET is_active=true
		WHERE id=$1 AND business_id=$2
		RETURNING id::text, business_id::text, name, effective_from::text,
		          effective_to::text, is_active, created_at`,
		setID, businessID,
	).Scan(&s.ID, &s.BusinessID, &s.Name, &s.EffectiveFrom, &s.EffectiveTo, &s.IsActive, &s.CreatedAt); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule set not found"})
		return
	}
	if err = tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	go writeAudit(context.Background(), h.DB, businessID, "tax_rule_set", setID, "activated",
		c.GetString("user_id"), c.GetString("user_name"), nil, s, "")
	c.JSON(http.StatusOK, s)
}

// GetTaxRules  GET /payroll/tax-rule-sets/:id/rules
func (h *PayrollHandler) GetTaxRules(c *gin.Context) {
	setID := c.Param("id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, rule_set_id::text, tax_type, rate, threshold, upper_limit,
		       annual_cap, basis, applies_to, created_at
		FROM tax_rules WHERE rule_set_id=$1 ORDER BY tax_type, applies_to`, setID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var rules []model.TaxRule
	for rows.Next() {
		var r model.TaxRule
		if err := rows.Scan(&r.ID, &r.RuleSetID, &r.TaxType, &r.Rate, &r.Threshold,
			&r.UpperLimit, &r.AnnualCap, &r.Basis, &r.AppliesTo, &r.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		rules = append(rules, r)
	}
	if rules == nil {
		rules = []model.TaxRule{}
	}
	c.JSON(http.StatusOK, rules)
}

// UpsertTaxRule  PUT /payroll/tax-rule-sets/:id/rules
func (h *PayrollHandler) UpsertTaxRule(c *gin.Context) {
	businessID := c.GetString("business_id")
	setID := c.Param("id")
	var body struct {
		TaxType    string   `json:"tax_type"  binding:"required"`
		Rate       float64  `json:"rate"      binding:"required"`
		Threshold  *float64 `json:"threshold"`
		UpperLimit *float64 `json:"upper_limit"`
		AnnualCap  *float64 `json:"annual_cap"`
		Basis      string   `json:"basis"`
		AppliesTo  string   `json:"applies_to"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Basis == "" { body.Basis = "gross" }
	if body.AppliesTo == "" { body.AppliesTo = "employee" }

	var r model.TaxRule
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO tax_rules (rule_set_id, tax_type, rate, threshold, upper_limit, annual_cap, basis, applies_to)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (rule_set_id, tax_type, applies_to) DO UPDATE
		  SET rate=$3, threshold=$4, upper_limit=$5, annual_cap=$6, basis=$7
		RETURNING id::text, rule_set_id::text, tax_type, rate, threshold,
		          upper_limit, annual_cap, basis, applies_to, created_at`,
		setID, body.TaxType, body.Rate, body.Threshold, body.UpperLimit,
		body.AnnualCap, body.Basis, body.AppliesTo,
	).Scan(&r.ID, &r.RuleSetID, &r.TaxType, &r.Rate, &r.Threshold, &r.UpperLimit,
		&r.AnnualCap, &r.Basis, &r.AppliesTo, &r.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	go writeAudit(context.Background(), h.DB, businessID, "tax_rule", r.ID, "upserted",
		c.GetString("user_id"), c.GetString("user_name"), nil, r, "")
	c.JSON(http.StatusOK, r)
}

// ══════════════════════════════════════════════════════════════════════════════
// Salary Preview — compute breakdown from entered amount (no DB write)
// ══════════════════════════════════════════════════════════════════════════════

// PreviewSalary  POST /payroll/salary-preview
func (h *PayrollHandler) PreviewSalary(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body model.SalaryPreviewRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, ok := FrequencyPeriods[body.Frequency]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid frequency"})
		return
	}

	ctx := c.Request.Context()
	cfg, _ := LoadActiveTaxConfig(ctx, h.DB, businessID)

	var enteredGross float64
	var requiredGross *float64

	if body.IsAfterTax {
		// Reverse-calculate: entered amount is the desired net at the stated frequency
		periodNet := body.EnteredAmount
		periodGross := ReverseCalculate(periodNet, body.Frequency, cfg)
		rg := periodGross
		requiredGross = &rg
		enteredGross = periodGross
	} else {
		enteredGross = body.EnteredAmount
	}

	// Salary breakdown
	sb := ComputeSalaryBreakdown(enteredGross, body.Frequency)

	// Monthly deduction preview
	res := CalculateDeductions(sb.Monthly, "Monthly", cfg)

	preview := model.SalaryPreview{
		EnteredAmount: body.EnteredAmount,
		Frequency:     body.Frequency,
		IsAfterTax:    body.IsAfterTax,

		AnnualGross:  sb.Annual,
		MonthlyGross: sb.Monthly,
		WeeklyGross:  sb.Weekly,
		DailyRate:    sb.Daily,
		HourlyRate:   sb.Hourly,

		NISEmployee:   res.NISEmployee,
		NHTEmployee:   res.NHTEmployee,
		EdTaxEmployee: res.EdTaxEmployee,
		PAYE:          res.PAYE,
		NetPay:        res.NetPay,
		EffectiveRate: res.EffectiveRate,

		NISEmployer:       res.NISEmployer,
		NHTEmployer:       res.NHTEmployer,
		EdTaxEmployer:     res.EdTaxEmployer,
		TotalEmployerCost: res.TotalEmployerCost,

		RequiredGross: requiredGross,
	}
	c.JSON(http.StatusOK, preview)
}

// ══════════════════════════════════════════════════════════════════════════════
// Employee Compensation
// ══════════════════════════════════════════════════════════════════════════════

// ListCompensation  GET /payroll/compensation
func (h *PayrollHandler) ListCompensation(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT ec.id::text, ec.business_id::text, ec.user_id::text, u.name, u.role,
		       ec.effective_from::text, ec.effective_to::text, ec.frequency, ec.pay_type,
		       ec.entered_amount, ec.is_after_tax, ec.annual_gross, ec.monthly_gross,
		       ec.weekly_gross, ec.daily_rate, ec.hourly_rate, ec.notes,
		       ec.created_by::text, ec.created_at
		FROM employee_compensation ec
		JOIN users u ON u.id = ec.user_id
		WHERE ec.business_id = $1
		  AND (ec.effective_to IS NULL OR ec.effective_to >= CURRENT_DATE)
		ORDER BY u.name, ec.effective_from DESC`, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var comps []model.EmployeeCompensation
	for rows.Next() {
		var ec model.EmployeeCompensation
		if err := rows.Scan(
			&ec.ID, &ec.BusinessID, &ec.UserID, &ec.UserName, &ec.UserRole,
			&ec.EffectiveFrom, &ec.EffectiveTo, &ec.Frequency, &ec.PayType,
			&ec.EnteredAmount, &ec.IsAfterTax, &ec.AnnualGross, &ec.MonthlyGross,
			&ec.WeeklyGross, &ec.DailyRate, &ec.HourlyRate, &ec.Notes,
			&ec.CreatedBy, &ec.CreatedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		comps = append(comps, ec)
	}
	if comps == nil {
		comps = []model.EmployeeCompensation{}
	}
	c.JSON(http.StatusOK, comps)
}

// UpsertCompensation  PUT /payroll/compensation/:userId
func (h *PayrollHandler) UpsertCompensation(c *gin.Context) {
	businessID := c.GetString("business_id")
	userID := c.Param("id")
	ctx := c.Request.Context()

	var body struct {
		Frequency     string   `json:"frequency"      binding:"required"`
		PayType       string   `json:"pay_type"       binding:"required"`
		EnteredAmount float64  `json:"entered_amount" binding:"required"`
		IsAfterTax    bool     `json:"is_after_tax"`
		EffectiveFrom string   `json:"effective_from" binding:"required"`
		EffectiveTo   *string  `json:"effective_to"`
		Notes         *string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cfg, _ := LoadActiveTaxConfig(ctx, h.DB, businessID)

	var enteredGross float64
	if body.IsAfterTax {
		enteredGross = ReverseCalculate(body.EnteredAmount, body.Frequency, cfg)
	} else {
		enteredGross = body.EnteredAmount
	}

	sb := ComputeSalaryBreakdown(enteredGross, body.Frequency)

	// End any existing active compensation for this employee
	_, _ = h.DB.Exec(ctx, `
		UPDATE employee_compensation SET effective_to=$1
		WHERE user_id=$2 AND business_id=$3 AND effective_to IS NULL AND effective_from < $1`,
		body.EffectiveFrom, userID, businessID)

	var ec model.EmployeeCompensation
	err := h.DB.QueryRow(ctx, `
		INSERT INTO employee_compensation
		  (business_id, user_id, effective_from, effective_to, frequency, pay_type,
		   entered_amount, is_after_tax, annual_gross, monthly_gross, weekly_gross,
		   daily_rate, hourly_rate, notes, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NULLIF($15,'')::uuid)
		RETURNING id::text, business_id::text, user_id::text, effective_from::text,
		          effective_to::text, frequency, pay_type, entered_amount, is_after_tax,
		          annual_gross, monthly_gross, weekly_gross, daily_rate, hourly_rate,
		          notes, created_by::text, created_at`,
		businessID, userID, body.EffectiveFrom, body.EffectiveTo,
		body.Frequency, body.PayType, body.EnteredAmount, body.IsAfterTax,
		sb.Annual, sb.Monthly, sb.Weekly, sb.Daily, sb.Hourly,
		body.Notes, c.GetString("user_id"),
	).Scan(
		&ec.ID, &ec.BusinessID, &ec.UserID, &ec.EffectiveFrom, &ec.EffectiveTo,
		&ec.Frequency, &ec.PayType, &ec.EnteredAmount, &ec.IsAfterTax,
		&ec.AnnualGross, &ec.MonthlyGross, &ec.WeeklyGross, &ec.DailyRate, &ec.HourlyRate,
		&ec.Notes, &ec.CreatedBy, &ec.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	go writeAudit(context.Background(), h.DB, businessID, "compensation", ec.ID, "upserted",
		c.GetString("user_id"), c.GetString("user_name"), nil, ec, "")
	c.JSON(http.StatusOK, ec)
}

// ══════════════════════════════════════════════════════════════════════════════
// Payroll Runs — state machine: Draft → Calculated → Approved → Locked → Paid
// ══════════════════════════════════════════════════════════════════════════════

// ListPayrollRuns  GET /payroll/runs
func (h *PayrollHandler) ListPayrollRuns(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT pr.id::text, pr.business_id::text, pr.period_id::text, pr.tax_rule_set_id::text,
		       pr.label, pr.frequency, pr.status,
		       pr.total_gross, pr.total_deductions, pr.total_net, pr.total_employer_cost,
		       pr.employee_count, pr.notes,
		       pr.approved_by::text, pr.approved_at, pr.locked_by::text, pr.locked_at,
		       pr.created_by::text, pr.created_at, pr.updated_at,
		       pp.start_date::text, pp.end_date::text
		FROM payroll_runs pr
		LEFT JOIN payroll_periods pp ON pp.id = pr.period_id
		WHERE pr.business_id = $1
		ORDER BY pr.created_at DESC LIMIT 50`, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var runs []model.PayrollRun
	for rows.Next() {
		var r model.PayrollRun
		if err := rows.Scan(
			&r.ID, &r.BusinessID, &r.PeriodID, &r.TaxRuleSetID,
			&r.Label, &r.Frequency, &r.Status,
			&r.TotalGross, &r.TotalDeductions, &r.TotalNet, &r.TotalEmployerCost,
			&r.EmployeeCount, &r.Notes,
			&r.ApprovedBy, &r.ApprovedAt, &r.LockedBy, &r.LockedAt,
			&r.CreatedBy, &r.CreatedAt, &r.UpdatedAt,
			&r.PeriodStart, &r.PeriodEnd,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		runs = append(runs, r)
	}
	if runs == nil { runs = []model.PayrollRun{} }
	c.JSON(http.StatusOK, runs)
}

// CreatePayrollRun  POST /payroll/runs
// Creates the run record and calculates a line per active employee.
func (h *PayrollHandler) CreatePayrollRun(c *gin.Context) {
	businessID := c.GetString("business_id")
	ctx := c.Request.Context()

	var body struct {
		Label     string   `json:"label"`
		Frequency string   `json:"frequency"`
		PeriodID  *string  `json:"period_id"`
		UserIDs   []string `json:"user_ids"` // empty = all active employees
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Frequency == "" { body.Frequency = "Monthly" }
	if body.Label == "" { body.Label = "Payroll Run " + time.Now().Format("Jan 2006") }

	// Load active tax config
	cfg, _ := LoadActiveTaxConfig(ctx, h.DB, businessID)

	// Get active tax rule set ID
	var taxRuleSetID *string
	_ = h.DB.QueryRow(ctx,
		`SELECT id::text FROM tax_rule_sets WHERE business_id=$1 AND is_active=true`,
		businessID).Scan(&taxRuleSetID)

	// Create the run
	var run model.PayrollRun
	err := h.DB.QueryRow(ctx, `
		INSERT INTO payroll_runs
		  (business_id, period_id, tax_rule_set_id, label, frequency, status, created_by)
		VALUES ($1, $2, $3, $4, $5, 'Draft', NULLIF($6,'')::uuid)
		RETURNING id::text, business_id::text, period_id::text, tax_rule_set_id::text,
		          label, frequency, status, total_gross, total_deductions, total_net,
		          total_employer_cost, employee_count, notes,
		          approved_by::text, approved_at, locked_by::text, locked_at,
		          created_by::text, created_at, updated_at`,
		businessID, body.PeriodID, taxRuleSetID, body.Label, body.Frequency, c.GetString("user_id"),
	).Scan(
		&run.ID, &run.BusinessID, &run.PeriodID, &run.TaxRuleSetID,
		&run.Label, &run.Frequency, &run.Status,
		&run.TotalGross, &run.TotalDeductions, &run.TotalNet, &run.TotalEmployerCost,
		&run.EmployeeCount, &run.Notes,
		&run.ApprovedBy, &run.ApprovedAt, &run.LockedBy, &run.LockedAt,
		&run.CreatedBy, &run.CreatedAt, &run.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Fetch employees with active compensation
	type empRow struct {
		userID  string
		name    string
		compID  string
		monthly float64
		freq    string
	}
	var empQuery string
	var queryArgs []interface{}
	if len(body.UserIDs) > 0 {
		empQuery = `
			SELECT ec.user_id::text, u.name, ec.id::text, ec.monthly_gross, ec.frequency
			FROM employee_compensation ec
			JOIN users u ON u.id = ec.user_id
			WHERE ec.business_id = $1
			  AND (ec.effective_to IS NULL OR ec.effective_to >= CURRENT_DATE)
			  AND ec.user_id = ANY($2::uuid[])
			ORDER BY u.name`
		queryArgs = []interface{}{businessID, body.UserIDs}
	} else {
		empQuery = `
			SELECT DISTINCT ON (ec.user_id)
			       ec.user_id::text, u.name, ec.id::text, ec.monthly_gross, ec.frequency
			FROM employee_compensation ec
			JOIN users u ON u.id = ec.user_id
			WHERE ec.business_id = $1
			  AND (ec.effective_to IS NULL OR ec.effective_to >= CURRENT_DATE)
			  AND u.active = true
			ORDER BY ec.user_id, ec.effective_from DESC`
		queryArgs = []interface{}{businessID}
	}

	erows, err := h.DB.Query(ctx, empQuery, queryArgs...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var emps []empRow
	for erows.Next() {
		var e empRow
		erows.Scan(&e.userID, &e.name, &e.compID, &e.monthly, &e.freq)
		emps = append(emps, e)
	}
	erows.Close()

	// Calculate and insert a line per employee
	var totalGross, totalDed, totalNet, totalEmprCost float64
	for _, emp := range emps {
		// Convert monthly comp to the run frequency
		annual := emp.monthly * 12
		periodGross := FromAnnual(annual, body.Frequency)
		res := CalculateDeductions(periodGross, body.Frequency, cfg)

		_, err = h.DB.Exec(ctx, `
			INSERT INTO payroll_run_lines
			  (run_id, user_id, user_name, compensation_id,
			   base_gross, total_gross,
			   nis_employee, nht_employee, edtax_employee, paye,
			   nis_employer, nht_employer, edtax_employer,
			   total_deductions, net_pay, employer_cost)
			VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
			ON CONFLICT (run_id, user_id) DO NOTHING`,
			run.ID, emp.userID, emp.name, emp.compID,
			r2(periodGross),
			res.NISEmployee, res.NHTEmployee, res.EdTaxEmployee, res.PAYE,
			res.NISEmployer, res.NHTEmployer, res.EdTaxEmployer,
			res.TotalDeductions, res.NetPay, res.TotalEmployerCost,
		)
		if err == nil {
			totalGross += res.GrossPay
			totalDed += res.TotalDeductions
			totalNet += res.NetPay
			totalEmprCost += res.TotalEmployerCost
		}
	}

	// Update run totals
	_, _ = h.DB.Exec(ctx, `
		UPDATE payroll_runs
		SET total_gross=$1, total_deductions=$2, total_net=$3,
		    total_employer_cost=$4, employee_count=$5, status='Calculated', updated_at=NOW()
		WHERE id=$6`,
		r2(totalGross), r2(totalDed), r2(totalNet),
		r2(totalEmprCost), len(emps), run.ID)

	run.Status = "Calculated"
	run.TotalGross = r2(totalGross)
	run.TotalDeductions = r2(totalDed)
	run.TotalNet = r2(totalNet)
	run.TotalEmployerCost = r2(totalEmprCost)
	run.EmployeeCount = len(emps)

	go writeAudit(context.Background(), h.DB, businessID, "payroll_run", run.ID, "created",
		c.GetString("user_id"), c.GetString("user_name"), nil, run, "")
	c.JSON(http.StatusCreated, run)
}

// GetPayrollRun  GET /payroll/runs/:id
func (h *PayrollHandler) GetPayrollRun(c *gin.Context) {
	businessID := c.GetString("business_id")
	runID := c.Param("id")
	var run model.PayrollRun
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT pr.id::text, pr.business_id::text, pr.period_id::text, pr.tax_rule_set_id::text,
		       pr.label, pr.frequency, pr.status,
		       pr.total_gross, pr.total_deductions, pr.total_net, pr.total_employer_cost,
		       pr.employee_count, pr.notes,
		       pr.approved_by::text, pr.approved_at, pr.locked_by::text, pr.locked_at,
		       pr.created_by::text, pr.created_at, pr.updated_at,
		       pp.start_date::text, pp.end_date::text
		FROM payroll_runs pr
		LEFT JOIN payroll_periods pp ON pp.id = pr.period_id
		WHERE pr.id=$1 AND pr.business_id=$2`, runID, businessID,
	).Scan(
		&run.ID, &run.BusinessID, &run.PeriodID, &run.TaxRuleSetID,
		&run.Label, &run.Frequency, &run.Status,
		&run.TotalGross, &run.TotalDeductions, &run.TotalNet, &run.TotalEmployerCost,
		&run.EmployeeCount, &run.Notes,
		&run.ApprovedBy, &run.ApprovedAt, &run.LockedBy, &run.LockedAt,
		&run.CreatedBy, &run.CreatedAt, &run.UpdatedAt,
		&run.PeriodStart, &run.PeriodEnd,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}
	c.JSON(http.StatusOK, run)
}

// ApprovePayrollRun  PATCH /payroll/runs/:id/approve
func (h *PayrollHandler) ApprovePayrollRun(c *gin.Context) {
	h.transitionRun(c, []string{"Calculated"}, "Approved",
		func(runID string) { /* hook: could send approval notification */ })
}

// LockPayrollRun  PATCH /payroll/runs/:id/lock
func (h *PayrollHandler) LockPayrollRun(c *gin.Context) {
	h.transitionRun(c, []string{"Approved"}, "Locked", nil)
}

func (h *PayrollHandler) transitionRun(c *gin.Context, allowedFrom []string, toStatus string, hook func(string)) {
	businessID := c.GetString("business_id")
	runID := c.Param("id")
	ctx := c.Request.Context()

	var currentStatus string
	if err := h.DB.QueryRow(ctx,
		`SELECT status FROM payroll_runs WHERE id=$1 AND business_id=$2`,
		runID, businessID).Scan(&currentStatus); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}
	allowed := false
	for _, s := range allowedFrom {
		if currentStatus == s { allowed = true; break }
	}
	if !allowed {
		c.JSON(http.StatusConflict, gin.H{"error": "invalid status transition from " + currentStatus})
		return
	}

	userID := c.GetString("user_id")
	var col string
	switch toStatus {
	case "Approved": col = ", approved_by=NULLIF($3,'')::uuid, approved_at=NOW()"
	case "Locked":   col = ", locked_by=NULLIF($3,'')::uuid, locked_at=NOW()"
	default:         col = ""
	}

	_, err := h.DB.Exec(ctx,
		`UPDATE payroll_runs SET status=$1, updated_at=NOW()`+col+` WHERE id=$2`,
		toStatus, runID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	go writeAudit(context.Background(), h.DB, businessID, "payroll_run", runID, toStatus,
		userID, c.GetString("user_name"), gin.H{"status": currentStatus}, gin.H{"status": toStatus}, "")
	if hook != nil { hook(runID) }
	c.JSON(http.StatusOK, gin.H{"status": toStatus})
}

// GetRunLines  GET /payroll/runs/:id/lines
func (h *PayrollHandler) GetRunLines(c *gin.Context) {
	businessID := c.GetString("business_id")
	runID := c.Param("id")
	// verify ownership
	var exists bool
	h.DB.QueryRow(c.Request.Context(),
		`SELECT true FROM payroll_runs WHERE id=$1 AND business_id=$2`,
		runID, businessID).Scan(&exists)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, run_id::text, user_id::text, user_name, compensation_id::text,
		       base_gross, overtime_hours, overtime_pay, bonus, other_earnings, total_gross,
		       nis_employee, nht_employee, edtax_employee, paye,
		       nis_employer, nht_employer, edtax_employer,
		       other_deductions, total_deductions, net_pay, employer_cost,
		       is_overridden, override_reason, created_at, updated_at
		FROM payroll_run_lines WHERE run_id=$1 ORDER BY user_name`, runID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var lines []model.PayrollRunLine
	for rows.Next() {
		var l model.PayrollRunLine
		if err := rows.Scan(
			&l.ID, &l.RunID, &l.UserID, &l.UserName, &l.CompensationID,
			&l.BaseGross, &l.OvertimeHours, &l.OvertimePay, &l.Bonus, &l.OtherEarnings, &l.TotalGross,
			&l.NISEmployee, &l.NHTEmployee, &l.EdTaxEmployee, &l.PAYE,
			&l.NISEmployer, &l.NHTEmployer, &l.EdTaxEmployer,
			&l.OtherDeductions, &l.TotalDeductions, &l.NetPay, &l.EmployerCost,
			&l.IsOverridden, &l.OverrideReason, &l.CreatedAt, &l.UpdatedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		lines = append(lines, l)
	}
	if lines == nil { lines = []model.PayrollRunLine{} }
	c.JSON(http.StatusOK, lines)
}

// OverrideRunLine  PATCH /payroll/runs/:id/lines/:lineId
func (h *PayrollHandler) OverrideRunLine(c *gin.Context) {
	businessID := c.GetString("business_id")
	runID := c.Param("id")
	lineID := c.Param("lineId")
	ctx := c.Request.Context()

	var body struct {
		Bonus           float64  `json:"bonus"`
		// OvertimePay: if nil (omitted), the server auto-computes from
		// OvertimeHours × employee HourlyRate × payroll_config.overtime_multiplier.
		// Pass an explicit value to override the computed amount.
		OvertimePay     *float64 `json:"overtime_pay"`
		OvertimeHours   float64  `json:"overtime_hours"`
		OtherEarnings   float64  `json:"other_earnings"`
		OtherDeductions float64  `json:"other_deductions"`
		OverrideReason  *string  `json:"override_reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify run is owned and in mutable state
	var status string
	if err := h.DB.QueryRow(ctx,
		`SELECT status FROM payroll_runs WHERE id=$1 AND business_id=$2`,
		runID, businessID).Scan(&status); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}
	if status == "Locked" || status == "Paid" {
		c.JSON(http.StatusConflict, gin.H{"error": "cannot modify a " + status + " run"})
		return
	}

	taxCfg, _ := LoadActiveTaxConfig(ctx, h.DB, businessID)

	// Load overtime multiplier from payroll_config (default 1.5 if not set)
	var overtimeMultiplier float64 = 1.5
	h.DB.QueryRow(ctx, `SELECT overtime_multiplier FROM payroll_config WHERE business_id=$1`, businessID).Scan(&overtimeMultiplier)

	// Read current line: base gross, frequency, and the employee's hourly rate
	var baseGross, hourlyRate float64
	var runFreq string
	h.DB.QueryRow(ctx, `
		SELECT prl.base_gross, pr.frequency,
		       COALESCE(ec.hourly_rate, 0)
		FROM payroll_run_lines prl
		JOIN payroll_runs pr ON pr.id = prl.run_id
		LEFT JOIN employee_compensation ec
		       ON ec.id = prl.compensation_id
		WHERE prl.id=$1 AND prl.run_id=$2`, lineID, runID,
	).Scan(&baseGross, &runFreq, &hourlyRate)

	// Compute overtime pay: use explicit value if provided, otherwise auto-calculate.
	//   OvertimePay = OvertimeHours × HourlyRate × OvertimeMultiplier
	var resolvedOvertimePay float64
	if body.OvertimePay != nil {
		resolvedOvertimePay = *body.OvertimePay
	} else if body.OvertimeHours > 0 && hourlyRate > 0 {
		resolvedOvertimePay = ComputeOvertimePay(body.OvertimeHours, hourlyRate, overtimeMultiplier)
	}

	totalGross := r2(baseGross + body.Bonus + resolvedOvertimePay + body.OtherEarnings)
	res := CalculateDeductions(totalGross, runFreq, taxCfg)
	netPay := r2(res.NetPay - body.OtherDeductions)
	totalDed := r2(res.TotalDeductions + body.OtherDeductions)

	var line model.PayrollRunLine
	if err := h.DB.QueryRow(ctx, `
		UPDATE payroll_run_lines
		SET bonus=$1, overtime_pay=$2, overtime_hours=$3, other_earnings=$4,
		    other_deductions=$5, total_gross=$6,
		    nis_employee=$7, nht_employee=$8, edtax_employee=$9, paye=$10,
		    nis_employer=$11, nht_employer=$12, edtax_employer=$13,
		    total_deductions=$14, net_pay=$15, employer_cost=$16,
		    is_overridden=true, override_reason=$17, updated_at=NOW()
		WHERE id=$18 AND run_id=$19
		RETURNING id::text, run_id::text, user_id::text, user_name, compensation_id::text,
		          base_gross, overtime_hours, overtime_pay, bonus, other_earnings, total_gross,
		          nis_employee, nht_employee, edtax_employee, paye,
		          nis_employer, nht_employer, edtax_employer,
		          other_deductions, total_deductions, net_pay, employer_cost,
		          is_overridden, override_reason, created_at, updated_at`,
		body.Bonus, resolvedOvertimePay, body.OvertimeHours, body.OtherEarnings,
		body.OtherDeductions, totalGross,
		res.NISEmployee, res.NHTEmployee, res.EdTaxEmployee, res.PAYE,
		res.NISEmployer, res.NHTEmployer, res.EdTaxEmployer,
		totalDed, netPay, res.TotalEmployerCost,
		body.OverrideReason, lineID, runID,
	).Scan(
		&line.ID, &line.RunID, &line.UserID, &line.UserName, &line.CompensationID,
		&line.BaseGross, &line.OvertimeHours, &line.OvertimePay, &line.Bonus, &line.OtherEarnings, &line.TotalGross,
		&line.NISEmployee, &line.NHTEmployee, &line.EdTaxEmployee, &line.PAYE,
		&line.NISEmployer, &line.NHTEmployer, &line.EdTaxEmployer,
		&line.OtherDeductions, &line.TotalDeductions, &line.NetPay, &line.EmployerCost,
		&line.IsOverridden, &line.OverrideReason, &line.CreatedAt, &line.UpdatedAt,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Re-aggregate run totals
	go func() {
		bgctx := context.Background()
		h.DB.Exec(bgctx, `
			UPDATE payroll_runs pr SET
			  total_gross      = (SELECT COALESCE(SUM(total_gross),0)      FROM payroll_run_lines WHERE run_id=pr.id),
			  total_deductions = (SELECT COALESCE(SUM(total_deductions),0)  FROM payroll_run_lines WHERE run_id=pr.id),
			  total_net        = (SELECT COALESCE(SUM(net_pay),0)           FROM payroll_run_lines WHERE run_id=pr.id),
			  total_employer_cost = (SELECT COALESCE(SUM(employer_cost),0)  FROM payroll_run_lines WHERE run_id=pr.id),
			  updated_at=NOW()
			WHERE id=$1`, runID)
	}()

	go writeAudit(context.Background(), h.DB, businessID, "run_line", lineID, "overridden",
		c.GetString("user_id"), c.GetString("user_name"), nil, line, "")
	c.JSON(http.StatusOK, line)
}

// ══════════════════════════════════════════════════════════════════════════════
// Analytics
// ══════════════════════════════════════════════════════════════════════════════

// GetPayrollAnalytics  GET /payroll/analytics
func (h *PayrollHandler) GetPayrollAnalytics(c *gin.Context) {
	businessID := c.GetString("business_id")
	ctx := c.Request.Context()

	// Monthly cost trend — last 12 locked/paid runs
	rows, err := h.DB.Query(ctx, `
		SELECT TO_CHAR(created_at,'YYYY-MM') AS month,
		       SUM(total_gross), SUM(total_net), SUM(employee_count)
		FROM payroll_runs
		WHERE business_id=$1 AND status IN ('Locked','Paid')
		  AND created_at >= NOW() - INTERVAL '12 months'
		GROUP BY 1 ORDER BY 1`, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var monthly []model.MonthlyCostRow
	for rows.Next() {
		var m model.MonthlyCostRow
		rows.Scan(&m.Month, &m.TotalGross, &m.TotalNet, &m.EmployeeCount)
		monthly = append(monthly, m)
	}
	if monthly == nil { monthly = []model.MonthlyCostRow{} }

	// Latest run totals
	var a model.PayrollAnalytics
	a.MonthlyCosts = monthly
	h.DB.QueryRow(ctx, `
		SELECT total_gross, total_net,
		       (SELECT COALESCE(SUM(nis_employee),0)   FROM payroll_run_lines WHERE run_id=pr.id),
		       (SELECT COALESCE(SUM(nht_employee),0)   FROM payroll_run_lines WHERE run_id=pr.id),
		       (SELECT COALESCE(SUM(edtax_employee),0) FROM payroll_run_lines WHERE run_id=pr.id),
		       (SELECT COALESCE(SUM(paye),0)           FROM payroll_run_lines WHERE run_id=pr.id),
		       total_employer_cost, employee_count
		FROM payroll_runs pr
		WHERE business_id=$1 AND status IN ('Locked','Paid')
		ORDER BY created_at DESC LIMIT 1`, businessID,
	).Scan(&a.TotalGross, &a.TotalNet, &a.TotalNIS, &a.TotalNHT,
		&a.TotalEdTax, &a.TotalPAYE, &a.TotalEmployerCost, &a.HeadCount)

	if a.HeadCount > 0 {
		a.AvgSalary = r2(a.TotalGross / float64(a.HeadCount))
	}
	c.JSON(http.StatusOK, a)
}

// GetAuditLog  GET /payroll/audit-log
func (h *PayrollHandler) GetAuditLog(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, entity_type, entity_id, action,
		       actor_id::text, actor_name, before_val, after_val, reason, created_at
		FROM payroll_audit_log
		WHERE business_id=$1
		ORDER BY created_at DESC LIMIT 100`, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var entries []model.PayrollAuditEntry
	for rows.Next() {
		var e model.PayrollAuditEntry
		rows.Scan(&e.ID, &e.EntityType, &e.EntityID, &e.Action,
			&e.ActorID, &e.ActorName, &e.BeforeVal, &e.AfterVal, &e.Reason, &e.CreatedAt)
		entries = append(entries, e)
	}
	if entries == nil { entries = []model.PayrollAuditEntry{} }
	c.JSON(http.StatusOK, entries)
}
