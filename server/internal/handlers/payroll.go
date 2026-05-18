package handlers

import (
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

// Jamaican statutory deduction rates — FY 2025/26 (verify annually with TAJ)
const (
	nisEmpRate     = 0.03
	nisAnnualCap   = 5_000_000.00              // NIS contribution ceiling per year
	nisMonthlyMax  = nisAnnualCap * nisEmpRate / 12 // ~$12,500/month
	nhtEmpRate     = 0.02
	edTaxEmpRate   = 0.0225
	payeThreshold  = 149948.00  // monthly personal income threshold (J$1,799,376 / 12)
	payeRate1      = 0.25
	payeRate2      = 0.30
	payeBracket    = 500000.00  // monthly taxable income where 30% kicks in
)

func calcDeductions(gross float64) (nis, nht, edTax, paye float64) {
	nis = math.Min(gross*nisEmpRate, nisMonthlyMax)
	nht = gross * nhtEmpRate
	// Ed Tax is on statutory income (gross minus NIS)
	edTax = (gross - nis) * edTaxEmpRate

	taxable := gross - payeThreshold
	if taxable <= 0 {
		paye = 0
	} else if taxable <= payeBracket {
		paye = taxable * payeRate1
	} else {
		paye = payeBracket*payeRate1 + (taxable-payeBracket)*payeRate2
	}

	return math.Round(nis*100)/100,
		math.Round(nht*100)/100,
		math.Round(edTax*100)/100,
		math.Round(paye*100)/100
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
		StartDate string `json:"start_date" binding:"required"`
		EndDate   string `json:"end_date" binding:"required"`
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

	// Fetch active employees with pay configured
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
