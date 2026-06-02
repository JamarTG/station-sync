package model

import "time"

// ─── Existing types ────────────────────────────────────────────────────────────

type PayrollPeriodStatus string

const (
	PeriodDraft     PayrollPeriodStatus = "Draft"
	PeriodPublished PayrollPeriodStatus = "Published"
)

type PayrollPeriod struct {
	ID        string              `db:"id"         json:"id"`
	StartDate time.Time           `db:"start_date" json:"start_date"`
	EndDate   time.Time           `db:"end_date"   json:"end_date"`
	Status    PayrollPeriodStatus `db:"status"     json:"status"`
	CreatedAt time.Time           `db:"created_at" json:"created_at"`
}

type PayrollRecord struct {
	ID              string    `db:"id"               json:"id"`
	PeriodID        string    `db:"period_id"        json:"period_id"`
	PeriodStartDate time.Time `db:"period_start_date" json:"period_start_date"`
	PeriodEndDate   time.Time `db:"period_end_date"  json:"period_end_date"`
	PeriodStatus    string    `db:"period_status"    json:"period_status"`
	UserID          string    `db:"user_id"          json:"user_id"`
	UserName        string    `db:"user_name"        json:"user_name"`
	UserRole        string    `db:"user_role"        json:"user_role"`
	GrossPay        float64   `db:"gross_pay"        json:"gross_pay"`
	NIS             float64   `db:"nis"              json:"nis"`
	NHT             float64   `db:"nht"              json:"nht"`
	EdTax           float64   `db:"ed_tax"           json:"ed_tax"`
	PAYE            float64   `db:"paye"             json:"paye"`
	NetPay          float64   `db:"net_pay"          json:"net_pay"`
	HoursWorked     *float64  `db:"hours_worked"     json:"hours_worked"`
	Overage         float64   `db:"overage"          json:"overage"`
	Shortage        float64   `db:"shortage"         json:"shortage"`
	CreatedAt       time.Time `db:"created_at"       json:"created_at"`
}

// ─── Payroll Config ───────────────────────────────────────────────────────────

type PayrollConfig struct {
	ID         string    `json:"id"`
	BusinessID string    `json:"business_id"`
	Frequency  string    `json:"frequency"`
	PayDay     *int      `json:"pay_day"`
	Currency   string    `json:"currency"`
	// Overtime multipliers (configurable, never hardcoded)
	// Standard JA: 1.5× for weekday overtime, 2.0× for public holidays / Sundays.
	// Formula: OvertimePay = OvertimeHours × HourlyRate × OvertimeMultiplier
	OvertimeMultiplier   float64   `json:"overtime_multiplier"`
	DoubleTimeMultiplier float64   `json:"double_time_multiplier"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// ─── Tax Rule Sets & Rules ─────────────────────────────────────────────────────

type TaxRuleSet struct {
	ID            string     `json:"id"`
	BusinessID    string     `json:"business_id"`
	Name          string     `json:"name"`
	EffectiveFrom string     `json:"effective_from"`
	EffectiveTo   *string    `json:"effective_to"`
	IsActive      bool       `json:"is_active"`
	CreatedBy     *string    `json:"created_by"`
	CreatedAt     time.Time  `json:"created_at"`
	Rules         []TaxRule  `json:"rules,omitempty"`
}

type TaxRule struct {
	ID         string   `json:"id"`
	RuleSetID  string   `json:"rule_set_id"`
	TaxType    string   `json:"tax_type"`    // NIS | NHT | EDTAX | PAYE_L1 | PAYE_L2
	Rate       float64  `json:"rate"`        // e.g. 0.03
	Threshold  *float64 `json:"threshold"`   // annual income threshold
	UpperLimit *float64 `json:"upper_limit"` // annual upper bracket limit
	AnnualCap  *float64 `json:"annual_cap"`  // NIS max insurable earnings
	Basis      string   `json:"basis"`       // gross | statutory | taxable
	AppliesTo  string   `json:"applies_to"`  // employee | employer | both
	CreatedAt  time.Time `json:"created_at"`
}

// ─── Employee Compensation ────────────────────────────────────────────────────

type EmployeeCompensation struct {
	ID            string    `json:"id"`
	BusinessID    string    `json:"business_id"`
	UserID        string    `json:"user_id"`
	UserName      string    `json:"user_name,omitempty"`
	UserRole      string    `json:"user_role,omitempty"`
	EffectiveFrom string    `json:"effective_from"`
	EffectiveTo   *string   `json:"effective_to"`
	Frequency     string    `json:"frequency"`
	PayType       string    `json:"pay_type"`
	EnteredAmount float64   `json:"entered_amount"`
	IsAfterTax    bool      `json:"is_after_tax"`
	AnnualGross   float64   `json:"annual_gross"`
	MonthlyGross  float64   `json:"monthly_gross"`
	WeeklyGross   float64   `json:"weekly_gross"`
	DailyRate     float64   `json:"daily_rate"`
	HourlyRate    float64   `json:"hourly_rate"`
	Notes         *string   `json:"notes"`
	CreatedBy     *string   `json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
}

// SalaryPreviewRequest is the body sent to POST /payroll/salary-preview.
type SalaryPreviewRequest struct {
	EnteredAmount float64 `json:"entered_amount" binding:"required"`
	Frequency     string  `json:"frequency"      binding:"required"`
	IsAfterTax    bool    `json:"is_after_tax"`
	PayType       string  `json:"pay_type"`
}

// SalaryPreview is the full breakdown returned by the preview endpoint.
type SalaryPreview struct {
	// Input
	EnteredAmount float64 `json:"entered_amount"`
	Frequency     string  `json:"frequency"`
	IsAfterTax    bool    `json:"is_after_tax"`

	// Gross equivalents
	AnnualGross  float64 `json:"annual_gross"`
	MonthlyGross float64 `json:"monthly_gross"`
	WeeklyGross  float64 `json:"weekly_gross"`
	DailyRate    float64 `json:"daily_rate"`
	HourlyRate   float64 `json:"hourly_rate"`

	// Monthly deduction breakdown (for display)
	NISEmployee   float64 `json:"nis_employee"`
	NHTEmployee   float64 `json:"nht_employee"`
	EdTaxEmployee float64 `json:"edtax_employee"`
	PAYE          float64 `json:"paye"`
	NetPay        float64 `json:"net_pay"` // monthly net
	EffectiveRate float64 `json:"effective_rate_pct"`

	// Employer monthly cost
	NISEmployer   float64 `json:"nis_employer"`
	NHTEmployer   float64 `json:"nht_employer"`
	EdTaxEmployer float64 `json:"edtax_employer"`
	TotalEmployerCost float64 `json:"total_employer_cost"`

	// If is_after_tax: show the reverse-calculated gross
	RequiredGross *float64 `json:"required_gross,omitempty"`
}

// ─── Payroll Runs ──────────────────────────────────────────────────────────────

type PayrollRun struct {
	ID              string     `json:"id"`
	BusinessID      string     `json:"business_id"`
	PeriodID        *string    `json:"period_id"`
	TaxRuleSetID    *string    `json:"tax_rule_set_id"`
	Label           string     `json:"label"`
	Frequency       string     `json:"frequency"`
	Status          string     `json:"status"`
	TotalGross      float64    `json:"total_gross"`
	TotalDeductions float64    `json:"total_deductions"`
	TotalNet        float64    `json:"total_net"`
	TotalEmployerCost float64  `json:"total_employer_cost"`
	EmployeeCount   int        `json:"employee_count"`
	Notes           *string    `json:"notes"`
	ApprovedBy      *string    `json:"approved_by"`
	ApprovedAt      *time.Time `json:"approved_at"`
	LockedBy        *string    `json:"locked_by"`
	LockedAt        *time.Time `json:"locked_at"`
	CreatedBy       *string    `json:"created_by"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	// Joined
	PeriodStart *string `json:"period_start,omitempty"`
	PeriodEnd   *string `json:"period_end,omitempty"`
}

type PayrollRunLine struct {
	ID              string    `json:"id"`
	RunID           string    `json:"run_id"`
	UserID          string    `json:"user_id"`
	UserName        string    `json:"user_name"`
	CompensationID  *string   `json:"compensation_id"`
	BaseGross       float64   `json:"base_gross"`
	OvertimeHours   float64   `json:"overtime_hours"`
	OvertimePay     float64   `json:"overtime_pay"`
	Bonus           float64   `json:"bonus"`
	OtherEarnings   float64   `json:"other_earnings"`
	TotalGross      float64   `json:"total_gross"`
	NISEmployee     float64   `json:"nis_employee"`
	NHTEmployee     float64   `json:"nht_employee"`
	EdTaxEmployee   float64   `json:"edtax_employee"`
	PAYE            float64   `json:"paye"`
	NISEmployer     float64   `json:"nis_employer"`
	NHTEmployer     float64   `json:"nht_employer"`
	EdTaxEmployer   float64   `json:"edtax_employer"`
	OtherDeductions float64   `json:"other_deductions"`
	TotalDeductions float64   `json:"total_deductions"`
	NetPay          float64   `json:"net_pay"`
	EmployerCost    float64   `json:"employer_cost"`
	IsOverridden    bool      `json:"is_overridden"`
	OverrideReason  *string   `json:"override_reason"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// ─── Audit Log ─────────────────────────────────────────────────────────────────

type PayrollAuditEntry struct {
	ID         string      `json:"id"`
	BusinessID string      `json:"business_id"`
	EntityType string      `json:"entity_type"`
	EntityID   string      `json:"entity_id"`
	Action     string      `json:"action"`
	ActorID    *string     `json:"actor_id"`
	ActorName  string      `json:"actor_name"`
	BeforeVal  interface{} `json:"before_val"`
	AfterVal   interface{} `json:"after_val"`
	Reason     *string     `json:"reason"`
	CreatedAt  time.Time   `json:"created_at"`
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

type PayrollAnalytics struct {
	// Cost by month (last 12 months)
	MonthlyCosts []MonthlyCostRow `json:"monthly_costs"`
	// Current period breakdown
	TotalGross         float64 `json:"total_gross"`
	TotalNet           float64 `json:"total_net"`
	TotalNIS           float64 `json:"total_nis"`
	TotalNHT           float64 `json:"total_nht"`
	TotalEdTax         float64 `json:"total_edtax"`
	TotalPAYE          float64 `json:"total_paye"`
	TotalEmployerCost  float64 `json:"total_employer_cost"`
	AvgSalary          float64 `json:"avg_salary"`
	HeadCount          int     `json:"head_count"`
	LaborCostPct       float64 `json:"labor_cost_pct"` // gross / total_revenue * 100
}

type MonthlyCostRow struct {
	Month       string  `json:"month"`
	TotalGross  float64 `json:"total_gross"`
	TotalNet    float64 `json:"total_net"`
	EmployeeCount int   `json:"employee_count"`
}
