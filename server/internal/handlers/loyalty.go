package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type LoyaltyHandler struct {
	DB *pgxpool.Pool
}

// loyaltyManager gates reward/config management to Admins and Managers.
func loyaltyManager(c *gin.Context) bool {
	switch c.GetString("role") {
	case "Super Admin", "Admin", "Manager", "Super Duper Admin":
		return true
	}
	return false
}

// ─── helpers ────────────────────────────────────────────────────────────────

// recomputeTier returns the tier name for a points balance using the business's
// configured tiers (highest min_points that the balance satisfies).
func (h *LoyaltyHandler) recomputeTier(ctx context.Context, businessID string, points int) (string, float64) {
	var name string
	var mult float64
	err := h.DB.QueryRow(ctx, `
		SELECT name, multiplier FROM loyalty_tiers
		WHERE business_id=$1 AND min_points <= $2
		ORDER BY min_points DESC LIMIT 1`, businessID, points,
	).Scan(&name, &mult)
	if err != nil {
		return "Bronze", 1.0
	}
	return name, mult
}

// applyPoints mutates a customer's balance inside a transaction, writes a ledger
// entry, recomputes tier, and returns the new balance. delta>0 earns, <0 redeems.
// Idempotent when idemKey is supplied (duplicate keys are no-ops).
func (h *LoyaltyHandler) applyPoints(ctx context.Context, tx pgx.Tx, businessID, branchID, customerID, txType string, delta int, source, reason, refID, actorID, idemKey string) (int, error) {
	// Dedupe by idempotency key.
	if idemKey != "" {
		var exists int
		tx.QueryRow(ctx, `SELECT 1 FROM loyalty_transactions WHERE idempotency_key=$1`, idemKey).Scan(&exists)
		if exists == 1 {
			var bal int
			tx.QueryRow(ctx, `SELECT loyalty_points FROM customers WHERE id=$1`, customerID).Scan(&bal)
			return bal, nil
		}
	}

	var bal, earned, redeemed int
	if err := tx.QueryRow(ctx,
		`SELECT loyalty_points, lifetime_earned, lifetime_redeemed FROM customers WHERE id=$1 AND business_id=$2 FOR UPDATE`,
		customerID, businessID,
	).Scan(&bal, &earned, &redeemed); err != nil {
		return 0, err
	}

	newBal := bal + delta
	if newBal < 0 {
		return bal, errInsufficient
	}
	if delta > 0 {
		earned += delta
	} else {
		redeemed += -delta
	}
	tier, _ := h.recomputeTier(ctx, businessID, newBal)

	if _, err := tx.Exec(ctx, `
		UPDATE customers SET loyalty_points=$1, lifetime_earned=$2, lifetime_redeemed=$3, tier=$4
		WHERE id=$5`, newBal, earned, redeemed, tier, customerID); err != nil {
		return 0, err
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO loyalty_transactions
		  (business_id, branch_id, customer_id, tx_type, points_delta, balance_after,
		   source, reference_id, reason, actor_id, idempotency_key)
		VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8::uuid,$9,$10::uuid,NULLIF($11,''))`,
		businessID, nullableUUID(branchID), customerID, txType, delta, newBal,
		nullStr(source), nullableUUID(refID), nullStr(reason), nullableUUID(actorID), idemKey)
	return newBal, err
}

var errInsufficient = &loyaltyError{"insufficient points"}

type loyaltyError struct{ msg string }

func (e *loyaltyError) Error() string { return e.msg }

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// ═══════════════════════════════════════════════════════════════════════════════
// Config & Tiers
// ═══════════════════════════════════════════════════════════════════════════════

func (h *LoyaltyHandler) GetConfig(c *gin.Context) {
	businessID := c.GetString("business_id")
	var cfg model.LoyaltyConfig
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT business_id::text, fuel_points_per_100, store_points_per_100,
		       auto_approve_max, supervisor_approve_max, daily_redeem_limit,
		       monthly_redeem_limit, points_expiry_days, updated_at
		FROM loyalty_config WHERE business_id=$1`, businessID,
	).Scan(&cfg.BusinessID, &cfg.FuelPointsPer100, &cfg.StorePointsPer100,
		&cfg.AutoApproveMax, &cfg.SupervisorApproveMax, &cfg.DailyRedeemLimit,
		&cfg.MonthlyRedeemLimit, &cfg.PointsExpiryDays, &cfg.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusOK, model.LoyaltyConfig{BusinessID: businessID,
			FuelPointsPer100: 1, StorePointsPer100: 2, AutoApproveMax: 1000,
			SupervisorApproveMax: 5000, DailyRedeemLimit: 5, MonthlyRedeemLimit: 30})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *LoyaltyHandler) UpsertConfig(c *gin.Context) {
	if !loyaltyManager(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "managers only"})
		return
	}
	businessID := c.GetString("business_id")
	var b model.LoyaltyConfig
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var cfg model.LoyaltyConfig
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO loyalty_config
		  (business_id, fuel_points_per_100, store_points_per_100, auto_approve_max,
		   supervisor_approve_max, daily_redeem_limit, monthly_redeem_limit, points_expiry_days)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (business_id) DO UPDATE SET
		  fuel_points_per_100=$2, store_points_per_100=$3, auto_approve_max=$4,
		  supervisor_approve_max=$5, daily_redeem_limit=$6, monthly_redeem_limit=$7,
		  points_expiry_days=$8, updated_at=NOW()
		RETURNING business_id::text, fuel_points_per_100, store_points_per_100,
		          auto_approve_max, supervisor_approve_max, daily_redeem_limit,
		          monthly_redeem_limit, points_expiry_days, updated_at`,
		businessID, b.FuelPointsPer100, b.StorePointsPer100, b.AutoApproveMax,
		b.SupervisorApproveMax, b.DailyRedeemLimit, b.MonthlyRedeemLimit, b.PointsExpiryDays,
	).Scan(&cfg.BusinessID, &cfg.FuelPointsPer100, &cfg.StorePointsPer100,
		&cfg.AutoApproveMax, &cfg.SupervisorApproveMax, &cfg.DailyRedeemLimit,
		&cfg.MonthlyRedeemLimit, &cfg.PointsExpiryDays, &cfg.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *LoyaltyHandler) ListTiers(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, business_id::text, name, min_points, multiplier, benefits, sort_order, created_at
		FROM loyalty_tiers WHERE business_id=$1 ORDER BY min_points`, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	tiers := []model.LoyaltyTier{}
	for rows.Next() {
		var t model.LoyaltyTier
		rows.Scan(&t.ID, &t.BusinessID, &t.Name, &t.MinPoints, &t.Multiplier, &t.Benefits, &t.SortOrder, &t.CreatedAt)
		tiers = append(tiers, t)
	}
	c.JSON(http.StatusOK, tiers)
}

func (h *LoyaltyHandler) UpsertTier(c *gin.Context) {
	if !loyaltyManager(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "managers only"})
		return
	}
	businessID := c.GetString("business_id")
	var b struct {
		ID         *string `json:"id"`
		Name       string  `json:"name" binding:"required"`
		MinPoints  int     `json:"min_points"`
		Multiplier float64 `json:"multiplier"`
		Benefits   *string `json:"benefits"`
		SortOrder  int     `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if b.Multiplier <= 0 {
		b.Multiplier = 1.0
	}
	var t model.LoyaltyTier
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO loyalty_tiers (business_id, name, min_points, multiplier, benefits, sort_order)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (business_id, name) DO UPDATE
		  SET min_points=$3, multiplier=$4, benefits=$5, sort_order=$6
		RETURNING id::text, business_id::text, name, min_points, multiplier, benefits, sort_order, created_at`,
		businessID, b.Name, b.MinPoints, b.Multiplier, b.Benefits, b.SortOrder,
	).Scan(&t.ID, &t.BusinessID, &t.Name, &t.MinPoints, &t.Multiplier, &t.Benefits, &t.SortOrder, &t.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
}

func (h *LoyaltyHandler) DeleteTier(c *gin.Context) {
	if !loyaltyManager(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "managers only"})
		return
	}
	h.DB.Exec(c.Request.Context(),
		`DELETE FROM loyalty_tiers WHERE id=$1 AND business_id=$2`,
		c.Param("id"), c.GetString("business_id"))
	c.Status(http.StatusNoContent)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Reward Catalog
// ═══════════════════════════════════════════════════════════════════════════════

const rewardCols = `id::text, business_id::text, name, description, reward_type, points_required,
	discount_type, discount_value, is_active, visible, start_date::text, end_date::text,
	max_redemptions, per_customer_limit, applicable_fuel_grades, applicable_products,
	cost_estimate, redemption_count, scope, branch_id::text, created_by::text, created_at, updated_at`

func scanReward(row interface{ Scan(...any) error }, r *model.LoyaltyReward) error {
	var fuelGrades, products []byte
	err := row.Scan(&r.ID, &r.BusinessID, &r.Name, &r.Description, &r.RewardType, &r.PointsRequired,
		&r.DiscountType, &r.DiscountValue, &r.IsActive, &r.Visible, &r.StartDate, &r.EndDate,
		&r.MaxRedemptions, &r.PerCustomerLimit, &fuelGrades, &products,
		&r.CostEstimate, &r.RedemptionCount, &r.Scope, &r.BranchID, &r.CreatedBy, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return err
	}
	_ = json.Unmarshal(fuelGrades, &r.ApplicableFuelGrades)
	_ = json.Unmarshal(products, &r.ApplicableProducts)
	if r.ApplicableFuelGrades == nil {
		r.ApplicableFuelGrades = []string{}
	}
	if r.ApplicableProducts == nil {
		r.ApplicableProducts = []string{}
	}
	return nil
}

func (h *LoyaltyHandler) ListRewards(c *gin.Context) {
	businessID := c.GetString("business_id")
	// Managers see all; everyone else sees active+visible only.
	where := "business_id=$1"
	if !loyaltyManager(c) {
		where += " AND is_active=true AND visible=true"
	}
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT `+rewardCols+` FROM loyalty_rewards WHERE `+where+` ORDER BY points_required`, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	rewards := []model.LoyaltyReward{}
	for rows.Next() {
		var r model.LoyaltyReward
		if err := scanReward(rows, &r); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		rewards = append(rewards, r)
	}
	c.JSON(http.StatusOK, rewards)
}

func (h *LoyaltyHandler) CreateReward(c *gin.Context) {
	if !loyaltyManager(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "managers only"})
		return
	}
	businessID := c.GetString("business_id")
	var b rewardBody
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	fg, _ := json.Marshal(orEmpty(b.ApplicableFuelGrades))
	pr, _ := json.Marshal(orEmpty(b.ApplicableProducts))
	var r model.LoyaltyReward
	err := scanReward(h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO loyalty_rewards
		  (business_id, name, description, reward_type, points_required, discount_type,
		   discount_value, is_active, visible, start_date, end_date, max_redemptions,
		   per_customer_limit, applicable_fuel_grades, applicable_products, cost_estimate,
		   scope, branch_id, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,true),COALESCE($9,true),$10::date,$11::date,
		        $12,$13,$14,$15,$16,COALESCE($17,'organization'),$18::uuid,NULLIF($19,'')::uuid)
		RETURNING `+rewardCols,
		businessID, b.Name, b.Description, b.RewardType, b.PointsRequired, b.DiscountType,
		b.DiscountValue, b.IsActive, b.Visible, b.StartDate, b.EndDate, b.MaxRedemptions,
		b.PerCustomerLimit, fg, pr, b.CostEstimate, b.Scope, nullableUUID(derefStr(b.BranchID)),
		c.GetString("user_id"),
	), &r)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, r)
}

func (h *LoyaltyHandler) UpdateReward(c *gin.Context) {
	if !loyaltyManager(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "managers only"})
		return
	}
	businessID := c.GetString("business_id")
	var b rewardBody
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	fg, _ := json.Marshal(orEmpty(b.ApplicableFuelGrades))
	pr, _ := json.Marshal(orEmpty(b.ApplicableProducts))
	var r model.LoyaltyReward
	err := scanReward(h.DB.QueryRow(c.Request.Context(), `
		UPDATE loyalty_rewards SET
		  name=$3, description=$4, reward_type=$5, points_required=$6, discount_type=$7,
		  discount_value=$8, is_active=COALESCE($9,is_active), visible=COALESCE($10,visible),
		  start_date=$11::date, end_date=$12::date, max_redemptions=$13, per_customer_limit=$14,
		  applicable_fuel_grades=$15, applicable_products=$16, cost_estimate=$17, updated_at=NOW()
		WHERE id=$1 AND business_id=$2
		RETURNING `+rewardCols,
		c.Param("id"), businessID, b.Name, b.Description, b.RewardType, b.PointsRequired,
		b.DiscountType, b.DiscountValue, b.IsActive, b.Visible, b.StartDate, b.EndDate,
		b.MaxRedemptions, b.PerCustomerLimit, fg, pr, b.CostEstimate,
	), &r)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, r)
}

func (h *LoyaltyHandler) DeleteReward(c *gin.Context) {
	if !loyaltyManager(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "managers only"})
		return
	}
	h.DB.Exec(c.Request.Context(),
		`DELETE FROM loyalty_rewards WHERE id=$1 AND business_id=$2`,
		c.Param("id"), c.GetString("business_id"))
	c.Status(http.StatusNoContent)
}

type rewardBody struct {
	Name             string   `json:"name" binding:"required"`
	Description      string   `json:"description"`
	RewardType       string   `json:"reward_type" binding:"required"`
	PointsRequired   int      `json:"points_required" binding:"required"`
	DiscountType     *string  `json:"discount_type"`
	DiscountValue    *float64 `json:"discount_value"`
	IsActive         *bool    `json:"is_active"`
	Visible          *bool    `json:"visible"`
	StartDate        *string  `json:"start_date"`
	EndDate          *string  `json:"end_date"`
	MaxRedemptions   *int     `json:"max_redemptions"`
	PerCustomerLimit *int     `json:"per_customer_limit"`
	ApplicableFuelGrades []string `json:"applicable_fuel_grades"`
	ApplicableProducts   []string `json:"applicable_products"`
	CostEstimate     float64  `json:"cost_estimate"`
	Scope            *string  `json:"scope"`
	BranchID         *string  `json:"branch_id"`
}

func orEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// ═══════════════════════════════════════════════════════════════════════════════
// Earning & Manual Adjustment
// ═══════════════════════════════════════════════════════════════════════════════

// EarnPoints  POST /loyalty/customers/:id/earn
// Computes points from spend using config × tier multiplier × active campaigns.
func (h *LoyaltyHandler) EarnPoints(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	customerID := c.Param("id")
	var b struct {
		Source         string  `json:"source"`  // fuel|store
		Amount         float64 `json:"amount"`  // JMD spent
		PremiumFuel    bool    `json:"premium_fuel"`
		IdempotencyKey string  `json:"idempotency_key"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Earning rate from config.
	var fuelRate, storeRate float64
	h.DB.QueryRow(ctx, `SELECT fuel_points_per_100, store_points_per_100 FROM loyalty_config WHERE business_id=$1`,
		businessID).Scan(&fuelRate, &storeRate)
	if fuelRate == 0 { fuelRate = 1 }
	if storeRate == 0 { storeRate = 2 }
	rate := fuelRate
	if b.Source == "store" {
		rate = storeRate
	}
	base := (b.Amount / 100.0) * rate

	// Tier multiplier (current balance determines tier).
	var curPoints int
	h.DB.QueryRow(ctx, `SELECT loyalty_points FROM customers WHERE id=$1 AND business_id=$2`,
		customerID, businessID).Scan(&curPoints)
	_, tierMult := h.recomputeTier(ctx, businessID, curPoints)

	// Active campaign multiplier / bonus.
	campMult, bonus := h.activeCampaignBoost(ctx, businessID, b.Source, b.PremiumFuel, b.Amount)

	points := int(base*tierMult*campMult) + bonus
	if points <= 0 {
		c.JSON(http.StatusOK, gin.H{"points_earned": 0})
		return
	}

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback(ctx)
	newBal, err := h.applyPoints(ctx, tx, businessID, c.GetString("branch_id"), customerID,
		"earn", points, b.Source, "", "", c.GetString("user_id"), b.IdempotencyKey)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"points_earned": points, "balance": newBal})
}

func (h *LoyaltyHandler) activeCampaignBoost(ctx context.Context, businessID, source string, premium bool, amount float64) (float64, int) {
	rows, err := h.DB.Query(ctx, `
		SELECT campaign_type, multiplier, bonus_points, threshold_amount, applies_to
		FROM loyalty_campaigns
		WHERE business_id=$1 AND is_active=true
		  AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE`, businessID)
	if err != nil || rows == nil {
		return 1.0, 0
	}
	defer rows.Close()
	mult := 1.0
	bonus := 0
	for rows.Next() {
		var ctype, applies string
		var m, thr float64
		var bp int
		rows.Scan(&ctype, &m, &bp, &thr, &applies)
		if !campaignApplies(applies, source, premium) {
			continue
		}
		switch ctype {
		case "multiplier", "double_points":
			if m > mult {
				mult = m
			}
		case "bonus_threshold":
			if amount >= thr {
				bonus += bp
			}
		}
	}
	return mult, bonus
}

func campaignApplies(applies, source string, premium bool) bool {
	switch applies {
	case "all":
		return true
	case "fuel":
		return source == "fuel"
	case "store":
		return source == "store"
	case "premium_fuel":
		return source == "fuel" && premium
	}
	return false
}

// AdjustPoints  POST /loyalty/customers/:id/adjust  (manual, managers only, audited)
func (h *LoyaltyHandler) AdjustPoints(c *gin.Context) {
	if !loyaltyManager(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "managers only"})
		return
	}
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	customerID := c.Param("id")
	var b struct {
		Delta  int    `json:"delta" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback(ctx)
	newBal, err := h.applyPoints(ctx, tx, businessID, c.GetString("branch_id"), customerID,
		"adjust", b.Delta, "manual", b.Reason, "", c.GetString("user_id"), "")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"balance": newBal})
}

// ═══════════════════════════════════════════════════════════════════════════════
// Redemption Engine
// ═══════════════════════════════════════════════════════════════════════════════

// Redeem  POST /loyalty/customers/:id/redeem
// Verify points → availability → limits → deduct → record → audit → apply.
func (h *LoyaltyHandler) Redeem(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	customerID := c.Param("id")
	var b struct {
		RewardID       string `json:"reward_id" binding:"required"`
		IdempotencyKey string `json:"idempotency_key"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Idempotent replay.
	if b.IdempotencyKey != "" {
		var existing model.LoyaltyRedemption
		if err := h.DB.QueryRow(ctx, `
			SELECT id::text, status, approval_level, points_spent, reward_name
			FROM loyalty_redemptions WHERE idempotency_key=$1`, b.IdempotencyKey,
		).Scan(&existing.ID, &existing.Status, &existing.ApprovalLevel, &existing.PointsSpent, &existing.RewardName); err == nil {
			c.JSON(http.StatusOK, existing)
			return
		}
	}

	// Load reward + validate availability.
	var r model.LoyaltyReward
	if err := scanReward(h.DB.QueryRow(ctx,
		`SELECT `+rewardCols+` FROM loyalty_rewards WHERE id=$1 AND business_id=$2`,
		b.RewardID, businessID), &r); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "reward not found"})
		return
	}
	if !r.IsActive {
		c.JSON(http.StatusConflict, gin.H{"error": "reward is not active"})
		return
	}
	today := time.Now().Format("2006-01-02")
	if r.StartDate != nil && *r.StartDate > today {
		c.JSON(http.StatusConflict, gin.H{"error": "reward not yet available"})
		return
	}
	if r.EndDate != nil && *r.EndDate < today {
		c.JSON(http.StatusConflict, gin.H{"error": "reward has expired"})
		return
	}
	if r.MaxRedemptions != nil && r.RedemptionCount >= *r.MaxRedemptions {
		c.JSON(http.StatusConflict, gin.H{"error": "reward fully redeemed"})
		return
	}

	// Per-customer limit.
	if r.PerCustomerLimit != nil {
		var used int
		h.DB.QueryRow(ctx,
			`SELECT COUNT(*) FROM loyalty_redemptions WHERE customer_id=$1 AND reward_id=$2 AND status IN ('applied','approved','pending')`,
			customerID, b.RewardID).Scan(&used)
		if used >= *r.PerCustomerLimit {
			c.JSON(http.StatusConflict, gin.H{"error": "per-customer limit reached"})
			return
		}
	}

	// Daily / monthly fraud limits.
	var cfg model.LoyaltyConfig
	h.DB.QueryRow(ctx, `SELECT daily_redeem_limit, monthly_redeem_limit, auto_approve_max, supervisor_approve_max
		FROM loyalty_config WHERE business_id=$1`, businessID,
	).Scan(&cfg.DailyRedeemLimit, &cfg.MonthlyRedeemLimit, &cfg.AutoApproveMax, &cfg.SupervisorApproveMax)
	if cfg.DailyRedeemLimit == 0 { cfg.DailyRedeemLimit = 5 }
	if cfg.MonthlyRedeemLimit == 0 { cfg.MonthlyRedeemLimit = 30 }
	if cfg.AutoApproveMax == 0 { cfg.AutoApproveMax = 1000 }
	if cfg.SupervisorApproveMax == 0 { cfg.SupervisorApproveMax = 5000 }

	var dayCount, monthCount int
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM loyalty_redemptions
		WHERE customer_id=$1 AND created_at::date = CURRENT_DATE AND status != 'rejected'`, customerID).Scan(&dayCount)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM loyalty_redemptions
		WHERE customer_id=$1 AND created_at >= date_trunc('month', NOW()) AND status != 'rejected'`, customerID).Scan(&monthCount)
	if dayCount >= cfg.DailyRedeemLimit {
		c.JSON(http.StatusConflict, gin.H{"error": "daily redemption limit reached"})
		return
	}
	if monthCount >= cfg.MonthlyRedeemLimit {
		c.JSON(http.StatusConflict, gin.H{"error": "monthly redemption limit reached"})
		return
	}

	// Determine approval level.
	approval := "auto"
	status := "applied"
	if r.PointsRequired >= cfg.SupervisorApproveMax {
		approval, status = "manager", "pending"
	} else if r.PointsRequired >= cfg.AutoApproveMax {
		approval, status = "supervisor", "pending"
	}

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback(ctx)

	// For auto-approval, deduct now; pending defers deduction to approval.
	if status == "applied" {
		if _, err := h.applyPoints(ctx, tx, businessID, c.GetString("branch_id"), customerID,
			"redeem", -r.PointsRequired, "redemption", r.Name, b.RewardID,
			c.GetString("user_id"), "redeem:"+nz(b.IdempotencyKey)); err != nil {
			if err == errInsufficient {
				c.JSON(http.StatusConflict, gin.H{"error": "insufficient points"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
			return
		}
		tx.Exec(ctx, `UPDATE loyalty_rewards SET redemption_count=redemption_count+1 WHERE id=$1`, b.RewardID)
	} else {
		// Pre-check balance so a pending request that can never be funded is rejected up front.
		var bal int
		tx.QueryRow(ctx, `SELECT loyalty_points FROM customers WHERE id=$1 AND business_id=$2`,
			customerID, businessID).Scan(&bal)
		if bal < r.PointsRequired {
			c.JSON(http.StatusConflict, gin.H{"error": "insufficient points"})
			return
		}
	}

	var red model.LoyaltyRedemption
	err = tx.QueryRow(ctx, `
		INSERT INTO loyalty_redemptions
		  (business_id, branch_id, customer_id, reward_id, reward_name, points_spent,
		   status, approval_level, idempotency_key, requested_by)
		VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8,NULLIF($9,''),$10::uuid)
		RETURNING id::text, business_id::text, branch_id::text, customer_id::text, reward_id::text,
		          reward_name, points_spent, status, approval_level, requested_by::text,
		          reviewed_by::text, reviewed_at, created_at`,
		businessID, nullableUUID(c.GetString("branch_id")), customerID, b.RewardID, r.Name,
		r.PointsRequired, status, approval, b.IdempotencyKey, c.GetString("user_id"),
	).Scan(&red.ID, &red.BusinessID, &red.BranchID, &red.CustomerID, &red.RewardID,
		&red.RewardName, &red.PointsSpent, &red.Status, &red.ApprovalLevel, &red.RequestedBy,
		&red.ReviewedBy, &red.ReviewedAt, &red.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, red)
}

func nz(s string) string {
	if s == "" {
		return "auto"
	}
	return s
}

// ListRedemptions  GET /loyalty/redemptions?status=pending
func (h *LoyaltyHandler) ListRedemptions(c *gin.Context) {
	businessID := c.GetString("business_id")
	statusFilter := c.Query("status")
	q := `SELECT r.id::text, r.business_id::text, r.branch_id::text, r.customer_id::text,
	             cu.name, r.reward_id::text, r.reward_name, r.points_spent, r.status,
	             r.approval_level, r.requested_by::text, r.reviewed_by::text, r.reviewed_at, r.created_at
	      FROM loyalty_redemptions r JOIN customers cu ON cu.id=r.customer_id
	      WHERE r.business_id=$1`
	args := []interface{}{businessID}
	if statusFilter != "" {
		q += ` AND r.status=$2`
		args = append(args, statusFilter)
	}
	q += ` ORDER BY r.created_at DESC LIMIT 200`
	rows, err := h.DB.Query(c.Request.Context(), q, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	out := []model.LoyaltyRedemption{}
	for rows.Next() {
		var r model.LoyaltyRedemption
		rows.Scan(&r.ID, &r.BusinessID, &r.BranchID, &r.CustomerID, &r.CustomerName,
			&r.RewardID, &r.RewardName, &r.PointsSpent, &r.Status, &r.ApprovalLevel,
			&r.RequestedBy, &r.ReviewedBy, &r.ReviewedAt, &r.CreatedAt)
		out = append(out, r)
	}
	c.JSON(http.StatusOK, out)
}

// ReviewRedemption  PATCH /loyalty/redemptions/:id  { decision: approve|reject }
func (h *LoyaltyHandler) ReviewRedemption(c *gin.Context) {
	if !loyaltyManager(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "managers only"})
		return
	}
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	id := c.Param("id")
	var b struct {
		Decision string `json:"decision" binding:"required"` // approve | reject
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback(ctx)

	var customerID, rewardID, rewardName, status string
	var points int
	if err := tx.QueryRow(ctx,
		`SELECT customer_id::text, COALESCE(reward_id::text,''), reward_name, points_spent, status
		 FROM loyalty_redemptions WHERE id=$1 AND business_id=$2 FOR UPDATE`,
		id, businessID).Scan(&customerID, &rewardID, &rewardName, &points, &status); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "redemption not found"})
		return
	}
	if status != "pending" {
		c.JSON(http.StatusConflict, gin.H{"error": "redemption already " + status})
		return
	}

	newStatus := "rejected"
	if b.Decision == "approve" {
		newStatus = "applied"
		if _, err := h.applyPoints(ctx, tx, businessID, c.GetString("branch_id"), customerID,
			"redeem", -points, "redemption", rewardName, id, c.GetString("user_id"), "redeem-approve:"+id); err != nil {
			if err == errInsufficient {
				c.JSON(http.StatusConflict, gin.H{"error": "customer no longer has enough points"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
			return
		}
		if rewardID != "" {
			tx.Exec(ctx, `UPDATE loyalty_rewards SET redemption_count=redemption_count+1 WHERE id=$1`, rewardID)
		}
	}
	tx.Exec(ctx,
		`UPDATE loyalty_redemptions SET status=$1, reviewed_by=NULLIF($2,'')::uuid, reviewed_at=NOW() WHERE id=$3`,
		newStatus, c.GetString("user_id"), id)
	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": newStatus})
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wallet & History
// ═══════════════════════════════════════════════════════════════════════════════

// GetWallet  GET /loyalty/customers/:id/wallet
func (h *LoyaltyHandler) GetWallet(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	customerID := c.Param("id")

	var w model.LoyaltyWallet
	w.CustomerID = customerID
	if err := h.DB.QueryRow(ctx,
		`SELECT name, loyalty_points, lifetime_earned, lifetime_redeemed, tier
		 FROM customers WHERE id=$1 AND business_id=$2`, customerID, businessID,
	).Scan(&w.CustomerName, &w.CurrentPoints, &w.LifetimePointsEarned, &w.LifetimePointsRedeemed, &w.Tier); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "customer not found"})
		return
	}

	_, w.TierMultiplier = h.recomputeTier(ctx, businessID, w.CurrentPoints)
	// Next tier.
	var nextName string
	var nextMin int
	if err := h.DB.QueryRow(ctx,
		`SELECT name, min_points FROM loyalty_tiers WHERE business_id=$1 AND min_points > $2 ORDER BY min_points LIMIT 1`,
		businessID, w.CurrentPoints).Scan(&nextName, &nextMin); err == nil {
		w.NextTier = &nextName
		w.PointsToNextTier = nextMin - w.CurrentPoints
	}

	// Available rewards (active, visible, affordable or not — show all active visible).
	rows, _ := h.DB.Query(ctx,
		`SELECT `+rewardCols+` FROM loyalty_rewards
		 WHERE business_id=$1 AND is_active=true AND visible=true ORDER BY points_required`, businessID)
	w.AvailableRewards = []model.LoyaltyReward{}
	if rows != nil {
		for rows.Next() {
			var r model.LoyaltyReward
			if scanReward(rows, &r) == nil {
				w.AvailableRewards = append(w.AvailableRewards, r)
			}
		}
		rows.Close()
	}

	// Recent redemptions.
	rrows, _ := h.DB.Query(ctx,
		`SELECT id::text, reward_name, points_spent, status, approval_level, created_at
		 FROM loyalty_redemptions WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 10`, customerID)
	w.RecentRedemptions = []model.LoyaltyRedemption{}
	if rrows != nil {
		for rrows.Next() {
			var r model.LoyaltyRedemption
			rrows.Scan(&r.ID, &r.RewardName, &r.PointsSpent, &r.Status, &r.ApprovalLevel, &r.CreatedAt)
			w.RecentRedemptions = append(w.RecentRedemptions, r)
		}
		rrows.Close()
	}

	// Points history.
	trows, _ := h.DB.Query(ctx,
		`SELECT id::text, tx_type, points_delta, balance_after, source, reason, created_at
		 FROM loyalty_transactions WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 25`, customerID)
	w.PointsHistory = []model.LoyaltyTransaction{}
	if trows != nil {
		for trows.Next() {
			var t model.LoyaltyTransaction
			trows.Scan(&t.ID, &t.TxType, &t.PointsDelta, &t.BalanceAfter, &t.Source, &t.Reason, &t.CreatedAt)
			w.PointsHistory = append(w.PointsHistory, t)
		}
		trows.Close()
	}

	c.JSON(http.StatusOK, w)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Campaigns
// ═══════════════════════════════════════════════════════════════════════════════

func (h *LoyaltyHandler) ListCampaigns(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, business_id::text, name, description, campaign_type, multiplier,
		       bonus_points, threshold_amount, applies_to, start_date::text, end_date::text,
		       is_active, participation, points_issued, created_by::text, created_at
		FROM loyalty_campaigns WHERE business_id=$1 ORDER BY start_date DESC`, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	out := []model.LoyaltyCampaign{}
	for rows.Next() {
		var cp model.LoyaltyCampaign
		rows.Scan(&cp.ID, &cp.BusinessID, &cp.Name, &cp.Description, &cp.CampaignType, &cp.Multiplier,
			&cp.BonusPoints, &cp.ThresholdAmount, &cp.AppliesTo, &cp.StartDate, &cp.EndDate,
			&cp.IsActive, &cp.Participation, &cp.PointsIssued, &cp.CreatedBy, &cp.CreatedAt)
		out = append(out, cp)
	}
	c.JSON(http.StatusOK, out)
}

func (h *LoyaltyHandler) CreateCampaign(c *gin.Context) {
	if !loyaltyManager(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "managers only"})
		return
	}
	businessID := c.GetString("business_id")
	var b struct {
		Name            string  `json:"name" binding:"required"`
		Description     string  `json:"description"`
		CampaignType    string  `json:"campaign_type"`
		Multiplier      float64 `json:"multiplier"`
		BonusPoints     int     `json:"bonus_points"`
		ThresholdAmount float64 `json:"threshold_amount"`
		AppliesTo       string  `json:"applies_to"`
		StartDate       string  `json:"start_date" binding:"required"`
		EndDate         string  `json:"end_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if b.CampaignType == "" { b.CampaignType = "multiplier" }
	if b.Multiplier <= 0 { b.Multiplier = 2.0 }
	if b.AppliesTo == "" { b.AppliesTo = "all" }
	var cp model.LoyaltyCampaign
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO loyalty_campaigns
		  (business_id, name, description, campaign_type, multiplier, bonus_points,
		   threshold_amount, applies_to, start_date, end_date, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::date,NULLIF($11,'')::uuid)
		RETURNING id::text, business_id::text, name, description, campaign_type, multiplier,
		          bonus_points, threshold_amount, applies_to, start_date::text, end_date::text,
		          is_active, participation, points_issued, created_by::text, created_at`,
		businessID, b.Name, b.Description, b.CampaignType, b.Multiplier, b.BonusPoints,
		b.ThresholdAmount, b.AppliesTo, b.StartDate, b.EndDate, c.GetString("user_id"),
	).Scan(&cp.ID, &cp.BusinessID, &cp.Name, &cp.Description, &cp.CampaignType, &cp.Multiplier,
		&cp.BonusPoints, &cp.ThresholdAmount, &cp.AppliesTo, &cp.StartDate, &cp.EndDate,
		&cp.IsActive, &cp.Participation, &cp.PointsIssued, &cp.CreatedBy, &cp.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, cp)
}

func (h *LoyaltyHandler) ToggleCampaign(c *gin.Context) {
	if !loyaltyManager(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "managers only"})
		return
	}
	var b struct{ IsActive bool `json:"is_active"` }
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.DB.Exec(c.Request.Context(),
		`UPDATE loyalty_campaigns SET is_active=$1 WHERE id=$2 AND business_id=$3`,
		b.IsActive, c.Param("id"), c.GetString("business_id"))
	c.JSON(http.StatusOK, gin.H{"is_active": b.IsActive})
}

// ═══════════════════════════════════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════════════════════════════════

func (h *LoyaltyHandler) GetAnalytics(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	var a model.LoyaltyAnalytics
	a.TierDistribution = map[string]int{}

	h.DB.QueryRow(ctx, `SELECT COUNT(*), COALESCE(SUM(lifetime_earned),0), COALESCE(SUM(lifetime_redeemed),0), COALESCE(SUM(loyalty_points),0)
		FROM customers WHERE business_id=$1`, businessID,
	).Scan(&a.TotalMembers, &a.TotalPointsIssued, &a.TotalPointsRedeemed, &a.OutstandingPoints)

	trows, _ := h.DB.Query(ctx, `SELECT tier, COUNT(*) FROM customers WHERE business_id=$1 GROUP BY tier`, businessID)
	if trows != nil {
		for trows.Next() {
			var tier string; var n int
			trows.Scan(&tier, &n)
			a.TierDistribution[tier] = n
		}
		trows.Close()
	}

	crows, _ := h.DB.Query(ctx, `
		SELECT id::text, name, loyalty_points, lifetime_earned, tier
		FROM customers WHERE business_id=$1 ORDER BY lifetime_earned DESC LIMIT 10`, businessID)
	a.TopCustomers = []model.TopCustomer{}
	if crows != nil {
		for crows.Next() {
			var tc model.TopCustomer
			crows.Scan(&tc.CustomerID, &tc.Name, &tc.CurrentPoints, &tc.LifetimeEarned, &tc.Tier)
			a.TopCustomers = append(a.TopCustomers, tc)
		}
		crows.Close()
	}

	rrows, _ := h.DB.Query(ctx, `
		SELECT id::text, name, redemption_count, cost_estimate
		FROM loyalty_rewards WHERE business_id=$1 ORDER BY redemption_count DESC LIMIT 20`, businessID)
	a.RewardPerformance = []model.RewardPerformance{}
	if rrows != nil {
		for rrows.Next() {
			var rp model.RewardPerformance
			var cost float64
			rrows.Scan(&rp.RewardID, &rp.Name, &rp.RedemptionCount, &cost)
			rp.EstimatedCost = cost * float64(rp.RedemptionCount)
			a.RewardPerformance = append(a.RewardPerformance, rp)
		}
		rrows.Close()
	}

	c.JSON(http.StatusOK, a)
}
