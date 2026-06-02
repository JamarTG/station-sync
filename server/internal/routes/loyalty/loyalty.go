package loyalty

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(r *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.LoyaltyHandler{DB: db}

	// ── Config & tiers ───────────────────────────────────────────────────────
	r.GET("/loyalty/config",  h.GetConfig)
	r.PUT("/loyalty/config",  h.UpsertConfig)
	r.GET("/loyalty/tiers",   h.ListTiers)
	r.PUT("/loyalty/tiers",   h.UpsertTier)
	r.DELETE("/loyalty/tiers/:id", h.DeleteTier)

	// ── Reward catalog ───────────────────────────────────────────────────────
	r.GET("/loyalty/rewards",        h.ListRewards)
	r.POST("/loyalty/rewards",       h.CreateReward)
	r.PATCH("/loyalty/rewards/:id",  h.UpdateReward)
	r.DELETE("/loyalty/rewards/:id", h.DeleteReward)

	// ── Points: earn / adjust / redeem + wallet ──────────────────────────────
	r.GET("/loyalty/customers/:id/wallet",  h.GetWallet)
	r.POST("/loyalty/customers/:id/earn",   h.EarnPoints)
	r.POST("/loyalty/customers/:id/adjust", h.AdjustPoints)
	r.POST("/loyalty/customers/:id/redeem", h.Redeem)

	// ── Redemption approvals ─────────────────────────────────────────────────
	r.GET("/loyalty/redemptions",       h.ListRedemptions)
	r.PATCH("/loyalty/redemptions/:id", h.ReviewRedemption)

	// ── Campaigns ────────────────────────────────────────────────────────────
	r.GET("/loyalty/campaigns",            h.ListCampaigns)
	r.POST("/loyalty/campaigns",           h.CreateCampaign)
	r.PATCH("/loyalty/campaigns/:id",      h.ToggleCampaign)

	// ── Analytics ────────────────────────────────────────────────────────────
	r.GET("/loyalty/analytics", h.GetAnalytics)
}
