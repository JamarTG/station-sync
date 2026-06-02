package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type HolidayHandler struct {
	DB *pgxpool.Pool
}

// ── Calendar ──────────────────────────────────────────────────────────────────

// GetHolidayCalendar  GET /holidays/calendar?year=2026
// Returns resolved (concrete-date) holidays for the year, including observed days.
func (h *HolidayHandler) GetHolidayCalendar(c *gin.Context) {
	businessID := c.GetString("business_id")
	year, _ := strconv.Atoi(c.DefaultQuery("year", strconv.Itoa(time.Now().Year())))
	if year < 2000 || year > 2100 {
		year = time.Now().Year()
	}
	resolved, err := ResolveHolidaysForYear(c.Request.Context(), h.DB, businessID, year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"year": year, "holidays": resolved})
}

// GetUpcomingHolidays  GET /holidays/upcoming?days=90
// Self-service: next holidays within a window.
func (h *HolidayHandler) GetUpcomingHolidays(c *gin.Context) {
	businessID := c.GetString("business_id")
	days, _ := strconv.Atoi(c.DefaultQuery("days", "90"))
	now := time.Now()

	// Resolve this year and next year, then filter to the window
	all := []model.ResolvedHoliday{}
	for _, y := range []int{now.Year(), now.Year() + 1} {
		r, _ := ResolveHolidaysForYear(c.Request.Context(), h.DB, businessID, y)
		all = append(all, r...)
	}
	cutoff := now.AddDate(0, 0, days)
	upcoming := []model.ResolvedHoliday{}
	for _, hol := range all {
		d, err := time.Parse("2006-01-02", hol.Date)
		if err != nil {
			continue
		}
		if (d.Equal(now) || d.After(now)) && d.Before(cutoff) {
			upcoming = append(upcoming, hol)
		}
	}
	c.JSON(http.StatusOK, upcoming)
}

// ── CRUD for company / emergency holidays ──────────────────────────────────────

// ListHolidays  GET /holidays  (raw rows, for admin management)
func (h *HolidayHandler) ListHolidays(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, business_id::text, name, holiday_date::text, holiday_type,
		       category, rule_key, month_of, day_of, government_source, is_recurring,
		       observed_rule, effective_date::text, expiry_date::text, active, created_at
		FROM holidays
		WHERE business_id IS NULL OR business_id = $1
		ORDER BY business_id NULLS FIRST, COALESCE(month_of, 99), COALESCE(day_of, 99), name`,
		businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var list []model.Holiday
	for rows.Next() {
		var hol model.Holiday
		if err := rows.Scan(&hol.ID, &hol.BusinessID, &hol.Name, &hol.HolidayDate,
			&hol.HolidayType, &hol.Category, &hol.RuleKey, &hol.MonthOf, &hol.DayOf,
			&hol.GovernmentSource, &hol.IsRecurring, &hol.ObservedRule,
			&hol.EffectiveDate, &hol.ExpiryDate, &hol.Active, &hol.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		list = append(list, hol)
	}
	if list == nil {
		list = []model.Holiday{}
	}
	c.JSON(http.StatusOK, list)
}

// CreateHoliday  POST /holidays
// Admins add company or emergency (declared) holidays without code changes.
func (h *HolidayHandler) CreateHoliday(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		Name             string  `json:"name" binding:"required"`
		HolidayDate      *string `json:"holiday_date"` // for declared/emergency
		HolidayType      string  `json:"holiday_type"`
		Category         string  `json:"category"`
		MonthOf          *int    `json:"month_of"`
		DayOf            *int    `json:"day_of"`
		GovernmentSource *string `json:"government_source"`
		IsRecurring      bool    `json:"is_recurring"`
		ObservedRule     string  `json:"observed_rule"`
		ExpiryDate       *string `json:"expiry_date"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.HolidayType == "" {
		body.HolidayType = "company"
	}
	if body.Category == "" {
		if body.HolidayDate != nil {
			body.Category = "declared"
		} else {
			body.Category = "fixed"
		}
	}
	if body.ObservedRule == "" {
		body.ObservedRule = "none"
	}

	var hol model.Holiday
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO holidays
		  (business_id, name, holiday_date, holiday_type, category, month_of, day_of,
		   government_source, is_recurring, observed_rule, expiry_date, created_by)
		VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11::date,NULLIF($12,'')::uuid)
		RETURNING id::text, business_id::text, name, holiday_date::text, holiday_type,
		          category, rule_key, month_of, day_of, government_source, is_recurring,
		          observed_rule, effective_date::text, expiry_date::text, active, created_at`,
		businessID, body.Name, body.HolidayDate, body.HolidayType, body.Category,
		body.MonthOf, body.DayOf, body.GovernmentSource, body.IsRecurring,
		body.ObservedRule, body.ExpiryDate, c.GetString("user_id"),
	).Scan(&hol.ID, &hol.BusinessID, &hol.Name, &hol.HolidayDate, &hol.HolidayType,
		&hol.Category, &hol.RuleKey, &hol.MonthOf, &hol.DayOf, &hol.GovernmentSource,
		&hol.IsRecurring, &hol.ObservedRule, &hol.EffectiveDate, &hol.ExpiryDate,
		&hol.Active, &hol.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, hol)
}

// DeleteHoliday  DELETE /holidays/:id  (only company-owned rows)
func (h *HolidayHandler) DeleteHoliday(c *gin.Context) {
	businessID := c.GetString("business_id")
	id := c.Param("id")
	ct, err := h.DB.Exec(c.Request.Context(),
		`DELETE FROM holidays WHERE id=$1 AND business_id=$2`, id, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if ct.RowsAffected() == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete national holidays"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ── Pay rules ───────────────────────────────────────────────────────────────────

// GetPayRules  GET /holidays/pay-rules
func (h *HolidayHandler) GetPayRules(c *gin.Context) {
	businessID := c.GetString("business_id")
	rules := LoadHolidayPayRules(c.Request.Context(), h.DB, businessID)
	c.JSON(http.StatusOK, rules)
}

// UpsertPayRules  PUT /holidays/pay-rules
func (h *HolidayHandler) UpsertPayRules(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		RegularMultiplier    float64 `json:"regular_multiplier"`
		OvertimeMultiplier   float64 `json:"overtime_multiplier"`
		RestDayMultiplier    float64 `json:"rest_day_multiplier"`
		NightShiftMultiplier float64 `json:"night_shift_multiplier"`
		AbsentPolicy         string  `json:"absent_policy"`
		AbsentPartialPct     float64 `json:"absent_partial_pct"`
		NightShiftStart      int     `json:"night_shift_start"`
		NightShiftEnd        int     `json:"night_shift_end"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.RegularMultiplier <= 0 { body.RegularMultiplier = 2.0 }
	if body.OvertimeMultiplier <= 0 { body.OvertimeMultiplier = 2.5 }
	if body.RestDayMultiplier <= 0 { body.RestDayMultiplier = 2.5 }
	if body.NightShiftMultiplier <= 0 { body.NightShiftMultiplier = 2.25 }
	if body.AbsentPolicy == "" { body.AbsentPolicy = "paid" }

	var r model.HolidayPayRules
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO holiday_pay_rules
		  (business_id, regular_multiplier, overtime_multiplier, rest_day_multiplier,
		   night_shift_multiplier, absent_policy, absent_partial_pct,
		   night_shift_start, night_shift_end)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (business_id) DO UPDATE SET
		  regular_multiplier=$2, overtime_multiplier=$3, rest_day_multiplier=$4,
		  night_shift_multiplier=$5, absent_policy=$6, absent_partial_pct=$7,
		  night_shift_start=$8, night_shift_end=$9, updated_at=NOW()
		RETURNING id::text, business_id::text, regular_multiplier, overtime_multiplier,
		          rest_day_multiplier, night_shift_multiplier, absent_policy,
		          absent_partial_pct, night_shift_start, night_shift_end, created_at, updated_at`,
		businessID, body.RegularMultiplier, body.OvertimeMultiplier, body.RestDayMultiplier,
		body.NightShiftMultiplier, body.AbsentPolicy, body.AbsentPartialPct,
		body.NightShiftStart, body.NightShiftEnd,
	).Scan(&r.ID, &r.BusinessID, &r.RegularMultiplier, &r.OvertimeMultiplier,
		&r.RestDayMultiplier, &r.NightShiftMultiplier, &r.AbsentPolicy,
		&r.AbsentPartialPct, &r.NightShiftStart, &r.NightShiftEnd, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, r)
}

// PreviewHolidayPay  POST /holidays/pay-preview
// Computes a premium-pay breakdown without persisting.
func (h *HolidayHandler) PreviewHolidayPay(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		HolidayName  string  `json:"holiday_name"`
		HolidayDate  string  `json:"holiday_date"`
		BaseHourly   float64 `json:"base_hourly" binding:"required"`
		RegularHours float64 `json:"regular_hours"`
		OvertimeHours float64 `json:"overtime_hours"`
		NightHours   float64 `json:"night_hours"`
		IsRestDay    bool    `json:"is_rest_day"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rules := LoadHolidayPayRules(c.Request.Context(), h.DB, businessID)
	result := CalculateHolidayPay(body.HolidayName, body.HolidayDate,
		body.BaseHourly, body.RegularHours, body.OvertimeHours, body.NightHours,
		body.IsRestDay, rules)
	c.JSON(http.StatusOK, result)
}

// ── Self-service: holiday shift sign-ups ────────────────────────────────────────

// ListSignups  GET /holidays/signups?date=2026-12-25
func (h *HolidayHandler) ListSignups(c *gin.Context) {
	businessID := c.GetString("business_id")
	date := c.Query("date")
	var rows interface{ Next() bool; Scan(...any) error; Close() }
	var err error
	if date != "" {
		rows, err = h.DB.Query(c.Request.Context(), `
			SELECT id::text, business_id::text, branch_id::text, holiday_id::text,
			       holiday_date::text, user_id::text, user_name, assignment, status,
			       swap_with::text, reviewed_by::text, reviewed_at, created_at
			FROM holiday_shift_signups
			WHERE business_id=$1 AND holiday_date=$2::date
			ORDER BY created_at DESC`, businessID, date)
	} else {
		rows, err = h.DB.Query(c.Request.Context(), `
			SELECT id::text, business_id::text, branch_id::text, holiday_id::text,
			       holiday_date::text, user_id::text, user_name, assignment, status,
			       swap_with::text, reviewed_by::text, reviewed_at, created_at
			FROM holiday_shift_signups
			WHERE business_id=$1 AND holiday_date >= CURRENT_DATE
			ORDER BY holiday_date, created_at DESC`, businessID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var list []model.HolidayShiftSignup
	for rows.Next() {
		var s model.HolidayShiftSignup
		rows.Scan(&s.ID, &s.BusinessID, &s.BranchID, &s.HolidayID, &s.HolidayDate,
			&s.UserID, &s.UserName, &s.Assignment, &s.Status, &s.SwapWith,
			&s.ReviewedBy, &s.ReviewedAt, &s.CreatedAt)
		list = append(list, s)
	}
	if list == nil {
		list = []model.HolidayShiftSignup{}
	}
	c.JSON(http.StatusOK, list)
}

// CreateSignup  POST /holidays/signups   (volunteer / assign / request swap)
func (h *HolidayHandler) CreateSignup(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		HolidayID   *string `json:"holiday_id"`
		HolidayDate string  `json:"holiday_date" binding:"required"`
		UserID      string  `json:"user_id"`
		UserName    string  `json:"user_name"`
		Assignment  string  `json:"assignment"`
		SwapWith    *string `json:"swap_with"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.UserID == "" {
		body.UserID = c.GetString("user_id") // self-volunteer
	}
	if body.Assignment == "" {
		body.Assignment = "voluntary"
	}
	// Mandatory assignments are pre-approved; voluntary/swap need review
	status := "requested"
	if body.Assignment == "mandatory" {
		status = "approved"
	}
	branchID := c.GetString("branch_id")
	var nullBranch interface{}
	if branchID != "" {
		nullBranch = branchID
	}

	var s model.HolidayShiftSignup
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO holiday_shift_signups
		  (business_id, branch_id, holiday_id, holiday_date, user_id, user_name,
		   assignment, status, swap_with)
		VALUES ($1,$2,$3::uuid,$4::date,$5,$6,$7,$8,$9::uuid)
		ON CONFLICT (holiday_date, user_id) DO UPDATE SET
		  assignment=$7, status=$8, swap_with=$9::uuid
		RETURNING id::text, business_id::text, branch_id::text, holiday_id::text,
		          holiday_date::text, user_id::text, user_name, assignment, status,
		          swap_with::text, reviewed_by::text, reviewed_at, created_at`,
		businessID, nullBranch, body.HolidayID, body.HolidayDate, body.UserID,
		body.UserName, body.Assignment, status, body.SwapWith,
	).Scan(&s.ID, &s.BusinessID, &s.BranchID, &s.HolidayID, &s.HolidayDate,
		&s.UserID, &s.UserName, &s.Assignment, &s.Status, &s.SwapWith,
		&s.ReviewedBy, &s.ReviewedAt, &s.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, s)
}

// ReviewSignup  PATCH /holidays/signups/:id   (approve / reject)
func (h *HolidayHandler) ReviewSignup(c *gin.Context) {
	businessID := c.GetString("business_id")
	id := c.Param("id")
	var body struct {
		Status string `json:"status" binding:"required"` // approved | rejected | cancelled
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var s model.HolidayShiftSignup
	err := h.DB.QueryRow(c.Request.Context(), `
		UPDATE holiday_shift_signups
		SET status=$1, reviewed_by=NULLIF($2,'')::uuid, reviewed_at=NOW()
		WHERE id=$3 AND business_id=$4
		RETURNING id::text, business_id::text, branch_id::text, holiday_id::text,
		          holiday_date::text, user_id::text, user_name, assignment, status,
		          swap_with::text, reviewed_by::text, reviewed_at, created_at`,
		body.Status, c.GetString("user_id"), id, businessID,
	).Scan(&s.ID, &s.BusinessID, &s.BranchID, &s.HolidayID, &s.HolidayDate,
		&s.UserID, &s.UserName, &s.Assignment, &s.Status, &s.SwapWith,
		&s.ReviewedBy, &s.ReviewedAt, &s.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "signup not found"})
		return
	}
	c.JSON(http.StatusOK, s)
}

// ── Labour cost forecast ────────────────────────────────────────────────────────

// GetHolidayForecast  GET /holidays/forecast?date=2026-12-25
// Projects labour cost & staffing gap for a holiday, per branch.
func (h *HolidayHandler) GetHolidayForecast(c *gin.Context) {
	businessID := c.GetString("business_id")
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date query param required"})
		return
	}
	ctx := c.Request.Context()
	rules := LoadHolidayPayRules(ctx, h.DB, businessID)

	holidayName := "Holiday"
	if d, err := time.Parse("2006-01-02", date); err == nil {
		if ok, name, _ := IsHoliday(ctx, h.DB, businessID, d); ok {
			holidayName = name
		}
	}

	// Per-branch: average daily staff (from compensation/active employees) +
	// average hourly rate → estimate premium cost.
	rows, err := h.DB.Query(ctx, `
		SELECT b.id::text, b.name,
		       COUNT(DISTINCT u.id) AS active_staff,
		       COALESCE(AVG(ec.hourly_rate), 0) AS avg_hourly
		FROM branches b
		LEFT JOIN users u ON u.branch_id = b.id AND u.active = true
		LEFT JOIN employee_compensation ec ON ec.user_id = u.id
		     AND (ec.effective_to IS NULL OR ec.effective_to >= CURRENT_DATE)
		WHERE b.business_id = $1
		GROUP BY b.id, b.name
		ORDER BY b.name`, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var forecasts []model.HolidayForecast
	for rows.Next() {
		var branchID, branchName string
		var activeStaff int
		var avgHourly float64
		rows.Scan(&branchID, &branchName, &activeStaff, &avgHourly)
		if avgHourly == 0 {
			avgHourly = 500 // conservative JMD default for forecasting
		}

		// Count volunteers/assignments already in place for this holiday+branch
		var scheduled int
		h.DB.QueryRow(ctx, `
			SELECT COUNT(*) FROM holiday_shift_signups
			WHERE business_id=$1 AND branch_id=$2::uuid AND holiday_date=$3::date
			  AND status='approved'`, businessID, branchID, date,
		).Scan(&scheduled)

		// Forecast demand = ~60% of active staff (heuristic; holidays need partial coverage)
		demand := (activeStaff*6 + 9) / 10
		if demand < 1 && activeStaff > 0 {
			demand = 1
		}
		gap := demand - scheduled

		const shiftHours = 8.0
		regularCost := float64(scheduled) * shiftHours * avgHourly
		premiumCost := float64(scheduled) * shiftHours * avgHourly * (rules.RegularMultiplier - 1)
		// Assume ~10% of holiday hours run into overtime
		otCost := float64(scheduled) * shiftHours * 0.10 * avgHourly * rules.OvertimeMultiplier
		total := regularCost + premiumCost + otCost

		forecasts = append(forecasts, model.HolidayForecast{
			HolidayName:       holidayName,
			HolidayDate:       date,
			BranchID:          &branchID,
			BranchName:        branchName,
			ScheduledStaff:    scheduled,
			ForecastDemand:    demand,
			StaffingGap:       gap,
			IsUnderstaffed:    gap > 0,
			EstRegularCost:    r2(regularCost),
			EstPremiumCost:    r2(premiumCost),
			EstOvertimeCost:   r2(otCost),
			EstTotalLaborCost: r2(total),
		})
	}
	if forecasts == nil {
		forecasts = []model.HolidayForecast{}
	}
	c.JSON(http.StatusOK, gin.H{"holiday_name": holidayName, "date": date, "forecasts": forecasts})
}

// ── Analytics ───────────────────────────────────────────────────────────────────

// GetHolidayAnalytics  GET /holidays/analytics?year=2026
// Holiday labour cost, attendance, revenue vs labour per holiday (past holidays).
func (h *HolidayHandler) GetHolidayAnalytics(c *gin.Context) {
	businessID := c.GetString("business_id")
	year, _ := strconv.Atoi(c.DefaultQuery("year", strconv.Itoa(time.Now().Year())))
	ctx := c.Request.Context()

	resolved, _ := ResolveHolidaysForYear(ctx, h.DB, businessID, year)
	var analytics []model.HolidayAnalytics

	for _, hol := range resolved {
		d, err := time.Parse("2006-01-02", hol.Date)
		if err != nil || d.After(time.Now()) {
			continue // only past holidays have actuals
		}

		// Staff who worked (attendance on the holiday date) + sales revenue
		var staffWorked int
		var revenue float64
		h.DB.QueryRow(ctx, `
			SELECT COUNT(DISTINCT sa.user_id)
			FROM shift_attendance sa
			JOIN shifts s ON s.id = sa.shift_id
			WHERE s.business_id=$1 AND s.date=$2::date`, businessID, hol.Date,
		).Scan(&staffWorked)

		h.DB.QueryRow(ctx, `
			SELECT COALESCE(SUM(d.amount),0)
			FROM deposits d JOIN shifts s ON s.id=d.shift_id
			WHERE s.business_id=$1 AND s.date=$2::date AND d.type='Sale'`,
			businessID, hol.Date,
		).Scan(&revenue)

		// Normal-weekday baseline revenue (same weekday, prior 4 weeks)
		var normalRev float64
		h.DB.QueryRow(ctx, `
			SELECT COALESCE(AVG(daily),0) FROM (
			  SELECT SUM(d.amount) AS daily
			  FROM deposits d JOIN shifts s ON s.id=d.shift_id
			  WHERE s.business_id=$1 AND d.type='Sale'
			    AND s.date BETWEEN $2::date - INTERVAL '28 days' AND $2::date - INTERVAL '1 day'
			    AND EXTRACT(DOW FROM s.date) = EXTRACT(DOW FROM $2::date)
			  GROUP BY s.date
			) t`, businessID, hol.Date,
		).Scan(&normalRev)

		var scheduled int
		h.DB.QueryRow(ctx, `
			SELECT COUNT(*) FROM holiday_shift_signups
			WHERE business_id=$1 AND holiday_date=$2::date AND status='approved'`,
			businessID, hol.Date,
		).Scan(&scheduled)
		if scheduled == 0 {
			scheduled = staffWorked
		}

		rules := LoadHolidayPayRules(ctx, h.DB, businessID)
		var avgHourly float64 = 500
		h.DB.QueryRow(ctx, `SELECT COALESCE(AVG(hourly_rate),500) FROM employee_compensation
			WHERE business_id=$1 AND (effective_to IS NULL OR effective_to >= $2::date)`,
			businessID, hol.Date).Scan(&avgHourly)

		laborCost := float64(staffWorked) * 8 * avgHourly * rules.RegularMultiplier
		premiumCost := float64(staffWorked) * 8 * avgHourly * (rules.RegularMultiplier - 1)

		a := model.HolidayAnalytics{
			HolidayName:    hol.Name,
			HolidayDate:    hol.Date,
			TotalLaborCost: r2(laborCost),
			PremiumCost:    r2(premiumCost),
			StaffWorked:    staffWorked,
			StaffScheduled: scheduled,
			TotalRevenue:   r2(revenue),
		}
		if scheduled > 0 {
			a.AttendanceRate = r2(float64(staffWorked) / float64(scheduled) * 100)
		}
		if revenue > 0 {
			a.RevenueVsLaborPct = r2(laborCost / revenue * 100)
		}
		if normalRev > 0 {
			a.VsNormalDayPct = r2((revenue - normalRev) / normalRev * 100)
		}
		analytics = append(analytics, a)
	}
	if analytics == nil {
		analytics = []model.HolidayAnalytics{}
	}
	c.JSON(http.StatusOK, analytics)
}

// ── AI Holiday Intelligence ─────────────────────────────────────────────────────

// GetHolidayInsights  GET /holidays/insights
func (h *HolidayHandler) GetHolidayInsights(c *gin.Context) {
	businessID := c.GetString("business_id")
	ctx := c.Request.Context()
	now := time.Now()

	insight := model.HolidayInsight{
		Period:      "this_month",
		Headlines:   []string{},
		Projections: []string{},
		Warnings:    []string{},
		GeneratedAt: now.Format(time.RFC3339),
	}

	// Upcoming holidays this month
	resolved, _ := ResolveHolidaysForYear(ctx, h.DB, businessID, now.Year())
	rules := LoadHolidayPayRules(ctx, h.DB, businessID)
	monthEnd := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 1, 0)

	for _, hol := range resolved {
		d, err := time.Parse("2006-01-02", hol.Date)
		if err != nil || d.Before(now) || d.After(monthEnd) {
			continue
		}
		// Staffing check
		var scheduled, activeStaff int
		h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM holiday_shift_signups
			WHERE business_id=$1 AND holiday_date=$2::date AND status='approved'`,
			businessID, hol.Date).Scan(&scheduled)
		h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE business_id=$1 AND active=true`,
			businessID).Scan(&activeStaff)

		demand := (activeStaff*6 + 9) / 10
		if demand > 0 && scheduled < demand {
			shortPct := r2(float64(demand-scheduled) / float64(demand) * 100)
			insight.Warnings = append(insight.Warnings,
				generateHolidayHeadline("%s staffing is currently %.0f%% below forecasted demand (%d of %d slots filled).",
					hol.Name, shortPct, scheduled, demand))
		}
		insight.Headlines = append(insight.Headlines,
			generateHolidayHeadline("%s falls on %s — premium rate %.1f× applies to all worked hours.",
				hol.Name, hol.Weekday, rules.RegularMultiplier))
	}

	// Projected premium cost uplift vs a normal month
	if len(insight.Headlines) > 0 {
		insight.Projections = append(insight.Projections,
			generateHolidayHeadline("With %d holiday(s) this month, projected labour cost includes a %.0f%% premium uplift on worked holiday hours.",
				len(insight.Headlines), (rules.RegularMultiplier-1)*100))
	} else {
		insight.Headlines = append(insight.Headlines, "No public holidays fall within the current month.")
	}

	c.JSON(http.StatusOK, insight)
}

// ── Compliance ──────────────────────────────────────────────────────────────────

// GetComplianceAlerts  GET /holidays/compliance?year=2026
// Flags holidays where staff worked but no approved signup / premium policy gap.
func (h *HolidayHandler) GetComplianceAlerts(c *gin.Context) {
	businessID := c.GetString("business_id")
	year, _ := strconv.Atoi(c.DefaultQuery("year", strconv.Itoa(time.Now().Year())))
	ctx := c.Request.Context()

	resolved, _ := ResolveHolidaysForYear(ctx, h.DB, businessID, year)
	alerts := []model.HolidayComplianceAlert{}

	for _, hol := range resolved {
		d, err := time.Parse("2006-01-02", hol.Date)
		if err != nil || d.After(time.Now()) {
			continue
		}
		// Employees who worked the holiday but have no approved holiday signup
		rows, _ := h.DB.Query(ctx, `
			SELECT DISTINCT sa.user_id::text, u.name
			FROM shift_attendance sa
			JOIN shifts s ON s.id=sa.shift_id
			JOIN users u ON u.id=sa.user_id
			WHERE s.business_id=$1 AND s.date=$2::date
			  AND NOT EXISTS (
			    SELECT 1 FROM holiday_shift_signups hss
			    WHERE hss.user_id=sa.user_id AND hss.holiday_date=$2::date
			      AND hss.status='approved')`, businessID, hol.Date)
		if rows != nil {
			for rows.Next() {
				var uid, uname string
				rows.Scan(&uid, &uname)
				eid := uid
				alerts = append(alerts, model.HolidayComplianceAlert{
					HolidayDate:  hol.Date,
					HolidayName:  hol.Name,
					AlertType:    "missing_premium",
					Severity:     "warning",
					EmployeeID:   &eid,
					EmployeeName: uname,
					Message:      uname + " worked " + hol.Name + " without an approved holiday assignment — verify premium pay was applied.",
				})
			}
			rows.Close()
		}
	}
	c.JSON(http.StatusOK, alerts)
}
