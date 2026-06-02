package model

import "time"

// ═══════════════════════════════════════════════════════════════════════════════
// Customer Rewards & Loyalty Management
// ═══════════════════════════════════════════════════════════════════════════════

// LoyaltyTier is a configurable membership tier.
type LoyaltyTier struct {
	ID         string    `json:"id"`
	BusinessID string    `json:"business_id"`
	Name       string    `json:"name"`
	MinPoints  int       `json:"min_points"`
	Multiplier float64   `json:"multiplier"`
	Benefits   *string   `json:"benefits"`
	SortOrder  int       `json:"sort_order"`
	CreatedAt  time.Time `json:"created_at"`
}

// LoyaltyConfig holds per-business earning rules + approval/limit settings.
type LoyaltyConfig struct {
	BusinessID           string    `json:"business_id"`
	FuelPointsPer100     float64   `json:"fuel_points_per_100"`
	StorePointsPer100    float64   `json:"store_points_per_100"`
	AutoApproveMax       int       `json:"auto_approve_max"`
	SupervisorApproveMax int       `json:"supervisor_approve_max"`
	DailyRedeemLimit     int       `json:"daily_redeem_limit"`
	MonthlyRedeemLimit   int       `json:"monthly_redeem_limit"`
	PointsExpiryDays     int       `json:"points_expiry_days"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// LoyaltyReward is a configurable catalog entry.
type LoyaltyReward struct {
	ID                  string    `json:"id"`
	BusinessID          string    `json:"business_id"`
	Name                string    `json:"name"`
	Description         string    `json:"description"`
	RewardType          string    `json:"reward_type"`     // fuel_discount|store_discount|free_product|car_wash|membership
	PointsRequired      int       `json:"points_required"`
	DiscountType        *string   `json:"discount_type"`   // fixed_amount|percentage|free_fuel|free_item
	DiscountValue       *float64  `json:"discount_value"`
	IsActive            bool      `json:"is_active"`
	Visible             bool      `json:"visible"`
	StartDate           *string   `json:"start_date"`
	EndDate             *string   `json:"end_date"`
	MaxRedemptions      *int      `json:"max_redemptions"`
	PerCustomerLimit    *int      `json:"per_customer_limit"`
	ApplicableFuelGrades []string `json:"applicable_fuel_grades"`
	ApplicableProducts  []string  `json:"applicable_products"`
	CostEstimate        float64   `json:"cost_estimate"`
	RedemptionCount     int       `json:"redemption_count"`
	Scope               string    `json:"scope"`           // organization|station
	BranchID            *string   `json:"branch_id"`
	CreatedBy           *string   `json:"created_by"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// LoyaltyRedemption is a redemption transaction.
type LoyaltyRedemption struct {
	ID            string     `json:"id"`
	BusinessID    string     `json:"business_id"`
	BranchID      *string    `json:"branch_id"`
	CustomerID    string     `json:"customer_id"`
	CustomerName  string     `json:"customer_name,omitempty"`
	RewardID      *string    `json:"reward_id"`
	RewardName    string     `json:"reward_name"`
	PointsSpent   int        `json:"points_spent"`
	Status        string     `json:"status"`         // pending|approved|rejected|applied|cancelled
	ApprovalLevel string     `json:"approval_level"` // auto|supervisor|manager
	RequestedBy   *string    `json:"requested_by"`
	ReviewedBy    *string    `json:"reviewed_by"`
	ReviewedAt    *time.Time `json:"reviewed_at"`
	CreatedAt     time.Time  `json:"created_at"`
}

// LoyaltyTransaction is one entry in the append-only points ledger.
type LoyaltyTransaction struct {
	ID           string    `json:"id"`
	BusinessID   string    `json:"business_id"`
	CustomerID   string    `json:"customer_id"`
	TxType       string    `json:"tx_type"`   // earn|redeem|adjust|bonus|expire
	PointsDelta  int       `json:"points_delta"`
	BalanceAfter int       `json:"balance_after"`
	Source       *string   `json:"source"`
	ReferenceID  *string   `json:"reference_id"`
	Reason       *string   `json:"reason"`
	ActorID      *string   `json:"actor_id"`
	CreatedAt    time.Time `json:"created_at"`
}

// LoyaltyCampaign is a promotional bonus-earning window.
type LoyaltyCampaign struct {
	ID              string    `json:"id"`
	BusinessID      string    `json:"business_id"`
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	CampaignType    string    `json:"campaign_type"` // multiplier|bonus_threshold|double_points
	Multiplier      float64   `json:"multiplier"`
	BonusPoints     int       `json:"bonus_points"`
	ThresholdAmount float64   `json:"threshold_amount"`
	AppliesTo       string    `json:"applies_to"`    // all|fuel|store|premium_fuel
	StartDate       string    `json:"start_date"`
	EndDate         string    `json:"end_date"`
	IsActive        bool      `json:"is_active"`
	Participation   int       `json:"participation"`
	PointsIssued    int       `json:"points_issued"`
	CreatedBy       *string   `json:"created_by"`
	CreatedAt       time.Time `json:"created_at"`
}

// LoyaltyWallet is the customer-facing rewards dashboard payload.
type LoyaltyWallet struct {
	CustomerID          string               `json:"customer_id"`
	CustomerName        string               `json:"customer_name"`
	CurrentPoints       int                  `json:"current_points"`
	LifetimePointsEarned int                 `json:"lifetime_points_earned"`
	LifetimePointsRedeemed int               `json:"lifetime_points_redeemed"`
	Tier                string               `json:"tier"`
	TierMultiplier      float64              `json:"tier_multiplier"`
	NextTier            *string              `json:"next_tier"`
	PointsToNextTier    int                  `json:"points_to_next_tier"`
	AvailableRewards    []LoyaltyReward      `json:"available_rewards"`
	RecentRedemptions   []LoyaltyRedemption  `json:"recent_redemptions"`
	PointsHistory       []LoyaltyTransaction `json:"points_history"`
}

// LoyaltyAnalytics powers the manager dashboards.
type LoyaltyAnalytics struct {
	TotalMembers       int                  `json:"total_members"`
	TotalPointsIssued  int                  `json:"total_points_issued"`
	TotalPointsRedeemed int                 `json:"total_points_redeemed"`
	OutstandingPoints  int                  `json:"outstanding_points"`
	TierDistribution   map[string]int       `json:"tier_distribution"`
	TopCustomers       []TopCustomer        `json:"top_customers"`
	RewardPerformance  []RewardPerformance  `json:"reward_performance"`
}

type TopCustomer struct {
	CustomerID    string `json:"customer_id"`
	Name          string `json:"name"`
	CurrentPoints int    `json:"current_points"`
	LifetimeEarned int   `json:"lifetime_earned"`
	Tier          string `json:"tier"`
}

type RewardPerformance struct {
	RewardID        string  `json:"reward_id"`
	Name            string  `json:"name"`
	RedemptionCount int     `json:"redemption_count"`
	PointsSpent     int     `json:"points_spent"`
	EstimatedCost   float64 `json:"estimated_cost"`
}
