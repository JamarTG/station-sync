package model

// SPSShiftScore holds the computed performance score for a single closed shift.
type SPSShiftScore struct {
	ID                   string  `db:"id"                     json:"id"`
	ShiftID              string  `db:"shift_id"               json:"shift_id"`
	SupervisorID         string  `db:"supervisor_id"          json:"supervisor_id"`
	SupervisorName       string  `db:"-"                      json:"supervisor_name"`
	BranchID             *string `db:"branch_id"              json:"branch_id"`
	BusinessID           string  `db:"business_id"            json:"business_id"`
	ScoreSales           float64 `db:"score_sales"            json:"score_sales"`
	ScoreCashVariance    float64 `db:"score_cash_variance"    json:"score_cash_variance"`
	ScoreFuelVariance    float64 `db:"score_fuel_variance"    json:"score_fuel_variance"`
	ScoreAttendance      float64 `db:"score_attendance"       json:"score_attendance"`
	ScoreTeam            float64 `db:"score_team"             json:"score_team"`
	ScoreTaskCompletion  float64 `db:"score_task_completion"  json:"score_task_completion"`
	ScoreInventory       float64 `db:"score_inventory"        json:"score_inventory"`
	ScoreIncident        float64 `db:"score_incident"         json:"score_incident"`
	ScoreSafety          float64 `db:"score_safety"           json:"score_safety"`
	ScoreCustomerService float64 `db:"score_customer_service" json:"score_customer_service"`
	TotalPenalties       float64 `db:"total_penalties"        json:"total_penalties"`
	TotalBonuses         float64 `db:"total_bonuses"          json:"total_bonuses"`
	SPSShiftRaw          float64 `db:"sps_shift_raw"          json:"sps_shift_raw"`
	SPSShiftFinal        float64 `db:"sps_shift_final"        json:"sps_shift_final"`
	SalesEfficiencyRatio *float64 `db:"sales_efficiency_ratio" json:"sales_efficiency_ratio"`
	FuelVariancePct      *float64 `db:"fuel_variance_pct"      json:"fuel_variance_pct"`
	AttendantCount       int     `db:"attendant_count"        json:"attendant_count"`
	IncidentCount        int     `db:"incident_count"         json:"incident_count"`
	BonusBreakdown       string  `db:"bonus_breakdown"        json:"bonus_breakdown"`
	PenaltyBreakdown     string  `db:"penalty_breakdown"      json:"penalty_breakdown"`
	ScoredAt             string  `db:"scored_at"              json:"scored_at"`
}

// SupervisorLifetimeStats holds the all-time aggregate for a supervisor.
type SupervisorLifetimeStats struct {
	SupervisorID          string  `db:"supervisor_id"            json:"supervisor_id"`
	SupervisorName        string  `db:"-"                        json:"supervisor_name"`
	BusinessID            string  `db:"business_id"              json:"business_id"`
	TotalShifts           int     `db:"total_shifts"             json:"total_shifts"`
	ConfidenceWeight      float64 `db:"confidence_weight"        json:"confidence_weight"`
	SPSRawEWMA            float64 `db:"sps_raw_ewma"             json:"sps_raw_ewma"`
	SPSLifetimeFinal      float64 `db:"sps_lifetime_final"       json:"sps_lifetime_final"`
	SPSPeak               float64 `db:"sps_peak"                 json:"sps_peak"`
	CurrentTier           string  `db:"current_tier"             json:"current_tier"`
	CurrentPerfectStreak  int     `db:"current_perfect_streak"   json:"current_perfect_streak"`
	BestPerfectStreak     int     `db:"best_perfect_streak"      json:"best_perfect_streak"`
	TotalRevenueManaged   float64 `db:"total_revenue_managed"    json:"total_revenue_managed"`
	TotalFuelVolumeLitres float64 `db:"total_fuel_volume_litres" json:"total_fuel_volume_litres"`
	LastComputedAt        string  `db:"last_computed_at"         json:"last_computed_at"`
	GlobalRank            int     `db:"-"                        json:"global_rank"`
	CompanyRank           int     `db:"-"                        json:"company_rank"`
}

// RankingEntry is used for leaderboard responses.
type RankingEntry struct {
	Rank                 int     `json:"rank"`
	SupervisorID         string  `json:"supervisor_id"`
	SupervisorName       string  `json:"supervisor_name"`
	CurrentTier          string  `json:"current_tier"`
	SPSLifetimeFinal     float64 `json:"sps_lifetime_final"`
	SPSRawEWMA           float64 `json:"sps_raw_ewma"`
	SPSPeak              float64 `json:"sps_peak"`
	TotalShifts          int     `json:"total_shifts"`
	ConfidenceWeight     float64 `json:"confidence_weight"`
	CurrentPerfectStreak int     `json:"current_perfect_streak"`
	BestPerfectStreak    int     `json:"best_perfect_streak"`
	TotalRevenueManaged  float64 `json:"total_revenue_managed"`
}
