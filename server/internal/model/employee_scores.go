package model

import "time"

// ═══════════════════════════════════════════════════════════════════════════════
// Cashier Performance Score (CPS)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Score breakdown — 100 points total:
//
//   Component               Weight  Rationale
//   ─────────────────────── ──────  ─────────────────────────────────────────
//   Cash Handling Accuracy    25    Core cashier duty; financial integrity
//   Transaction Quality       20    Data accuracy, fraud prevention
//   Sales Effectiveness       20    Revenue contribution (normalised by traffic)
//   Attendance & Reliability  15    Operational necessity
//   Customer Service          10    Satisfaction & retention
//   Operational Compliance     5    Policy adherence
//   Team Contribution          5    Shift effectiveness
//
// Formulas:
//
//   Cash Accuracy:
//     Variance%  = |Cash_Variance| / max(Total_Sales, 1) × 100
//     Score      = 25 × max(0, 1 − Variance% / 1.0)    (0 pts at ≥1% variance)
//     Zero-bonus = +1 pt if Variance% = 0
//
//   Transaction Quality:
//     Suspicious_Action_Rate = (unsupervised_voids + unapproved_refunds + bad_overrides)
//                              / max(total_transactions, 1)
//     Score = max(0, 20 × (1 − Suspicious_Action_Rate / 0.02))  (0 pts at ≥2% rate)
//
//   Sales Effectiveness:
//     SER       = Employee_Sales_Per_Txn / Station_7Day_Avg_Sales_Per_Txn  (normalised)
//     Base      = min(10, 5 × SER)
//     Upsell    = min(4, upsell_count × 0.2)
//     Loyalty   = min(3, loyalty_signups × 0.3)
//     Promo     = min(3, promos_sold × 0.15)
//     Score     = min(20, Base + Upsell + Loyalty + Promo)
//
//   Attendance:
//     Punctuality  = 8 − 0.5×late_minutes  (min 4, max 8)
//     Reliability  = 7 − 3×no_shows − 2×early_departures
//     Score        = clamp(Punctuality + Reliability, 0, 15)
//
//   Customer Service:
//     Positive_Rate = positive_feedback / max(total_feedback, 1)
//     Score = max(0, min(10, 6×Positive_Rate − 1.5×complaint_count + 2×resolution_rate))
//
//   Compliance:
//     Score = max(0, 5 × (items_completed / items_required) − violations)
//
//   Team Contribution:
//     Score = 5 × (0.4 × normalised_peer_rating + 0.6 × normalised_supervisor_rating)
//     Default 3 pts when no reviews submitted
//
// Bonuses: Perfect Shift +2 | Zero Variance +1 | Commendation +1 | Upsell Champion +1
// Penalties: Policy Violation −3 | No-Show −3 | Cash Shortage >1% −2 | Suspicious Txn −2
//
// Lifetime: EWMA(α=0.06) with Bayesian CW(n) = n/(n+40)
// ════════════════════════════════════════════════════════════════════════════════

// CPSShiftScore holds the computed CPS for a single shift.
type CPSShiftScore struct {
	ID        string  `json:"id"`
	ShiftID   string  `json:"shift_id"`
	CashierID string  `json:"cashier_id"`
	CashierName string `json:"cashier_name"`
	BusinessID string `json:"business_id"`
	BranchID  *string `json:"branch_id"`

	// Component scores
	ScoreCashAccuracy      float64 `json:"score_cash_accuracy"`      // max 25
	ScoreTransactionQuality float64 `json:"score_transaction_quality"` // max 20
	ScoreSalesEffectiveness float64 `json:"score_sales_effectiveness"` // max 20
	ScoreAttendance        float64 `json:"score_attendance"`          // max 15
	ScoreCustomerService   float64 `json:"score_customer_service"`    // max 10
	ScoreCompliance        float64 `json:"score_compliance"`          // max 5
	ScoreTeam              float64 `json:"score_team"`                // max 5

	TotalBonuses    float64 `json:"total_bonuses"`
	TotalPenalties  float64 `json:"total_penalties"`
	BonusBreakdown  string  `json:"bonus_breakdown"`  // JSON array
	PenaltyBreakdown string `json:"penalty_breakdown"` // JSON array
	CPSShiftRaw     float64 `json:"cps_shift_raw"`
	CPSShiftFinal   float64 `json:"cps_shift_final"`

	// Supporting metrics
	CashVarianceAmt    *float64 `json:"cash_variance_amt"`
	CashVariancePct    *float64 `json:"cash_variance_pct"`
	TotalTransactions  int      `json:"total_transactions"`
	VoidCount          int      `json:"void_count"`
	RefundCount        int      `json:"refund_count"`
	OverrideCount      int      `json:"override_count"`
	TotalSales         float64  `json:"total_sales"`
	SalesEfficiencyRatio *float64 `json:"sales_efficiency_ratio"`
	UpsellCount        int      `json:"upsell_count"`
	LoyaltySignups     int      `json:"loyalty_signups"`

	ScoredAt time.Time `json:"scored_at"`
}

// CashierLifetimeStats holds the all-time aggregate for a cashier.
type CashierLifetimeStats struct {
	CashierID            string  `json:"cashier_id"`
	CashierName          string  `json:"cashier_name"`
	BusinessID           string  `json:"business_id"`
	TotalShifts          int     `json:"total_shifts"`
	ConfidenceWeight     float64 `json:"confidence_weight"`
	CPSRawEWMA           float64 `json:"cps_raw_ewma"`
	CPSLifetimeFinal     float64 `json:"cps_lifetime_final"`
	CPSPeak              float64 `json:"cps_peak"`
	CurrentTier          string  `json:"current_tier"`
	CurrentPerfectStreak int     `json:"current_perfect_streak"`
	BestPerfectStreak    int     `json:"best_perfect_streak"`
	TotalRevenueProcessed float64 `json:"total_revenue_processed"`
	LastComputedAt       string  `json:"last_computed_at"`
	CompanyRank          int     `json:"company_rank"`
	GlobalRank           int     `json:"global_rank"`
}

// ═══════════════════════════════════════════════════════════════════════════════
// Attendant Performance Score (APS)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Score breakdown — 100 points total:
//
//   Component               Weight  Rationale
//   ─────────────────────── ──────  ─────────────────────────────────────────
//   Fuel Accountability       25    Core duty; financial & environmental risk
//   Forecourt Operations      20    Operational quality & station presentation
//   Productivity              20    Service delivery (normalised by traffic)
//   Attendance & Reliability  15    Operational necessity
//   Customer Service          10    Satisfaction & retention
//   Safety Compliance          7    Legal, regulatory, & hazard prevention
//   Team Contribution          3    Shift cohesion
//
// Formulas:
//
//   Fuel Accountability:
//     Variance%  = |Meter_Expected − Actual_Dispensed| / max(Total_Dispensed, 1) × 100
//     Score      = 25 × max(0, 1 − Variance% / 1.0)
//     Zero-bonus = +1 pt if Variance% = 0
//
//   Forecourt Operations:
//     Score = 8 × (inspections_done / inspections_required)
//           + 6 × cleanliness_rating / 5
//           + 6 × (tasks_done / tasks_assigned)
//     Score = min(20, Score)
//
//   Productivity (normalised — eliminates station size bias):
//     Vehicles_Per_Hr_Employee = vehicles_served / max(shift_hours, 1)
//     Vehicles_Per_Hr_Station  = station_7day_rolling_avg / 8
//     Productivity_Ratio       = Employee / max(Station, ε)
//     Score = min(20, 10 × Productivity_Ratio)
//     ↑ Score of 10 = exactly at station average (fair baseline)
//       Score of 20 = 2× average (capped)
//
//   Attendance: same formula as CPS (max 15)
//
//   Customer Service: same formula as CPS (max 10)
//
//   Safety Compliance:
//     Score = 5 × (safety_items_done / safety_items_required)
//           + 2 × PPE_compliant
//           + min(2, hazard_reports × 0.5)
//           − incidents_caused × 3
//     Score = clamp(Score, 0, 7)
//
//   Team Contribution: scaled to 3 pts (same ratio as CPS team formula)
//
// Bonuses: Perfect Shift +2 | Zero Variance +1 | Proactive Hazard Report +1
// Penalties: Safety Incident −3 | No-Show −3 | Fuel Variance >2% −2
//
// Lifetime: EWMA(α=0.06) with CW(n) = n/(n+40)
// ════════════════════════════════════════════════════════════════════════════════

// APSShiftScore holds the computed APS for a single shift.
type APSShiftScore struct {
	ID           string  `json:"id"`
	ShiftID      string  `json:"shift_id"`
	AttendantID  string  `json:"attendant_id"`
	AttendantName string `json:"attendant_name"`
	BusinessID   string  `json:"business_id"`
	BranchID     *string `json:"branch_id"`

	// Component scores
	ScoreFuelAccountability float64 `json:"score_fuel_accountability"` // max 25
	ScoreForecourt          float64 `json:"score_forecourt_ops"`       // max 20
	ScoreProductivity       float64 `json:"score_productivity"`        // max 20
	ScoreAttendance         float64 `json:"score_attendance"`          // max 15
	ScoreCustomerService    float64 `json:"score_customer_service"`    // max 10
	ScoreSafety             float64 `json:"score_safety"`              // max 7
	ScoreTeam               float64 `json:"score_team"`                // max 3

	TotalBonuses    float64 `json:"total_bonuses"`
	TotalPenalties  float64 `json:"total_penalties"`
	BonusBreakdown  string  `json:"bonus_breakdown"`
	PenaltyBreakdown string `json:"penalty_breakdown"`
	APSShiftRaw     float64 `json:"aps_shift_raw"`
	APSShiftFinal   float64 `json:"aps_shift_final"`

	// Supporting metrics
	FuelVariancePct       *float64 `json:"fuel_variance_pct"`
	VehiclesServed        int      `json:"vehicles_served"`
	FuelVolumeLitres      float64  `json:"fuel_volume_litres"`
	ProductivityRatio     *float64 `json:"productivity_ratio"`
	SafetyChecksCompleted int      `json:"safety_checks_completed"`
	SafetyChecksRequired  int      `json:"safety_checks_required"`
	HazardReports         int      `json:"hazard_reports"`
	IncidentCount         int      `json:"incident_count"`

	ScoredAt time.Time `json:"scored_at"`
}

// AttendantLifetimeStats holds the all-time aggregate for an attendant.
type AttendantLifetimeStats struct {
	AttendantID             string  `json:"attendant_id"`
	AttendantName           string  `json:"attendant_name"`
	BusinessID              string  `json:"business_id"`
	TotalShifts             int     `json:"total_shifts"`
	ConfidenceWeight        float64 `json:"confidence_weight"`
	APSRawEWMA              float64 `json:"aps_raw_ewma"`
	APSLifetimeFinal        float64 `json:"aps_lifetime_final"`
	APSPeak                 float64 `json:"aps_peak"`
	CurrentTier             string  `json:"current_tier"`
	CurrentPerfectStreak    int     `json:"current_perfect_streak"`
	BestPerfectStreak       int     `json:"best_perfect_streak"`
	TotalFuelDispensedLitres float64 `json:"total_fuel_dispensed_litres"`
	TotalVehiclesServed     int     `json:"total_vehicles_served"`
	LastComputedAt          string  `json:"last_computed_at"`
	CompanyRank             int     `json:"company_rank"`
	GlobalRank              int     `json:"global_rank"`
}

// ─── Shared ────────────────────────────────────────────────────────────────────

// EmployeeRankingEntry is used in leaderboard responses (both CPS and APS).
type EmployeeRankingEntry struct {
	Rank                 int     `json:"rank"`
	EmployeeID           string  `json:"employee_id"`
	EmployeeName         string  `json:"employee_name"`
	Role                 string  `json:"role"`
	CurrentTier          string  `json:"current_tier"`
	LifetimeFinal        float64 `json:"lifetime_final"`
	RawEWMA              float64 `json:"raw_ewma"`
	Peak                 float64 `json:"peak"`
	TotalShifts          int     `json:"total_shifts"`
	ConfidenceWeight     float64 `json:"confidence_weight"`
	CurrentPerfectStreak int     `json:"current_perfect_streak"`
	BestPerfectStreak    int     `json:"best_perfect_streak"`
}

// EmployeeFeedback is a customer/peer/supervisor feedback record.
type EmployeeFeedback struct {
	ID           string    `json:"id"`
	BusinessID   string    `json:"business_id"`
	ShiftID      *string   `json:"shift_id"`
	EmployeeID   string    `json:"employee_id"`
	SubmittedBy  *string   `json:"submitted_by"`
	FeedbackType string    `json:"feedback_type"` // positive | negative | neutral | complaint | commendation
	Source       string    `json:"source"`        // customer | peer | supervisor | mystery_shopper
	Score        int       `json:"score"`         // 1-5
	Notes        *string   `json:"notes"`
	Resolved     bool      `json:"resolved"`
	CreatedAt    time.Time `json:"created_at"`
}

// CoachingInsight is an AI-generated performance insight.
// ─────────────────────────────────────────────────────────────────────────────
// Generation logic:
//   1. Compare this period's component scores to the employee's own 3-month avg.
//   2. Flag the biggest improvement and biggest decline.
//   3. Compare lifetime score to top-10% employees at similar-traffic stations.
//   4. Generate human-readable text using rule templates (no LLM required).
//      Each template has a trigger condition and a fill-in message.
// ─────────────────────────────────────────────────────────────────────────────
type CoachingInsight struct {
	EmployeeID   string `json:"employee_id"`
	Period       string `json:"period"`       // "last_30_days"
	ScoreDelta   float64 `json:"score_delta"` // +3.2 or -1.5
	Strengths    []string `json:"strengths"`
	Improvements []string `json:"improvements"`
	Actions      []string `json:"actions"`     // specific steps to take
	Comparisons  []string `json:"comparisons"` // "top 10% at similar stations"
	Summary      string  `json:"summary"`     // one-sentence narrative
	GeneratedAt  string  `json:"generated_at"`
}
