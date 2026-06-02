package model

import "time"

// ═══════════════════════════════════════════════════════════════════════════════
// Jamaican Holiday Management & Premium Pay — Models
// ═══════════════════════════════════════════════════════════════════════════════

// Holiday is a single entry in the holiday calendar.
//
// Holiday types:
//   public    — government-declared statutory holiday
//   observed  — weekend holiday shifted to a weekday (auto-generated)
//   company   — custom company holiday
//   emergency — one-time government-declared holiday
//
// Categories:
//   fixed     — same calendar date each year (month_of/day_of)
//   variable  — computed each year (Easter-based; rule_key drives the engine)
//   declared  — one-off explicit date (holiday_date)
type Holiday struct {
	ID               string    `json:"id"`
	BusinessID       *string   `json:"business_id"` // NULL = national (shared)
	Name             string    `json:"name"`
	HolidayDate      *string   `json:"holiday_date"` // resolved YYYY-MM-DD
	HolidayType      string    `json:"holiday_type"`
	Category         string    `json:"category"`
	RuleKey          *string   `json:"rule_key"`
	MonthOf          *int      `json:"month_of"`
	DayOf            *int      `json:"day_of"`
	GovernmentSource *string   `json:"government_source"`
	IsRecurring      bool      `json:"is_recurring"`
	ObservedRule     string    `json:"observed_rule"`
	EffectiveDate    string    `json:"effective_date"`
	ExpiryDate       *string   `json:"expiry_date"`
	Active           bool      `json:"active"`
	CreatedBy        *string   `json:"created_by"`
	CreatedAt        time.Time `json:"created_at"`
}

// ResolvedHoliday is a holiday materialised to a concrete date for a given year,
// including any observed (weekend-shift) replacement day.
type ResolvedHoliday struct {
	Name         string  `json:"name"`
	Date         string  `json:"date"`          // actual gazetted date (YYYY-MM-DD)
	ObservedDate *string `json:"observed_date"` // shifted date if it fell on a weekend
	HolidayType  string  `json:"holiday_type"`
	Category     string  `json:"category"`
	RuleKey      string  `json:"rule_key"`
	Weekday      string  `json:"weekday"`
	IsWeekend    bool    `json:"is_weekend"`
}

// HolidayPayRules holds per-business configurable premium multipliers.
//
// Premium pay formulas (H = base hourly rate):
//
//   Worked-holiday regular:   pay = hours      × H × regular_multiplier
//   Worked-holiday overtime:  pay = ot_hours   × H × overtime_multiplier
//   Rest-day holiday:         pay = hours      × H × rest_day_multiplier
//   Night-shift holiday:      pay = night_hrs  × H × night_shift_multiplier
//
// Holiday Total = Regular Holiday Pay + Holiday OT + Night Premium
type HolidayPayRules struct {
	ID                    string    `json:"id"`
	BusinessID            string    `json:"business_id"`
	RegularMultiplier     float64   `json:"regular_multiplier"`
	OvertimeMultiplier    float64   `json:"overtime_multiplier"`
	RestDayMultiplier     float64   `json:"rest_day_multiplier"`
	NightShiftMultiplier  float64   `json:"night_shift_multiplier"`
	AbsentPolicy          string    `json:"absent_policy"` // paid | unpaid | partial
	AbsentPartialPct      float64   `json:"absent_partial_pct"`
	NightShiftStart       int       `json:"night_shift_start"`
	NightShiftEnd         int       `json:"night_shift_end"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// HolidayShiftSignup is a voluntary / mandatory / swap holiday shift record.
type HolidayShiftSignup struct {
	ID          string    `json:"id"`
	BusinessID  string    `json:"business_id"`
	BranchID    *string   `json:"branch_id"`
	HolidayID   *string   `json:"holiday_id"`
	HolidayDate string    `json:"holiday_date"`
	UserID      string    `json:"user_id"`
	UserName    string    `json:"user_name"`
	Assignment  string    `json:"assignment"` // voluntary | mandatory | swap
	Status      string    `json:"status"`     // requested | approved | rejected | cancelled
	SwapWith    *string   `json:"swap_with"`
	ReviewedBy  *string   `json:"reviewed_by"`
	ReviewedAt  *time.Time `json:"reviewed_at"`
	CreatedAt   time.Time `json:"created_at"`
}

// ─── Premium pay calculation result ────────────────────────────────────────────

// HolidayPayResult is the breakdown for one employee working one holiday.
type HolidayPayResult struct {
	HolidayName     string  `json:"holiday_name"`
	HolidayDate     string  `json:"holiday_date"`
	BaseHourlyRate  float64 `json:"base_hourly_rate"`
	RegularHours    float64 `json:"regular_hours"`
	OvertimeHours   float64 `json:"overtime_hours"`
	NightHours      float64 `json:"night_hours"`
	IsRestDay       bool    `json:"is_rest_day"`

	RegularPay      float64 `json:"regular_pay"`       // hours × H (the base they'd earn anyway)
	HolidayPremium  float64 `json:"holiday_premium"`   // extra premium over base
	HolidayOvertime float64 `json:"holiday_overtime"`  // OT premium
	NightPremium    float64 `json:"night_premium"`
	HolidayTotal    float64 `json:"holiday_total"`     // grand total earnings for the holiday
	MultiplierUsed  float64 `json:"multiplier_used"`
}

// ─── Labour cost forecast ───────────────────────────────────────────────────────

// HolidayForecast projects labour cost for an upcoming holiday.
type HolidayForecast struct {
	HolidayName       string  `json:"holiday_name"`
	HolidayDate       string  `json:"holiday_date"`
	BranchID          *string `json:"branch_id"`
	BranchName        string  `json:"branch_name"`
	ScheduledStaff    int     `json:"scheduled_staff"`
	ForecastDemand    int     `json:"forecast_demand"`     // expected staff needed
	StaffingGap       int     `json:"staffing_gap"`        // demand − scheduled
	IsUnderstaffed    bool    `json:"is_understaffed"`
	EstRegularCost    float64 `json:"est_regular_cost"`
	EstPremiumCost    float64 `json:"est_premium_cost"`
	EstOvertimeCost   float64 `json:"est_overtime_cost"`
	EstTotalLaborCost float64 `json:"est_total_labor_cost"`
}

// ─── Analytics ──────────────────────────────────────────────────────────────────

type HolidayAnalytics struct {
	HolidayName       string  `json:"holiday_name"`
	HolidayDate       string  `json:"holiday_date"`
	TotalLaborCost    float64 `json:"total_labor_cost"`
	PremiumCost       float64 `json:"premium_cost"`
	OvertimeCost      float64 `json:"overtime_cost"`
	StaffWorked       int     `json:"staff_worked"`
	StaffScheduled    int     `json:"staff_scheduled"`
	AttendanceRate    float64 `json:"attendance_rate"`   // worked / scheduled × 100
	TotalRevenue      float64 `json:"total_revenue"`
	RevenueVsLaborPct float64 `json:"revenue_vs_labor_pct"` // labor / revenue × 100
	VsNormalDayPct    float64 `json:"vs_normal_day_pct"`    // revenue uplift vs normal weekday
}

// ─── Compliance ─────────────────────────────────────────────────────────────────

type HolidayComplianceAlert struct {
	ID          string  `json:"id"`
	HolidayDate string  `json:"holiday_date"`
	HolidayName string  `json:"holiday_name"`
	AlertType   string  `json:"alert_type"`   // underpaid | missing_premium | unpaid_absence | understaffed
	Severity    string  `json:"severity"`     // info | warning | critical
	EmployeeID  *string `json:"employee_id"`
	EmployeeName string `json:"employee_name"`
	Message     string  `json:"message"`
	ExpectedPay *float64 `json:"expected_pay"`
	ActualPay   *float64 `json:"actual_pay"`
}

// ─── AI intelligence ──────────────────────────────────────────────────────────

type HolidayInsight struct {
	Period      string   `json:"period"`
	Headlines   []string `json:"headlines"`   // human-readable insight statements
	Projections []string `json:"projections"`
	Warnings    []string `json:"warnings"`
	GeneratedAt string   `json:"generated_at"`
}
