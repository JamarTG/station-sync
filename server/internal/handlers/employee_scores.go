package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

// ─── Handlers ─────────────────────────────────────────────────────────────────

type EmployeeScoresHandler struct {
	DB *pgxpool.Pool
}

// ── CPS endpoints ─────────────────────────────────────────────────────────────

// GetCPSRankings  GET /cps/rankings?scope=company|branch&period=alltime|monthly|quarterly|annual
func (h *EmployeeScoresHandler) GetCPSRankings(c *gin.Context) {
	businessID := c.GetString("business_id")
	scope := c.DefaultQuery("scope", "company")
	period := c.DefaultQuery("period", "alltime")
	branchID := c.GetString("branch_id")

	var rows interface{ Next() bool; Scan(...any) error; Close() }
	var err error

	if scope == "branch" && branchID != "" && period == "alltime" {
		rows, err = h.DB.Query(c.Request.Context(), `
			SELECT ROW_NUMBER() OVER (ORDER BY cls.cps_lifetime_final DESC) AS rank,
			       cls.cashier_id::text, u.name, u.role,
			       cls.current_tier, cls.cps_lifetime_final, cls.cps_raw_ewma, cls.cps_peak,
			       cls.total_shifts, cls.confidence_weight,
			       cls.current_perfect_streak, cls.best_perfect_streak
			FROM cashier_lifetime_stats cls
			JOIN users u ON u.id=cls.cashier_id
			WHERE cls.business_id=$1 AND u.branch_id=$2::uuid
			ORDER BY cls.cps_lifetime_final DESC LIMIT 100`,
			businessID, branchID)
	} else if period != "alltime" {
		since := periodSince(period)
		rows, err = h.DB.Query(c.Request.Context(), `
			SELECT ROW_NUMBER() OVER (ORDER BY AVG(css.cps_shift_final) DESC) AS rank,
			       css.cashier_id::text, u.name, u.role,
			       COALESCE(cls.current_tier,'Bronze') AS tier,
			       AVG(css.cps_shift_final) AS score,
			       AVG(css.cps_shift_final) AS ewma,
			       MAX(css.cps_shift_final) AS peak,
			       COUNT(*) AS shifts,
			       COALESCE(cls.confidence_weight,0),
			       COALESCE(cls.current_perfect_streak,0),
			       COALESCE(cls.best_perfect_streak,0)
			FROM cashier_shift_scores css
			JOIN users u ON u.id=css.cashier_id
			LEFT JOIN cashier_lifetime_stats cls ON cls.cashier_id=css.cashier_id
			WHERE css.business_id=$1 AND css.scored_at >= $2
			GROUP BY css.cashier_id, u.name, u.role, cls.current_tier, cls.confidence_weight,
			         cls.current_perfect_streak, cls.best_perfect_streak
			ORDER BY score DESC LIMIT 100`,
			businessID, since)
	} else {
		rows, err = h.DB.Query(c.Request.Context(), `
			SELECT ROW_NUMBER() OVER (ORDER BY cls.cps_lifetime_final DESC) AS rank,
			       cls.cashier_id::text, u.name, u.role,
			       cls.current_tier, cls.cps_lifetime_final, cls.cps_raw_ewma, cls.cps_peak,
			       cls.total_shifts, cls.confidence_weight,
			       cls.current_perfect_streak, cls.best_perfect_streak
			FROM cashier_lifetime_stats cls
			JOIN users u ON u.id=cls.cashier_id
			WHERE cls.business_id=$1
			ORDER BY cls.cps_lifetime_final DESC LIMIT 100`,
			businessID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	entries := scanRankingEntries(rows)
	c.JSON(http.StatusOK, entries)
}

// GetCashierStats  GET /users/:id/cps
func (h *EmployeeScoresHandler) GetCashierStats(c *gin.Context) {
	businessID := c.GetString("business_id")
	cashierID := c.Param("id")
	ctx := c.Request.Context()

	var stats model.CashierLifetimeStats
	err := h.DB.QueryRow(ctx, `
		SELECT cls.cashier_id::text, u.name, cls.business_id::text,
		       cls.total_shifts, cls.confidence_weight, cls.cps_raw_ewma,
		       cls.cps_lifetime_final, cls.cps_peak, cls.current_tier,
		       cls.current_perfect_streak, cls.best_perfect_streak,
		       cls.total_revenue_processed, cls.last_computed_at::text
		FROM cashier_lifetime_stats cls
		JOIN users u ON u.id=cls.cashier_id
		WHERE cls.cashier_id=$1 AND cls.business_id=$2`,
		cashierID, businessID,
	).Scan(&stats.CashierID, &stats.CashierName, &stats.BusinessID,
		&stats.TotalShifts, &stats.ConfidenceWeight, &stats.CPSRawEWMA,
		&stats.CPSLifetimeFinal, &stats.CPSPeak, &stats.CurrentTier,
		&stats.CurrentPerfectStreak, &stats.BestPerfectStreak,
		&stats.TotalRevenueProcessed, &stats.LastComputedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no CPS data for this cashier"})
		return
	}

	// Company rank
	h.DB.QueryRow(ctx,
		`SELECT COUNT(*)+1 FROM cashier_lifetime_stats WHERE business_id=$1 AND cps_lifetime_final > $2`,
		businessID, stats.CPSLifetimeFinal,
	).Scan(&stats.CompanyRank)

	// Recent shift scores
	recentRows, _ := h.DB.Query(ctx, `
		SELECT css.shift_id::text, s.date::text, css.cps_shift_final,
		       css.score_cash_accuracy, css.score_transaction_quality,
		       css.score_sales_effectiveness, css.score_attendance,
		       css.score_customer_service, css.score_compliance, css.score_team,
		       css.scored_at::text
		FROM cashier_shift_scores css
		JOIN shifts s ON s.id=css.shift_id
		WHERE css.cashier_id=$1 AND css.business_id=$2
		ORDER BY css.scored_at DESC LIMIT 10`,
		cashierID, businessID)

	type recentScore struct {
		ShiftID   string  `json:"shift_id"`
		Date      string  `json:"date"`
		Final     float64 `json:"cps_final"`
		CashAccuracy float64 `json:"cash_accuracy"`
		TxnQuality  float64 `json:"txn_quality"`
		Sales       float64 `json:"sales"`
		Attendance  float64 `json:"attendance"`
		CustService float64 `json:"customer_service"`
		Compliance  float64 `json:"compliance"`
		Team        float64 `json:"team"`
		ScoredAt    string  `json:"scored_at"`
	}
	var recent []recentScore
	if recentRows != nil {
		defer recentRows.Close()
		for recentRows.Next() {
			var r recentScore
			recentRows.Scan(&r.ShiftID, &r.Date, &r.Final,
				&r.CashAccuracy, &r.TxnQuality, &r.Sales, &r.Attendance,
				&r.CustService, &r.Compliance, &r.Team, &r.ScoredAt)
			recent = append(recent, r)
		}
	}
	if recent == nil {
		recent = []recentScore{}
	}

	// AI coaching insight
	var currentAvg, priorAvg float64
	h.DB.QueryRow(ctx,
		`SELECT COALESCE(AVG(cps_shift_final),0) FROM cashier_shift_scores
		 WHERE cashier_id=$1 AND scored_at > NOW()-INTERVAL '30 days'`, cashierID,
	).Scan(&currentAvg)
	h.DB.QueryRow(ctx,
		`SELECT COALESCE(AVG(cps_shift_final),0) FROM cashier_shift_scores
		 WHERE cashier_id=$1 AND scored_at BETWEEN NOW()-INTERVAL '60 days' AND NOW()-INTERVAL '30 days'`, cashierID,
	).Scan(&priorAvg)
	var top10 float64
	h.DB.QueryRow(ctx,
		`SELECT COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cps_lifetime_final), 0)
		 FROM cashier_lifetime_stats WHERE business_id=$1`, businessID,
	).Scan(&top10)

	coaching := GenerateCashierCoachingInsight(cpsInsightInput{
		EmployeeID:         cashierID,
		CurrentAvg:         currentAvg,
		PriorAvg:           priorAvg,
		TopTenPctThreshold: top10,
		WorstComponent:     "cash_accuracy", // simplified: ideally computed from recent scores
		WorstComponentScore: stats.CPSRawEWMA * 0.25,
		WorstComponentMax:  25,
		TotalShifts:        stats.TotalShifts,
		CurrentTier:        stats.CurrentTier,
	})

	c.JSON(http.StatusOK, gin.H{
		"stats":         stats,
		"recent_scores": recent,
		"coaching":      coaching,
	})
}

// ── APS endpoints ─────────────────────────────────────────────────────────────

// GetAPSRankings  GET /aps/rankings?scope=company|branch&period=alltime|monthly|quarterly|annual
func (h *EmployeeScoresHandler) GetAPSRankings(c *gin.Context) {
	businessID := c.GetString("business_id")
	scope := c.DefaultQuery("scope", "company")
	period := c.DefaultQuery("period", "alltime")
	branchID := c.GetString("branch_id")

	var rows interface{ Next() bool; Scan(...any) error; Close() }
	var err error

	if period != "alltime" {
		rows, err = h.DB.Query(c.Request.Context(), `
			SELECT ROW_NUMBER() OVER (ORDER BY AVG(aps.aps_shift_final) DESC) AS rank,
			       aps.attendant_id::text, u.name, u.role,
			       COALESCE(als.current_tier,'Bronze'),
			       AVG(aps.aps_shift_final), AVG(aps.aps_shift_final), MAX(aps.aps_shift_final),
			       COUNT(*), COALESCE(als.confidence_weight,0),
			       COALESCE(als.current_perfect_streak,0), COALESCE(als.best_perfect_streak,0)
			FROM attendant_shift_scores aps
			JOIN users u ON u.id=aps.attendant_id
			LEFT JOIN attendant_lifetime_stats als ON als.attendant_id=aps.attendant_id
			WHERE aps.business_id=$1 AND aps.scored_at>=$2
			GROUP BY aps.attendant_id, u.name, u.role, als.current_tier, als.confidence_weight,
			         als.current_perfect_streak, als.best_perfect_streak
			ORDER BY 6 DESC LIMIT 100`,
			businessID, periodSince(period))
	} else if scope == "branch" && branchID != "" {
		rows, err = h.DB.Query(c.Request.Context(), `
			SELECT ROW_NUMBER() OVER (ORDER BY als.aps_lifetime_final DESC) AS rank,
			       als.attendant_id::text, u.name, u.role,
			       als.current_tier, als.aps_lifetime_final, als.aps_raw_ewma, als.aps_peak,
			       als.total_shifts, als.confidence_weight,
			       als.current_perfect_streak, als.best_perfect_streak
			FROM attendant_lifetime_stats als
			JOIN users u ON u.id=als.attendant_id
			WHERE als.business_id=$1 AND u.branch_id=$2::uuid
			ORDER BY als.aps_lifetime_final DESC LIMIT 100`,
			businessID, branchID)
	} else {
		rows, err = h.DB.Query(c.Request.Context(), `
			SELECT ROW_NUMBER() OVER (ORDER BY als.aps_lifetime_final DESC) AS rank,
			       als.attendant_id::text, u.name, u.role,
			       als.current_tier, als.aps_lifetime_final, als.aps_raw_ewma, als.aps_peak,
			       als.total_shifts, als.confidence_weight,
			       als.current_perfect_streak, als.best_perfect_streak
			FROM attendant_lifetime_stats als
			JOIN users u ON u.id=als.attendant_id
			WHERE als.business_id=$1
			ORDER BY als.aps_lifetime_final DESC LIMIT 100`,
			businessID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	_ = scope // consumed above
	defer rows.Close()
	c.JSON(http.StatusOK, scanRankingEntries(rows))
}

// GetAttendantStats  GET /users/:id/aps
func (h *EmployeeScoresHandler) GetAttendantStats(c *gin.Context) {
	businessID := c.GetString("business_id")
	attendantID := c.Param("id")
	ctx := c.Request.Context()

	var stats model.AttendantLifetimeStats
	err := h.DB.QueryRow(ctx, `
		SELECT als.attendant_id::text, u.name, als.business_id::text,
		       als.total_shifts, als.confidence_weight, als.aps_raw_ewma,
		       als.aps_lifetime_final, als.aps_peak, als.current_tier,
		       als.current_perfect_streak, als.best_perfect_streak,
		       als.total_fuel_dispensed_litres, als.total_vehicles_served,
		       als.last_computed_at::text
		FROM attendant_lifetime_stats als
		JOIN users u ON u.id=als.attendant_id
		WHERE als.attendant_id=$1 AND als.business_id=$2`,
		attendantID, businessID,
	).Scan(&stats.AttendantID, &stats.AttendantName, &stats.BusinessID,
		&stats.TotalShifts, &stats.ConfidenceWeight, &stats.APSRawEWMA,
		&stats.APSLifetimeFinal, &stats.APSPeak, &stats.CurrentTier,
		&stats.CurrentPerfectStreak, &stats.BestPerfectStreak,
		&stats.TotalFuelDispensedLitres, &stats.TotalVehiclesServed,
		&stats.LastComputedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no APS data"})
		return
	}

	h.DB.QueryRow(ctx,
		`SELECT COUNT(*)+1 FROM attendant_lifetime_stats WHERE business_id=$1 AND aps_lifetime_final>$2`,
		businessID, stats.APSLifetimeFinal,
	).Scan(&stats.CompanyRank)

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

// SubmitFeedback  POST /employees/:id/feedback
func (h *EmployeeScoresHandler) SubmitFeedback(c *gin.Context) {
	employeeID := c.Param("id")
	businessID := c.GetString("business_id")
	submitterID := c.GetString("user_id")

	var body struct {
		ShiftID      *string `json:"shift_id"`
		FeedbackType string  `json:"feedback_type" binding:"required"`
		Source       string  `json:"source"`
		Score        int     `json:"score"`
		Notes        *string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Source == "" {
		body.Source = "supervisor"
	}
	if body.Score < 1 || body.Score > 5 {
		body.Score = 3
	}

	var fb model.EmployeeFeedback
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO employee_feedback
		  (business_id, shift_id, employee_id, submitted_by, feedback_type, source, score, notes)
		VALUES ($1, $2, $3, NULLIF($4,'')::uuid, $5, $6, $7, $8)
		RETURNING id::text, business_id::text, shift_id::text, employee_id::text,
		          submitted_by::text, feedback_type, source, score, notes, resolved, created_at`,
		businessID, body.ShiftID, employeeID, submitterID,
		body.FeedbackType, body.Source, body.Score, body.Notes,
	).Scan(&fb.ID, &fb.BusinessID, &fb.ShiftID, &fb.EmployeeID,
		&fb.SubmittedBy, &fb.FeedbackType, &fb.Source, &fb.Score, &fb.Notes,
		&fb.Resolved, &fb.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, fb)
}

// ── Tier distribution (for analytics) ────────────────────────────────────────

// GetTierDistribution  GET /cps/tier-distribution or /aps/tier-distribution
func (h *EmployeeScoresHandler) GetCPSTierDistribution(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT current_tier, COUNT(*) FROM cashier_lifetime_stats
		WHERE business_id=$1 GROUP BY current_tier ORDER BY MIN(cps_lifetime_final) DESC`,
		businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	dist := map[string]int{}
	for rows.Next() {
		var tier string; var count int
		rows.Scan(&tier, &count)
		dist[tier] = count
	}
	c.JSON(http.StatusOK, dist)
}

func (h *EmployeeScoresHandler) GetAPSTierDistribution(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT current_tier, COUNT(*) FROM attendant_lifetime_stats
		WHERE business_id=$1 GROUP BY current_tier ORDER BY MIN(aps_lifetime_final) DESC`,
		businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	dist := map[string]int{}
	for rows.Next() {
		var tier string; var count int
		rows.Scan(&tier, &count)
		dist[tier] = count
	}
	c.JSON(http.StatusOK, dist)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type rowScanner interface {
	Next() bool
	Scan(...any) error
	Close()
}

func scanRankingEntries(rows rowScanner) []model.EmployeeRankingEntry {
	var entries []model.EmployeeRankingEntry
	for rows.Next() {
		var e model.EmployeeRankingEntry
		rows.Scan(&e.Rank, &e.EmployeeID, &e.EmployeeName, &e.Role,
			&e.CurrentTier, &e.LifetimeFinal, &e.RawEWMA, &e.Peak,
			&e.TotalShifts, &e.ConfidenceWeight,
			&e.CurrentPerfectStreak, &e.BestPerfectStreak)
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []model.EmployeeRankingEntry{}
	}
	return entries
}

func periodSince(period string) time.Time {
	switch period {
	case "monthly":
		return time.Now().AddDate(0, -1, 0)
	case "quarterly":
		return time.Now().AddDate(0, -3, 0)
	case "annual":
		return time.Now().AddDate(-1, 0, 0)
	default:
		return time.Time{} // alltime
	}
}

// ─── Wire into shift close ─────────────────────────────────────────────────────

// TriggerEmployeeScoring fires CPS and APS scoring for a closing shift.
// Called as a goroutine from the shift Close handler.
func TriggerEmployeeScoring(shiftID, businessID, shiftType string, db *pgxpool.Pool) {
	ctx := context.Background()
	if shiftType == "convenience_store" {
		ComputeAndStoreCPSScore(ctx, db, shiftID, businessID)
	} else {
		// Service station: score both cashiers (supervisor) and attendants
		ComputeAndStoreCPSScore(ctx, db, shiftID, businessID)
		ComputeAndStoreAPSScore(ctx, db, shiftID, businessID)
	}
}
