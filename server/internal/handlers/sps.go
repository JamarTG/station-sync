package handlers

import (
	"context"
	"fmt"
	"math"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

// ─── Constants ────────────────────────────────────────────────────────────────

const (
	spsConfidenceConstant = 40.0  // shifts needed to reach 50% weighting
	spsAlpha              = 0.06  // EWMA decay
	spsLeagueDefault      = 60.0  // fallback league average when no history
	spsPerfectThreshold   = 90.0  // shift score that counts as "perfect"
	spsAllowableFuelLoss  = 0.15  // % allowable fuel shrinkage
)

// ─── SPSHandler ───────────────────────────────────────────────────────────────

type SPSHandler struct {
	DB *pgxpool.Pool
}

// ─── Tier helper ─────────────────────────────────────────────────────────────

func computeTier(sps float64) string {
	switch {
	case sps >= 93:
		return "Legend"
	case sps >= 86:
		return "Elite"
	case sps >= 78:
		return "Diamond"
	case sps >= 68:
		return "Platinum"
	case sps >= 55:
		return "Gold"
	case sps >= 40:
		return "Silver"
	default:
		return "Bronze"
	}
}

func clamp(v, lo, hi float64) float64 {
	return math.Max(lo, math.Min(hi, v))
}

// ─── Individual component scorers ────────────────────────────────────────────

// scoreSales returns 0-20. Compares shift's total deposits to supervisor's rolling average.
func scoreSales(ctx context.Context, db *pgxpool.Pool, shiftID, supervisorID string) (float64, float64) {
	var currentSales float64
	db.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE shift_id = $1`,
		shiftID,
	).Scan(&currentSales)

	var historicalAvg float64
	db.QueryRow(ctx, `
		SELECT COALESCE(AVG(total_sales), 0) FROM (
			SELECT SUM(d.amount) AS total_sales
			FROM deposits d
			JOIN shifts s ON s.id = d.shift_id
			WHERE s.supervisor_id = $1
			  AND s.end_time IS NOT NULL
			  AND s.id != $2
			GROUP BY s.id
			ORDER BY MAX(s.created_at) DESC
			LIMIT 10
		) sub`,
		supervisorID, shiftID,
	).Scan(&historicalAvg)

	if historicalAvg <= 0 {
		return 14.0, 1.0 // neutral default when no history
	}

	ser := currentSales / historicalAvg
	var pts float64
	switch {
	case ser >= 1.10:
		pts = 20
	case ser >= 1.00:
		pts = 18
	case ser >= 0.90:
		pts = 15
	case ser >= 0.80:
		pts = 11
	case ser >= 0.70:
		pts = 7
	default:
		pts = 3
	}
	return pts, ser
}

// scoreFuelVariance returns 0-15 and the variance %.
func scoreFuelVariance(ctx context.Context, db *pgxpool.Pool, shiftID string) (float64, float64) {
	var theoretical float64
	db.QueryRow(ctx, `
		SELECT COALESCE(SUM(
			COALESCE(opening_level,0) + COALESCE(delivery_litres,0) - COALESCE(closing_level,0)
		), 0)
		FROM tank_logs
		WHERE shift_id = $1
		  AND opening_level IS NOT NULL
		  AND closing_level IS NOT NULL`,
		shiftID,
	).Scan(&theoretical)

	var actual float64
	db.QueryRow(ctx, `
		SELECT COALESCE(SUM(ending_reading - starting_reading), 0)
		FROM nozzle_logs WHERE shift_id = $1`,
		shiftID,
	).Scan(&actual)

	if theoretical <= 0 || actual <= 0 {
		return 12.0, 0 // can't compute — conservative default
	}

	variancePct := math.Abs(theoretical-actual) / theoretical * 100
	adjusted := math.Max(0, variancePct-spsAllowableFuelLoss)

	var pts float64
	switch {
	case adjusted == 0:
		pts = 15
	case adjusted <= 0.10:
		pts = 14
	case adjusted <= 0.25:
		pts = 12
	case adjusted <= 0.50:
		pts = 9
	case adjusted <= 0.75:
		pts = 5
	default:
		pts = 0
	}
	return pts, variancePct
}

// scoreAttendance returns 0-12. Full score if shift is closed; partial for incomplete shifts.
func scoreAttendance(endTime *string) float64 {
	if endTime == nil || *endTime == "" {
		return 6.0 // shift not yet closed
	}
	return 12.0
}

// scoreTeam returns 0-10 based on how many attendants were on shift.
func scoreTeam(ctx context.Context, db *pgxpool.Pool, shiftID string) (float64, int) {
	var attendantCount int
	db.QueryRow(ctx,
		`SELECT COUNT(*) FROM shift_attendance WHERE shift_id = $1`,
		shiftID,
	).Scan(&attendantCount)

	var pts float64
	switch {
	case attendantCount >= 4:
		pts = 8.5
	case attendantCount == 3:
		pts = 8.0
	case attendantCount == 2:
		pts = 7.5
	case attendantCount == 1:
		pts = 7.0
	default:
		pts = 5.0 // no attendants logged
	}
	return pts, attendantCount
}

// scoreIncidents returns 0-6 and incident count.
func scoreIncidents(ctx context.Context, db *pgxpool.Pool, branchID *string, shiftStart, shiftEnd string) (float64, int) {
	if branchID == nil || *branchID == "" || shiftEnd == "" {
		return 6.0, 0
	}

	rows, err := db.Query(ctx, `
		SELECT status FROM issues
		WHERE branch_id = $1
		  AND created_at >= $2::timestamptz
		  AND created_at <= $3::timestamptz`,
		*branchID, shiftStart, shiftEnd,
	)
	if err != nil {
		return 6.0, 0
	}
	defer rows.Close()

	score := 6.0
	count := 0
	for rows.Next() {
		var status string
		rows.Scan(&status)
		count++
		if status == "Resolved" {
			score -= 0.5
		} else {
			score -= 1.0
		}
	}
	return math.Max(0, score), count
}

// ─── Bonus / penalty helpers ──────────────────────────────────────────────────

type adjustment struct {
	Type   string  `json:"type"`
	Amount float64 `json:"amount"`
	Reason string  `json:"reason"`
}

func computeBonuses(salesScore, cashScore, fuelScore float64) (float64, []adjustment) {
	var total float64
	var items []adjustment

	if cashScore >= 14 {
		total += 2.0
		items = append(items, adjustment{"zero_variance_cash", 2.0, "Near-zero cash variance"})
	}
	if fuelScore >= 14 {
		total += 2.0
		items = append(items, adjustment{"zero_variance_fuel", 2.0, "Near-zero fuel variance"})
	}
	if salesScore >= 20 {
		total += 1.0
		items = append(items, adjustment{"sales_overperform", 1.0, "Sales >10% above station average"})
	}
	return total, items
}

func computePenalties(attendantCount int, incidentScore float64) (float64, []adjustment) {
	var total float64
	var items []adjustment

	if attendantCount == 0 {
		total += 2.0
		items = append(items, adjustment{"no_attendants", 2.0, "No attendants logged for shift"})
	}
	if incidentScore < 4 {
		total += 1.0
		items = append(items, adjustment{"multiple_incidents", 1.0, "Multiple unresolved incidents"})
	}
	return total, items
}

// ─── Core scoring function (reusable from shift close) ───────────────────────

// ComputeAndStoreShiftScore scores a closed shift and updates lifetime stats.
// Safe to call multiple times — uses UPSERT.
func ComputeAndStoreShiftScore(ctx context.Context, db *pgxpool.Pool, shiftID, businessID string) (*model.SPSShiftScore, error) {
	// Load the shift
	var s model.Shift
	err := db.QueryRow(ctx, `
		SELECT s.id::text, s.business_id::text, COALESCE(s.branch_id::text,''),
		       s.supervisor_id::text, COALESCE(u.name,''),
		       s.date::text, s.start_time::text, s.end_time::text, s.created_at::text,
		       COALESCE(s.shift_type,'service_station')
		FROM shifts s LEFT JOIN users u ON u.id = s.supervisor_id
		WHERE s.id = $1 AND s.business_id = $2`,
		shiftID, businessID,
	).Scan(&s.ID, &s.BusinessID, &s.BranchID, &s.SupervisorID, &s.SupervisorName,
		&s.Date, &s.StartTime, &s.EndTime, &s.CreatedAt, &s.ShiftType)
	if err != nil {
		return nil, fmt.Errorf("shift not found: %w", err)
	}
	if s.EndTime == nil {
		return nil, fmt.Errorf("shift is not closed")
	}

	// Build shift timestamps for incident window
	shiftStart := s.Date + "T" + s.StartTime
	shiftEnd := s.Date + "T" + *s.EndTime
	if *s.EndTime < s.StartTime {
		// overnight shift — use shift created_at as end anchor
		shiftEnd = s.CreatedAt
	}

	var branchPtr *string
	if s.BranchID != "" {
		branchPtr = &s.BranchID
	}

	// Compute each component
	salesScore, ser := scoreSales(ctx, db, shiftID, s.SupervisorID)
	fuelScore, fuelVarPct := scoreFuelVariance(ctx, db, shiftID)
	attendanceScore := scoreAttendance(s.EndTime)
	teamScore, attendantCount := scoreTeam(ctx, db, shiftID)
	incidentScore, incidentCount := scoreIncidents(ctx, db, branchPtr, shiftStart, shiftEnd)

	// Fixed defaults (features not yet tracked per-shift)
	cashScore := 12.0         // conservative default
	taskScore := 8.0          // default full
	inventoryScore := 7.0     // default full
	safetyScore := 5.0        // default full
	csScore := 2.0            // default full

	// Bonuses & penalties
	bonusTotal, bonusItems := computeBonuses(salesScore, cashScore, fuelScore)
	penaltyTotal, penaltyItems := computePenalties(attendantCount, incidentScore)

	raw := salesScore + cashScore + fuelScore + attendanceScore +
		teamScore + taskScore + inventoryScore + incidentScore + safetyScore + csScore

	final := clamp(raw-penaltyTotal+bonusTotal, 0, 105)

	// Serialise breakdown JSON
	bonusJSON := marshalAdjustments(bonusItems)
	penaltyJSON := marshalAdjustments(penaltyItems)

	var serPtr *float64
	if ser != 1.0 {
		serPtr = &ser
	}
	fuelVarPctPtr := &fuelVarPct

	// Upsert shift score
	var scoreID string
	err = db.QueryRow(ctx, `
		INSERT INTO supervisor_shift_scores (
			shift_id, supervisor_id, branch_id, business_id,
			score_sales, score_cash_variance, score_fuel_variance, score_attendance,
			score_team, score_task_completion, score_inventory, score_incident,
			score_safety, score_customer_service,
			total_penalties, total_bonuses, sps_shift_raw, sps_shift_final,
			sales_efficiency_ratio, fuel_variance_pct,
			attendant_count, incident_count,
			bonus_breakdown, penalty_breakdown
		) VALUES (
			$1, $2, NULLIF($3,'')::uuid, $4,
			$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
			$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
		)
		ON CONFLICT (shift_id) DO UPDATE SET
			score_sales            = EXCLUDED.score_sales,
			score_cash_variance    = EXCLUDED.score_cash_variance,
			score_fuel_variance    = EXCLUDED.score_fuel_variance,
			score_attendance       = EXCLUDED.score_attendance,
			score_team             = EXCLUDED.score_team,
			score_task_completion  = EXCLUDED.score_task_completion,
			score_inventory        = EXCLUDED.score_inventory,
			score_incident         = EXCLUDED.score_incident,
			score_safety           = EXCLUDED.score_safety,
			score_customer_service = EXCLUDED.score_customer_service,
			total_penalties        = EXCLUDED.total_penalties,
			total_bonuses          = EXCLUDED.total_bonuses,
			sps_shift_raw          = EXCLUDED.sps_shift_raw,
			sps_shift_final        = EXCLUDED.sps_shift_final,
			sales_efficiency_ratio = EXCLUDED.sales_efficiency_ratio,
			fuel_variance_pct      = EXCLUDED.fuel_variance_pct,
			attendant_count        = EXCLUDED.attendant_count,
			incident_count         = EXCLUDED.incident_count,
			bonus_breakdown        = EXCLUDED.bonus_breakdown,
			penalty_breakdown      = EXCLUDED.penalty_breakdown,
			scored_at              = NOW()
		RETURNING id::text`,
		shiftID, s.SupervisorID, s.BranchID, businessID,
		salesScore, cashScore, fuelScore, attendanceScore,
		teamScore, taskScore, inventoryScore, incidentScore,
		safetyScore, csScore,
		penaltyTotal, bonusTotal, raw, final,
		serPtr, fuelVarPctPtr,
		attendantCount, incidentCount,
		bonusJSON, penaltyJSON,
	).Scan(&scoreID)
	if err != nil {
		return nil, fmt.Errorf("upsert shift score: %w", err)
	}

	// Update lifetime stats
	if err := updateLifetimeStats(ctx, db, s.SupervisorID, businessID, final); err != nil {
		// non-fatal — score is already stored
		_ = err
	}

	score := &model.SPSShiftScore{
		ID:                   scoreID,
		ShiftID:              shiftID,
		SupervisorID:         s.SupervisorID,
		SupervisorName:       s.SupervisorName,
		BranchID:             branchPtr,
		BusinessID:           businessID,
		ScoreSales:           salesScore,
		ScoreCashVariance:    cashScore,
		ScoreFuelVariance:    fuelScore,
		ScoreAttendance:      attendanceScore,
		ScoreTeam:            teamScore,
		ScoreTaskCompletion:  taskScore,
		ScoreInventory:       inventoryScore,
		ScoreIncident:        incidentScore,
		ScoreSafety:          safetyScore,
		ScoreCustomerService: csScore,
		TotalPenalties:       penaltyTotal,
		TotalBonuses:         bonusTotal,
		SPSShiftRaw:          raw,
		SPSShiftFinal:        final,
		SalesEfficiencyRatio: serPtr,
		FuelVariancePct:      fuelVarPctPtr,
		AttendantCount:       attendantCount,
		IncidentCount:        incidentCount,
		BonusBreakdown:       bonusJSON,
		PenaltyBreakdown:     penaltyJSON,
	}
	return score, nil
}

// ─── Lifetime stats updater ───────────────────────────────────────────────────

func updateLifetimeStats(ctx context.Context, db *pgxpool.Pool, supervisorID, businessID string, shiftFinal float64) error {
	// Load current stats (if any)
	var cur model.SupervisorLifetimeStats
	err := db.QueryRow(ctx, `
		SELECT supervisor_id::text, business_id::text, total_shifts,
		       confidence_weight, sps_raw_ewma, sps_lifetime_final, sps_peak,
		       current_tier, current_perfect_streak, best_perfect_streak,
		       total_revenue_managed, total_fuel_volume_litres
		FROM supervisor_lifetime_stats WHERE supervisor_id = $1`,
		supervisorID,
	).Scan(
		&cur.SupervisorID, &cur.BusinessID, &cur.TotalShifts,
		&cur.ConfidenceWeight, &cur.SPSRawEWMA, &cur.SPSLifetimeFinal, &cur.SPSPeak,
		&cur.CurrentTier, &cur.CurrentPerfectStreak, &cur.BestPerfectStreak,
		&cur.TotalRevenueManaged, &cur.TotalFuelVolumeLitres,
	)

	isNew := err != nil
	n := cur.TotalShifts + 1

	// EWMA
	var newEWMA float64
	if isNew || cur.TotalShifts == 0 {
		newEWMA = shiftFinal
	} else {
		newEWMA = spsAlpha*shiftFinal + (1-spsAlpha)*cur.SPSRawEWMA
	}

	// Confidence weight
	cw := float64(n) / (float64(n) + spsConfidenceConstant)

	// League average (company-wide)
	var leagueAvg float64
	db.QueryRow(ctx,
		`SELECT COALESCE(AVG(sps_lifetime_final), $1) FROM supervisor_lifetime_stats WHERE business_id = $2`,
		spsLeagueDefault, businessID,
	).Scan(&leagueAvg)
	if leagueAvg <= 0 {
		leagueAvg = spsLeagueDefault
	}

	lifetimeSPS := cw*newEWMA + (1-cw)*leagueAvg
	lifetimeSPS = clamp(lifetimeSPS, 0, 100)

	peak := math.Max(cur.SPSPeak, shiftFinal)
	tier := computeTier(lifetimeSPS)

	// Perfect streak
	streak := cur.CurrentPerfectStreak
	if shiftFinal >= spsPerfectThreshold {
		streak++
	} else {
		streak = 0
	}
	bestStreak := int(math.Max(float64(cur.BestPerfectStreak), float64(streak)))

	// Revenue managed (total deposits for this shift)
	var shiftRevenue float64
	db.QueryRow(ctx, `SELECT COALESCE(SUM(amount),0) FROM deposits WHERE shift_id IN (
		SELECT id FROM shifts WHERE supervisor_id = $1 AND end_time IS NOT NULL
		ORDER BY created_at DESC LIMIT 1
	)`, supervisorID).Scan(&shiftRevenue)

	// Fuel volume (nozzle logs for latest shift)
	var shiftFuel float64
	db.QueryRow(ctx, `SELECT COALESCE(SUM(ending_reading - starting_reading), 0)
		FROM nozzle_logs WHERE shift_id IN (
			SELECT id FROM shifts WHERE supervisor_id = $1 AND end_time IS NOT NULL
			ORDER BY created_at DESC LIMIT 1
		)`, supervisorID).Scan(&shiftFuel)

	_, err = db.Exec(ctx, `
		INSERT INTO supervisor_lifetime_stats (
			supervisor_id, business_id, total_shifts, confidence_weight,
			sps_raw_ewma, sps_lifetime_final, sps_peak, current_tier,
			current_perfect_streak, best_perfect_streak,
			total_revenue_managed, total_fuel_volume_litres
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (supervisor_id) DO UPDATE SET
			total_shifts           = EXCLUDED.total_shifts,
			confidence_weight      = EXCLUDED.confidence_weight,
			sps_raw_ewma           = EXCLUDED.sps_raw_ewma,
			sps_lifetime_final     = EXCLUDED.sps_lifetime_final,
			sps_peak               = EXCLUDED.sps_peak,
			current_tier           = EXCLUDED.current_tier,
			current_perfect_streak = EXCLUDED.current_perfect_streak,
			best_perfect_streak    = EXCLUDED.best_perfect_streak,
			total_revenue_managed  = supervisor_lifetime_stats.total_revenue_managed + $11,
			total_fuel_volume_litres = supervisor_lifetime_stats.total_fuel_volume_litres + $12,
			last_computed_at       = NOW()`,
		supervisorID, businessID, n, cw,
		newEWMA, lifetimeSPS, peak, tier,
		streak, bestStreak,
		shiftRevenue, shiftFuel,
	)
	return err
}

// ─── JSON helper ─────────────────────────────────────────────────────────────

func marshalAdjustments(items []adjustment) string {
	if len(items) == 0 {
		return "[]"
	}
	out := "["
	for i, a := range items {
		if i > 0 {
			out += ","
		}
		out += fmt.Sprintf(`{"type":%q,"amount":%g,"reason":%q}`, a.Type, a.Amount, a.Reason)
	}
	return out + "]"
}

// ─── HTTP handlers ────────────────────────────────────────────────────────────

// ScoreShift  POST /shifts/:shiftId/score
func (h *SPSHandler) ScoreShift(c *gin.Context) {
	businessID := c.GetString("business_id")
	shiftID := c.Param("shiftId")

	score, err := ComputeAndStoreShiftScore(c.Request.Context(), h.DB, shiftID, businessID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, score)
}

// GetRankings  GET /rankings?scope=company|branch
func (h *SPSHandler) GetRankings(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	scope := c.DefaultQuery("scope", "company")

	var query string
	var args []any

	if scope == "branch" && branchID != "" {
		// Rank supervisors whose most recent shifts are at this branch
		query = `
			SELECT
				ROW_NUMBER() OVER (ORDER BY sls.sps_lifetime_final DESC) AS rank,
				sls.supervisor_id::text,
				COALESCE(u.name,'') AS supervisor_name,
				sls.current_tier,
				sls.sps_lifetime_final,
				sls.sps_raw_ewma,
				sls.sps_peak,
				sls.total_shifts,
				sls.confidence_weight,
				sls.current_perfect_streak,
				sls.best_perfect_streak,
				sls.total_revenue_managed
			FROM supervisor_lifetime_stats sls
			JOIN users u ON u.id = sls.supervisor_id
			WHERE sls.business_id = $1
			  AND EXISTS (
				SELECT 1 FROM supervisor_shift_scores sss
				WHERE sss.supervisor_id = sls.supervisor_id
				  AND sss.branch_id::text = $2
			  )
			ORDER BY sls.sps_lifetime_final DESC
			LIMIT 100`
		args = []any{businessID, branchID}
	} else {
		query = `
			SELECT
				ROW_NUMBER() OVER (ORDER BY sls.sps_lifetime_final DESC) AS rank,
				sls.supervisor_id::text,
				COALESCE(u.name,'') AS supervisor_name,
				sls.current_tier,
				sls.sps_lifetime_final,
				sls.sps_raw_ewma,
				sls.sps_peak,
				sls.total_shifts,
				sls.confidence_weight,
				sls.current_perfect_streak,
				sls.best_perfect_streak,
				sls.total_revenue_managed
			FROM supervisor_lifetime_stats sls
			JOIN users u ON u.id = sls.supervisor_id
			WHERE sls.business_id = $1
			ORDER BY sls.sps_lifetime_final DESC
			LIMIT 100`
		args = []any{businessID}
	}

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	entries := []model.RankingEntry{}
	for rows.Next() {
		var e model.RankingEntry
		if err := rows.Scan(
			&e.Rank, &e.SupervisorID, &e.SupervisorName,
			&e.CurrentTier, &e.SPSLifetimeFinal, &e.SPSRawEWMA, &e.SPSPeak,
			&e.TotalShifts, &e.ConfidenceWeight,
			&e.CurrentPerfectStreak, &e.BestPerfectStreak, &e.TotalRevenueManaged,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		entries = append(entries, e)
	}
	c.JSON(http.StatusOK, entries)
}

// GetSupervisorStats  GET /users/:id/sps
func (h *SPSHandler) GetSupervisorStats(c *gin.Context) {
	businessID := c.GetString("business_id")
	userID := c.Param("id")

	var stats model.SupervisorLifetimeStats
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT sls.supervisor_id::text, sls.business_id::text, sls.total_shifts,
		       sls.confidence_weight, sls.sps_raw_ewma, sls.sps_lifetime_final, sls.sps_peak,
		       sls.current_tier, sls.current_perfect_streak, sls.best_perfect_streak,
		       sls.total_revenue_managed, sls.total_fuel_volume_litres, sls.last_computed_at::text,
		       COALESCE(u.name, '')
		FROM supervisor_lifetime_stats sls
		JOIN users u ON u.id = sls.supervisor_id
		WHERE sls.supervisor_id = $1 AND sls.business_id = $2`,
		userID, businessID,
	).Scan(
		&stats.SupervisorID, &stats.BusinessID, &stats.TotalShifts,
		&stats.ConfidenceWeight, &stats.SPSRawEWMA, &stats.SPSLifetimeFinal, &stats.SPSPeak,
		&stats.CurrentTier, &stats.CurrentPerfectStreak, &stats.BestPerfectStreak,
		&stats.TotalRevenueManaged, &stats.TotalFuelVolumeLitres, &stats.LastComputedAt,
		&stats.SupervisorName,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no SPS data for this supervisor"})
		return
	}

	// Compute company rank
	h.DB.QueryRow(c.Request.Context(), `
		SELECT COUNT(*)+1 FROM supervisor_lifetime_stats
		WHERE business_id = $1 AND sps_lifetime_final > $2`,
		businessID, stats.SPSLifetimeFinal,
	).Scan(&stats.CompanyRank)

	// Recent shift scores (last 10)
	type recentScore struct {
		ShiftID  string  `json:"shift_id"`
		Date     string  `json:"date"`
		Final    float64 `json:"sps_final"`
		ScoredAt string  `json:"scored_at"`
	}
	recent := []recentScore{}
	rrows, _ := h.DB.Query(c.Request.Context(), `
		SELECT sss.shift_id::text, s.date::text, sss.sps_shift_final, sss.scored_at::text
		FROM supervisor_shift_scores sss
		JOIN shifts s ON s.id = sss.shift_id
		WHERE sss.supervisor_id = $1 AND sss.business_id = $2
		ORDER BY sss.scored_at DESC LIMIT 10`,
		userID, businessID,
	)
	if rrows != nil {
		defer rrows.Close()
		for rrows.Next() {
			var r recentScore
			rrows.Scan(&r.ShiftID, &r.Date, &r.Final, &r.ScoredAt)
			recent = append(recent, r)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"stats":        stats,
		"recent_scores": recent,
	})
}

// GetMyStats  GET /sps/me — current user's own SPS stats
func (h *SPSHandler) GetMyStats(c *gin.Context) {
	businessID := c.GetString("business_id")
	userID := c.GetString("user_id")

	var stats model.SupervisorLifetimeStats
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT sls.supervisor_id::text, sls.business_id::text, sls.total_shifts,
		       sls.confidence_weight, sls.sps_raw_ewma, sls.sps_lifetime_final, sls.sps_peak,
		       sls.current_tier, sls.current_perfect_streak, sls.best_perfect_streak,
		       sls.total_revenue_managed, sls.total_fuel_volume_litres, sls.last_computed_at::text,
		       COALESCE(u.name, '')
		FROM supervisor_lifetime_stats sls
		JOIN users u ON u.id = sls.supervisor_id
		WHERE sls.supervisor_id = $1 AND sls.business_id = $2`,
		userID, businessID,
	).Scan(
		&stats.SupervisorID, &stats.BusinessID, &stats.TotalShifts,
		&stats.ConfidenceWeight, &stats.SPSRawEWMA, &stats.SPSLifetimeFinal, &stats.SPSPeak,
		&stats.CurrentTier, &stats.CurrentPerfectStreak, &stats.BestPerfectStreak,
		&stats.TotalRevenueManaged, &stats.TotalFuelVolumeLitres, &stats.LastComputedAt,
		&stats.SupervisorName,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no SPS data yet"})
		return
	}

	h.DB.QueryRow(c.Request.Context(), `
		SELECT COUNT(*)+1 FROM supervisor_lifetime_stats
		WHERE business_id = $1 AND sps_lifetime_final > $2`,
		businessID, stats.SPSLifetimeFinal,
	).Scan(&stats.CompanyRank)

	c.JSON(http.StatusOK, stats)
}
