package model

// ─── Fuel Performance Score ───────────────────────────────────────────────────

// FPSResult is the Fuel Performance Score for a business/branch over a period.
type FPSResult struct {
	BusinessID string `json:"business_id"`
	BranchID   string `json:"branch_id,omitempty"`
	Period     string `json:"period"` // e.g. "last_30_days"

	// Component scores (sum = 100 max)
	ScoreInventoryAccuracy float64 `json:"score_inventory_accuracy"`  // 25 pts
	ScoreFuelLoss          float64 `json:"score_fuel_loss"`           // 25 pts
	ScoreDeliveryEff       float64 `json:"score_delivery_efficiency"` // 15 pts
	ScoreTankUtilization   float64 `json:"score_tank_utilization"`    // 15 pts
	ScoreSalesPerformance  float64 `json:"score_sales_performance"`   // 10 pts
	ScoreCompliance        float64 `json:"score_compliance"`          // 10 pts

	FPSTotal float64 `json:"fps_total"`
	Grade    string  `json:"grade"` // A+, A, B, C, D, F

	// Supporting metrics
	TotalTanksScored     int     `json:"total_tanks_scored"`
	AvgVariancePct       float64 `json:"avg_variance_pct"`
	TotalShrinkageLitres float64 `json:"total_shrinkage_litres"`
	TotalDeliveries      int     `json:"total_deliveries"`
	ComplianceRate       float64 `json:"compliance_rate"`
}

// ─── Tank Analytics ───────────────────────────────────────────────────────────

// TankSummary holds computed intelligence for a single tank.
type TankSummary struct {
	TankID         string  `json:"tank_id"`
	TankName       string  `json:"tank_name"`
	FuelName       string  `json:"fuel_name"`
	CapacityLitres float64 `json:"capacity_litres"`

	// Current inventory
	CurrentLevel      float64 `json:"current_level_litres"`
	CurrentPct        float64 `json:"current_pct"`
	UllageLitres      float64 `json:"ullage_litres"`
	InventoryStatus   string  `json:"inventory_status"` // critical / low / normal / high

	// Variance (last 30 days)
	AvgVariancePct    float64 `json:"avg_variance_pct"`
	TotalVarianceLitres float64 `json:"total_variance_litres"`
	VarianceClass     string  `json:"variance_class"` // acceptable / warning / critical
	ShiftsAnalysed    int     `json:"shifts_analysed"`

	// Utilization
	AvgUtilizationPct float64 `json:"avg_utilization_pct"`

	// Reorder intelligence
	AvgDailyUsageLitres  float64 `json:"avg_daily_usage_litres"`
	DaysUntilReorder     float64 `json:"days_until_reorder"`
	DaysUntilEmpty       float64 `json:"days_until_empty"`
	ReorderPointLitres   float64 `json:"reorder_point_litres"`
	ReorderSuggested     bool    `json:"reorder_suggested"`
	LeadTimeDays         float64 `json:"lead_time_days"`
	SafetyStockLitres    float64 `json:"safety_stock_litres"`

	// Performance score (0-100)
	TankFPS float64 `json:"tank_fps"`
}

// ─── Grade Analytics ──────────────────────────────────────────────────────────

// GradeAnalytics holds per-fuel-grade performance metrics.
type GradeAnalytics struct {
	FuelID   string `json:"fuel_id"`
	FuelName string `json:"fuel_name"`

	// Volume
	TotalLitresSold     float64 `json:"total_litres_sold"`
	AvgDailyLitres      float64 `json:"avg_daily_litres"`
	TotalLitresReceived float64 `json:"total_litres_received"`
	InventoryTurnover   float64 `json:"inventory_turnover"` // sold / received

	// Revenue & profitability
	TotalRevenue    float64 `json:"total_revenue"`
	TotalCost       float64 `json:"total_cost"`
	GrossProfit     float64 `json:"gross_profit"`
	MarginPct       float64 `json:"margin_pct"`
	ProfitPerLitre  float64 `json:"profit_per_litre"`
	RevenueShare    float64 `json:"revenue_share_pct"` // % of total revenue

	// Variance
	TotalVarianceLitres float64 `json:"total_variance_litres"`
	ShrinkagePct        float64 `json:"shrinkage_pct"` // |losses| / received * 100

	// Trend (compare current period to prior)
	RevenueGrowthPct float64 `json:"revenue_growth_pct"`
	VolumeGrowthPct  float64 `json:"volume_growth_pct"`
}

// ─── Delivery Intelligence ────────────────────────────────────────────────────

// DeliveryRecord enriches a fuel receival with verification metrics.
type DeliveryRecord struct {
	ID           string  `json:"id"`
	ShiftID      string  `json:"shift_id"`
	ShiftDate    string  `json:"shift_date"`
	TankID       *string `json:"tank_id"`
	TankName     string  `json:"tank_name"`
	FuelName     string  `json:"fuel_name"`
	SupplierName string  `json:"supplier_name"`
	InvoiceNo    string  `json:"invoice_no"`

	LitresOrdered   float64 `json:"litres_ordered"`
	LitresMeasured  float64 `json:"litres_measured"` // closing - opening from tank_log
	DeliveryVariance float64 `json:"delivery_variance"`
	AccuracyPct     float64 `json:"accuracy_pct"`
	AccuracyClass   string  `json:"accuracy_class"` // accurate / short / surplus

	CostPerLitre float64 `json:"cost_per_litre"`
	TotalCost    float64 `json:"total_cost"`
}

// DeliverySummary aggregates delivery intelligence over a period.
type DeliverySummary struct {
	TotalDeliveries   int     `json:"total_deliveries"`
	TotalLitresOrdered float64 `json:"total_litres_ordered"`
	TotalLitresMeasured float64 `json:"total_litres_measured"`
	OverallAccuracyPct float64 `json:"overall_accuracy_pct"`
	ShortDeliveries   int     `json:"short_deliveries"`
	SurplusDeliveries int     `json:"surplus_deliveries"`
	TotalShortfall    float64 `json:"total_shortfall_litres"`
	AvgCostPerLitre   float64 `json:"avg_cost_per_litre"`
	Records           []DeliveryRecord `json:"records"`
}

// ─── Reorder Intelligence ─────────────────────────────────────────────────────

// ReorderStatus for a single tank.
type ReorderStatus struct {
	TankID              string  `json:"tank_id"`
	TankName            string  `json:"tank_name"`
	FuelName            string  `json:"fuel_name"`
	CurrentLitres       float64 `json:"current_litres"`
	CapacityLitres      float64 `json:"capacity_litres"`
	AvgDailyUsage       float64 `json:"avg_daily_usage_litres"`
	LeadTimeDays        float64 `json:"lead_time_days"`
	SafetyStockLitres   float64 `json:"safety_stock_litres"`
	ReorderPointLitres  float64 `json:"reorder_point_litres"`
	ReorderQtyLitres    float64 `json:"reorder_qty_litres"` // capacity - current
	DaysUntilReorder    float64 `json:"days_until_reorder"`
	DaysUntilEmpty      float64 `json:"days_until_empty"`
	Urgency             string  `json:"urgency"` // normal / soon / urgent / critical
	ReorderSuggested    bool    `json:"reorder_suggested"`
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

// FuelAlert is a monitoring alert.
type FuelAlert struct {
	ID         string   `json:"id"`
	BusinessID string   `json:"business_id"`
	BranchID   *string  `json:"branch_id"`
	TankID     *string  `json:"tank_id"`
	TankName   string   `json:"tank_name"`
	ShiftID    *string  `json:"shift_id"`
	AlertType  string   `json:"alert_type"`
	Severity   string   `json:"severity"` // info / warning / critical
	Title      string   `json:"title"`
	Message    string   `json:"message"`
	Value      *float64 `json:"value"`
	Threshold  *float64 `json:"threshold"`
	Resolved   bool     `json:"resolved"`
	ResolvedAt *string  `json:"resolved_at"`
	CreatedAt  string   `json:"created_at"`
}
