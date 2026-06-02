package handlers

// ═══════════════════════════════════════════════════════════════════════════════
// CPS / APS Shared Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pure, stateless calculation functions.  All inputs come from the caller;
// nothing is read from the database here, making every formula unit-testable.
//
// Tier system (shared by CPS, APS, and SPS):
//   Bronze  < 40   — developing
//   Silver  40–54  — competent
//   Gold    55–67  — proficient
//   Platinum 68–77 — advanced
//   Diamond  78–85 — expert
//   Elite    86–92 — top performer
//   Master   93–96 — elite
//   Legend   97–100— exceptional

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"project-sync/internal/model"
)

// ─── Constants ─────────────────────────────────────────────────────────────────

const (
	cpsAlpha             = 0.06 // EWMA decay factor (same as SPS)
	cpsConfidenceK       = 40.0 // shifts to reach CW = 0.5
	cpsLeagueDefault     = 60.0 // fallback league average for new employees
	cpsPerfectThreshold  = 90.0 // score counted as a "perfect shift"

	// Tier boundaries (upper-exclusive except Legend)
	tierBronzeMax   = 40.0
	tierSilverMax   = 55.0
	tierGoldMax     = 68.0
	tierPlatinumMax = 78.0
	tierDiamondMax  = 86.0
	tierEliteMax    = 93.0
	tierMasterMax   = 97.0
	// Legend = 97–100
)

// ComputeTierEmployee returns the tier name for a given lifetime score.
// Adds Master and Legend tiers beyond the SPS Elite tier.
func ComputeTierEmployee(score float64) string {
	switch {
	case score >= tierMasterMax:
		return "Legend"
	case score >= tierEliteMax:
		return "Master"
	case score >= tierDiamondMax:
		return "Elite"
	case score >= tierPlatinumMax:
		return "Diamond"
	case score >= tierGoldMax:
		return "Platinum"
	case score >= tierSilverMax:
		return "Gold"
	case score >= tierBronzeMax:
		return "Silver"
	default:
		return "Bronze"
	}
}

// computeEWMA updates an Exponential Weighted Moving Average.
//   α = 0.06 matches SPS — weights recent performance more but smooths volatility.
func computeEWMA(prev, newScore, alpha float64) float64 {
	if prev == 0 {
		return newScore // first shift: use raw score
	}
	return alpha*newScore + (1-alpha)*prev
}

// computeLifetimeScore applies Bayesian confidence weighting to prevent
// new employees from topping leaderboards on just a few shifts.
//
//   CW(n) = n / (n + K)   where K = 40
//   Lifetime = CW × EWMA + (1 − CW) × LeagueAvg
//
// At n=0:   CW=0.00 → 100% league average (can't game it on day 1)
// At n=40:  CW=0.50 → equal weight EWMA and league
// At n=120: CW=0.75 → predominantly own performance
func computeLifetimeScore(ewma float64, shifts int, leagueAvg float64) (final, cw float64) {
	cw = float64(shifts) / (float64(shifts) + cpsConfidenceK)
	final = cw*ewma + (1-cw)*leagueAvg
	return r2(final), r2(cw)
}

// ═══════════════════════════════════════════════════════════════════════════════
// CPS Component Calculators
// ═══════════════════════════════════════════════════════════════════════════════

// ScoreCashAccuracy computes the Cash Handling Accuracy component (max 25 pts).
//
//   Variance% = |cash_variance| / max(total_sales, 1) × 100
//   Score     = 25 × max(0, 1 − Variance% / 1.0)
//
// At Variance% = 0.0%: 25 pts (zero-variance bonus triggers separately)
// At Variance% = 0.5%: 12.5 pts
// At Variance% ≥ 1.0%: 0 pts + penalty flag
func ScoreCashAccuracy(cashVarianceAmt, totalSales float64) (score, variancePct float64) {
	if totalSales <= 0 {
		return 15.0, 0 // default mid-score when no sales data
	}
	variancePct = math.Abs(cashVarianceAmt) / totalSales * 100
	score = r2(25 * math.Max(0, 1-variancePct/1.0))
	return
}

// ScoreTransactionQuality computes Transaction Quality (max 20 pts).
//
//   Suspicious actions = unsupervised voids + unapproved refunds + bad price overrides
//   Rate  = suspicious_actions / max(total_transactions, 1)
//   Score = max(0, 20 × (1 − Rate / 0.02))
//
// Why: A 2% suspicious-action rate nets 0 pts. Each unsupervised action costs
// roughly 1 pt per transaction percentage point.
// Supervisor-approved actions are NOT counted as suspicious.
func ScoreTransactionQuality(unsupervisedVoids, unapprovedRefunds, badOverrides, totalTransactions int) float64 {
	if totalTransactions < 5 {
		return 15.0 // insufficient data → neutral score
	}
	suspicious := float64(unsupervisedVoids + unapprovedRefunds + badOverrides)
	rate := suspicious / float64(totalTransactions)
	return r2(math.Max(0, 20*(1-rate/0.02)))
}

// ScoreSalesEffectiveness computes Sales Effectiveness (max 20 pts).
//
//   SER   = employee_sales_per_txn / station_7day_avg_sales_per_txn
//   Base  = min(10, 5 × SER)        — normalised for station size
//   Add   = min(4,  upsell_count × 0.2)
//         + min(3,  loyalty_signups × 0.3)
//         + min(3,  promos_sold × 0.15)
//
// Normalisation removes bias toward cashiers at high-volume stations:
// a cashier doing twice the station average earns max base regardless of
// whether the station serves 20 or 200 customers per shift.
func ScoreSalesEffectiveness(totalSales float64, totalTransactions int,
	stationAvgSalesPerTxn float64, upsellCount, loyaltySignups, promosSold int) (score, ser float64) {

	if stationAvgSalesPerTxn <= 0 || totalTransactions <= 0 {
		ser = 1.0 // assume average
	} else {
		employeeSPT := totalSales / float64(totalTransactions)
		ser = employeeSPT / stationAvgSalesPerTxn
	}

	base := math.Min(10, 5*ser)
	upsell := math.Min(4, float64(upsellCount)*0.2)
	loyalty := math.Min(3, float64(loyaltySignups)*0.3)
	promo := math.Min(3, float64(promosSold)*0.15)

	score = r2(math.Min(20, base+upsell+loyalty+promo))
	ser = r2(ser)
	return
}

// ScoreAttendance computes Attendance & Reliability (max 15 pts).
//
//   Punctuality = 8 − 0.5×late_minutes  (clamped 4–8)
//   Reliability = 7 − 3×no_shows − 2×early_departures
//   Total       = clamp(P + R, 0, 15)
//
// lateMinutes: minutes late across all clock-ins this shift (total, not per event)
// noShows: shifts missed without approval
// earlyDepartures: departures more than 30 min before scheduled end
func ScoreAttendance(lateMinutes, noShows, earlyDepartures int) float64 {
	punctuality := math.Max(4, 8-float64(lateMinutes)*0.5)
	reliability := 7.0 - float64(noShows)*3 - float64(earlyDepartures)*2
	return r2(math.Max(0, math.Min(15, punctuality+reliability)))
}

// ScoreCustomerService computes Customer Service (max 10 pts).
//
//   Feedback_Rate = positive_feedback / max(total_feedback, 1)
//   Score = max(0, min(10,
//     6 × Feedback_Rate
//     − 1.5 × complaint_count
//     + 2 × (resolved / max(complaints, 1))
//   ))
func ScoreCustomerService(positiveFeedback, totalFeedback, complaintCount, resolvedComplaints int) float64 {
	feedbackRate := 0.5 // default neutral when no data
	if totalFeedback > 0 {
		feedbackRate = float64(positiveFeedback) / float64(totalFeedback)
	}
	resolutionRate := 0.0
	if complaintCount > 0 {
		resolutionRate = float64(resolvedComplaints) / float64(complaintCount)
	}
	score := 6*feedbackRate - 1.5*float64(complaintCount) + 2*resolutionRate
	return r2(math.Max(0, math.Min(10, score)))
}

// ScoreCompliance computes Operational Compliance (max 5 pts).
//
//   Score = max(0, 5 × (items_completed / items_required) − violation_count)
func ScoreCompliance(itemsCompleted, itemsRequired, violationCount int) float64 {
	if itemsRequired <= 0 {
		return 4.0 // default when no checklist exists
	}
	completion := float64(itemsCompleted) / float64(itemsRequired)
	score := 5*completion - float64(violationCount)
	return r2(math.Max(0, math.Min(5, score)))
}

// ScoreTeam computes Team Contribution (max 5 pts for CPS, 3 pts for APS).
//
//   Score = maxPts × (0.4 × peer_rating/5 + 0.6 × supervisor_rating/5)
//   Default 60% of max when no reviews submitted.
func ScoreTeam(peerRatingSum, peerCount int, supervisorRating float64, maxPts float64) float64 {
	peer := 0.6 // default 60% when no peer reviews
	if peerCount > 0 {
		peer = (float64(peerRatingSum) / float64(peerCount)) / 5.0
	}
	sup := 0.6 // default
	if supervisorRating > 0 {
		sup = supervisorRating / 5.0
	}
	return r2(math.Min(maxPts, maxPts*(0.4*peer+0.6*sup)))
}

// ─── CPS Bonus / Penalty ───────────────────────────────────────────────────────

type ScoringAdjustment struct {
	Reason string  `json:"reason"`
	Pts    float64 `json:"pts"`
}

func CPSBonuses(rawScore, cashVariancePct float64, upsellCount, loyaltySignups int, topUpseller bool) []ScoringAdjustment {
	var adj []ScoringAdjustment
	if rawScore >= cpsPerfectThreshold {
		adj = append(adj, ScoringAdjustment{"Perfect shift", +2})
	}
	if cashVariancePct == 0 {
		adj = append(adj, ScoringAdjustment{"Zero cash variance", +1})
	}
	if topUpseller {
		adj = append(adj, ScoringAdjustment{"Upsell champion (top 10%)", +1})
	}
	return adj
}

func CPSPenalties(cashVariancePct float64, noShows, policyViolations, suspiciousTransactions int) []ScoringAdjustment {
	var adj []ScoringAdjustment
	if cashVariancePct > 1.0 {
		adj = append(adj, ScoringAdjustment{"Cash shortage >1%", -2})
	}
	for i := 0; i < noShows; i++ {
		adj = append(adj, ScoringAdjustment{"No-show", -3})
	}
	for i := 0; i < policyViolations; i++ {
		adj = append(adj, ScoringAdjustment{"Policy violation", -3})
	}
	for i := 0; i < suspiciousTransactions; i++ {
		adj = append(adj, ScoringAdjustment{"Suspicious transaction", -2})
	}
	return adj
}

// ═══════════════════════════════════════════════════════════════════════════════
// APS Component Calculators
// ═══════════════════════════════════════════════════════════════════════════════

// ScoreFuelAccountability computes Fuel Accountability (max 25 pts).
//
//   Variance% = |meter_expected − actual_dispensed| / max(total_dispensed, 1) × 100
//   Score     = 25 × max(0, 1 − Variance% / 1.0)
func ScoreFuelAccountability(meterExpected, actualDispensed float64) (score, variancePct float64) {
	if actualDispensed <= 0 && meterExpected <= 0 {
		return 15.0, 0
	}
	total := math.Max(actualDispensed, meterExpected)
	variancePct = math.Abs(meterExpected-actualDispensed) / math.Max(total, 1) * 100
	score = r2(25 * math.Max(0, 1-variancePct/1.0))
	return
}

// ScoreForecourt computes Forecourt Operations (max 20 pts).
//
//   Inspection = 8 × (inspections_done / inspections_required)
//   Cleanliness = 6 × cleanliness_rating / 5
//   Tasks       = 6 × (tasks_done / tasks_assigned)
func ScoreForecourt(inspectionsDone, inspectionsRequired int, cleanlinessRating float64, tasksDone, tasksAssigned int) float64 {
	inspPct := 1.0
	if inspectionsRequired > 0 {
		inspPct = float64(inspectionsDone) / float64(inspectionsRequired)
	}
	clean := cleanlinessRating / 5.0
	if cleanlinessRating <= 0 {
		clean = 0.7 // default when not rated
	}
	taskPct := 1.0
	if tasksAssigned > 0 {
		taskPct = float64(tasksDone) / float64(tasksAssigned)
	}
	score := 8*inspPct + 6*clean + 6*taskPct
	return r2(math.Min(20, score))
}

// ScoreProductivity computes Productivity (max 20 pts) with station-traffic normalisation.
//
//   VPH_Employee = vehicles_served / max(shift_hours, 1)
//   VPH_Station  = station_7day_rolling_avg_per_8h
//   Ratio        = VPH_Employee / max(VPH_Station, ε)
//   Score        = min(20, 10 × Ratio)
//
// A ratio of 1.0 → 10 pts (exactly at station average)
// A ratio of 2.0 → 20 pts (twice the average, capped)
// A ratio of 0.5 → 5 pts (half the average)
//
// This eliminates bias between busy and quiet stations:
// an attendant at a station serving 100 cars/shift and one serving 10 cars/shift
// will both score 10 pts if they match their respective station averages.
func ScoreProductivity(vehiclesServed int, shiftHours, stationAvgVehiclesPerHour float64) (score, ratio float64) {
	if shiftHours <= 0 {
		shiftHours = 8
	}
	vphEmployee := float64(vehiclesServed) / shiftHours
	stationRef := stationAvgVehiclesPerHour
	if stationRef <= 0 {
		stationRef = vphEmployee // first data point — ratio = 1
	}
	ratio = vphEmployee / stationRef
	score = r2(math.Min(20, 10*ratio))
	ratio = r2(ratio)
	return
}

// ScoreSafety computes Safety Compliance (max 7 pts).
//
//   Base    = 5 × (safety_items_done / safety_items_required)
//   PPE     = 2 if PPE_compliant else 0
//   Hazard  = min(2, hazard_reports × 0.5)  — reward proactive reporting
//   Penalty = incidents_caused × 3
func ScoreSafety(safetyDone, safetyRequired int, ppeCompliant bool, hazardReports, incidentsCaused int) float64 {
	completion := 1.0
	if safetyRequired > 0 {
		completion = float64(safetyDone) / float64(safetyRequired)
	}
	ppePts := 0.0
	if ppeCompliant {
		ppePts = 2
	}
	hazardPts := math.Min(2, float64(hazardReports)*0.5)
	penaltyPts := float64(incidentsCaused) * 3
	score := 5*completion + ppePts + hazardPts - penaltyPts
	return r2(math.Max(0, math.Min(7, score)))
}

// ─── APS Bonus / Penalty ───────────────────────────────────────────────────────

func APSBonuses(rawScore, fuelVariancePct float64, hazardReports int) []ScoringAdjustment {
	var adj []ScoringAdjustment
	if rawScore >= cpsPerfectThreshold {
		adj = append(adj, ScoringAdjustment{"Perfect shift", +2})
	}
	if fuelVariancePct == 0 {
		adj = append(adj, ScoringAdjustment{"Zero fuel variance", +1})
	}
	if hazardReports > 0 {
		adj = append(adj, ScoringAdjustment{"Proactive hazard report", +1})
	}
	return adj
}

func APSPenalties(fuelVariancePct float64, noShows, safetyIncidents int) []ScoringAdjustment {
	var adj []ScoringAdjustment
	if fuelVariancePct > 2.0 {
		adj = append(adj, ScoringAdjustment{"Fuel variance >2%", -2})
	}
	for i := 0; i < noShows; i++ {
		adj = append(adj, ScoringAdjustment{"No-show", -3})
	}
	for i := 0; i < safetyIncidents; i++ {
		adj = append(adj, ScoringAdjustment{"Safety incident", -3})
	}
	return adj
}

// ─── Final shift score aggregation ────────────────────────────────────────────

func applyAdjustments(raw float64, bonuses, penalties []ScoringAdjustment) (final, totalBonus, totalPenalty float64) {
	for _, b := range bonuses {
		totalBonus += b.Pts
	}
	for _, p := range penalties {
		totalPenalty += math.Abs(p.Pts)
	}
	final = r2(math.Max(0, math.Min(100, raw+totalBonus-totalPenalty)))
	return
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lifetime Stats Updater (shared by both CPS and APS)
// ═══════════════════════════════════════════════════════════════════════════════

// updateCashierLifetimeStats recomputes EWMA, confidence weight, tier, and streaks
// then UPSERTs the cashier_lifetime_stats row.
func updateCashierLifetimeStats(ctx context.Context, db *pgxpool.Pool, cashierID, businessID string, shiftFinal float64, totalRevenue float64) error {
	var prev struct {
		shifts    int
		ewma      float64
		peak      float64
		streak    int
		bestStreak int
		revenue   float64
	}
	db.QueryRow(ctx, `
		SELECT total_shifts, cps_raw_ewma, cps_peak,
		       current_perfect_streak, best_perfect_streak, total_revenue_processed
		FROM cashier_lifetime_stats
		WHERE cashier_id = $1`, cashierID,
	).Scan(&prev.shifts, &prev.ewma, &prev.peak,
		&prev.streak, &prev.bestStreak, &prev.revenue)

	newShifts := prev.shifts + 1
	newEWMA := computeEWMA(prev.ewma, shiftFinal, cpsAlpha)

	// League average = avg of last 30 days across company
	var leagueAvg float64 = cpsLeagueDefault
	db.QueryRow(ctx,
		`SELECT COALESCE(AVG(cps_shift_final), $1)
		 FROM cashier_shift_scores
		 WHERE business_id = $2 AND scored_at > NOW() - INTERVAL '30 days'`,
		cpsLeagueDefault, businessID,
	).Scan(&leagueAvg)

	lifetimeFinal, cw := computeLifetimeScore(newEWMA, newShifts, leagueAvg)
	newPeak := math.Max(prev.peak, lifetimeFinal)
	tier := ComputeTierEmployee(lifetimeFinal)

	streak := 0
	if shiftFinal >= cpsPerfectThreshold {
		streak = prev.streak + 1
	}
	bestStreak := max(prev.bestStreak, streak)

	_, err := db.Exec(ctx, `
		INSERT INTO cashier_lifetime_stats
		  (cashier_id, business_id, total_shifts, confidence_weight, cps_raw_ewma,
		   cps_lifetime_final, cps_peak, current_tier, current_perfect_streak,
		   best_perfect_streak, total_revenue_processed, last_computed_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
		ON CONFLICT (cashier_id) DO UPDATE SET
		  total_shifts = EXCLUDED.total_shifts,
		  confidence_weight = EXCLUDED.confidence_weight,
		  cps_raw_ewma = EXCLUDED.cps_raw_ewma,
		  cps_lifetime_final = EXCLUDED.cps_lifetime_final,
		  cps_peak = EXCLUDED.cps_peak,
		  current_tier = EXCLUDED.current_tier,
		  current_perfect_streak = EXCLUDED.current_perfect_streak,
		  best_perfect_streak = EXCLUDED.best_perfect_streak,
		  total_revenue_processed = cashier_lifetime_stats.total_revenue_processed + $11,
		  last_computed_at = NOW()`,
		cashierID, businessID, newShifts, r2(cw), r2(newEWMA),
		lifetimeFinal, r2(newPeak), tier, streak, bestStreak, r2(totalRevenue),
	)
	return err
}

// updateAttendantLifetimeStats mirrors updateCashierLifetimeStats for APS.
func updateAttendantLifetimeStats(ctx context.Context, db *pgxpool.Pool, attendantID, businessID string, shiftFinal, fuelLitres float64, vehiclesServed int) error {
	var prev struct {
		shifts     int
		ewma       float64
		peak       float64
		streak     int
		bestStreak int
		litres     float64
		vehicles   int
	}
	db.QueryRow(ctx, `
		SELECT total_shifts, aps_raw_ewma, aps_peak,
		       current_perfect_streak, best_perfect_streak,
		       total_fuel_dispensed_litres, total_vehicles_served
		FROM attendant_lifetime_stats WHERE attendant_id = $1`, attendantID,
	).Scan(&prev.shifts, &prev.ewma, &prev.peak,
		&prev.streak, &prev.bestStreak, &prev.litres, &prev.vehicles)

	newShifts := prev.shifts + 1
	newEWMA := computeEWMA(prev.ewma, shiftFinal, cpsAlpha)

	var leagueAvg float64 = cpsLeagueDefault
	db.QueryRow(ctx,
		`SELECT COALESCE(AVG(aps_shift_final), $1)
		 FROM attendant_shift_scores
		 WHERE business_id = $2 AND scored_at > NOW() - INTERVAL '30 days'`,
		cpsLeagueDefault, businessID,
	).Scan(&leagueAvg)

	lifetimeFinal, cw := computeLifetimeScore(newEWMA, newShifts, leagueAvg)
	newPeak := math.Max(prev.peak, lifetimeFinal)
	tier := ComputeTierEmployee(lifetimeFinal)

	streak := 0
	if shiftFinal >= cpsPerfectThreshold {
		streak = prev.streak + 1
	}
	bestStreak := max(prev.bestStreak, streak)

	_, err := db.Exec(ctx, `
		INSERT INTO attendant_lifetime_stats
		  (attendant_id, business_id, total_shifts, confidence_weight, aps_raw_ewma,
		   aps_lifetime_final, aps_peak, current_tier, current_perfect_streak,
		   best_perfect_streak, total_fuel_dispensed_litres, total_vehicles_served, last_computed_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
		ON CONFLICT (attendant_id) DO UPDATE SET
		  total_shifts = EXCLUDED.total_shifts,
		  confidence_weight = EXCLUDED.confidence_weight,
		  aps_raw_ewma = EXCLUDED.aps_raw_ewma,
		  aps_lifetime_final = EXCLUDED.aps_lifetime_final,
		  aps_peak = EXCLUDED.aps_peak,
		  current_tier = EXCLUDED.current_tier,
		  current_perfect_streak = EXCLUDED.current_perfect_streak,
		  best_perfect_streak = EXCLUDED.best_perfect_streak,
		  total_fuel_dispensed_litres = attendant_lifetime_stats.total_fuel_dispensed_litres + $11,
		  total_vehicles_served = attendant_lifetime_stats.total_vehicles_served + $12,
		  last_computed_at = NOW()`,
		attendantID, businessID, newShifts, r2(cw), r2(newEWMA),
		lifetimeFinal, r2(newPeak), tier, streak, bestStreak,
		r2(fuelLitres), vehiclesServed,
	)
	return err
}

// ═══════════════════════════════════════════════════════════════════════════════
// CPS Shift Scoring  (called at shift close)
// ═══════════════════════════════════════════════════════════════════════════════

// ComputeAndStoreCPSScore is the main CPS entry point.
// It is called in a goroutine when a Cashier shift closes.
// On first invocation it inserts; duplicate calls UPSERT (idempotent).
func ComputeAndStoreCPSScore(ctx context.Context, db *pgxpool.Pool, shiftID, businessID string) {
	// ── 1. Load shift metadata ────────────────────────────────────────────────
	var cashierID, branchID string
	db.QueryRow(ctx,
		`SELECT supervisor_id, COALESCE(branch_id::text,'') FROM shifts WHERE id=$1`, shiftID,
	).Scan(&cashierID, &branchID)
	if cashierID == "" {
		return
	}

	// ── 2. Cash variance from deposits table ─────────────────────────────────
	var totalSales, totalOverage, totalShortage float64
	db.QueryRow(ctx, `
		SELECT COALESCE(SUM(CASE WHEN type='Sale' THEN amount ELSE 0 END),0),
		       COALESCE(SUM(CASE WHEN type='Overage' THEN amount ELSE 0 END),0),
		       COALESCE(SUM(CASE WHEN type='Shortage' THEN amount ELSE 0 END),0)
		FROM deposits WHERE shift_id=$1`, shiftID,
	).Scan(&totalSales, &totalOverage, &totalShortage)

	cashVariance := totalOverage - totalShortage
	cashScore, varPct := ScoreCashAccuracy(cashVariance, totalSales)

	// ── 3. Transaction quality from orders ───────────────────────────────────
	var totalOrders, voidCount, refundCount int
	db.QueryRow(ctx, `
		SELECT COUNT(*),
		       SUM(CASE WHEN status='voided' THEN 1 ELSE 0 END),
		       0  -- refunds tracked via order_items.refunded
		FROM orders WHERE shift_id=$1`, shiftID,
	).Scan(&totalOrders, &voidCount, &refundCount)

	var refundItemCount int
	db.QueryRow(ctx,
		`SELECT COUNT(*) FROM order_items oi JOIN orders o ON o.id=oi.order_id
		 WHERE o.shift_id=$1 AND oi.refunded=true`, shiftID,
	).Scan(&refundItemCount)

	// Voids without supervisor approval counted as suspicious (simplified: all voids here)
	txnScore := ScoreTransactionQuality(voidCount, refundItemCount, 0, totalOrders)

	// ── 4. Sales effectiveness with normalisation ─────────────────────────────
	var stationAvgSPT float64
	if branchID != "" {
		db.QueryRow(ctx, `
			SELECT COALESCE(AVG(total_sales / NULLIF(total_transactions,0)), 0)
			FROM cashier_shift_scores
			WHERE business_id=$1
			  AND branch_id=$2::uuid
			  AND scored_at > NOW() - INTERVAL '7 days'`,
			businessID, branchID,
		).Scan(&stationAvgSPT)
	}
	salesScore, ser := ScoreSalesEffectiveness(totalSales, totalOrders, stationAvgSPT, 0, 0, 0)

	// ── 5. Attendance from shift_attendance ───────────────────────────────────
	var lateMinutes int
	db.QueryRow(ctx, `
		SELECT COALESCE(SUM(
		  GREATEST(0, EXTRACT(EPOCH FROM (clock_in - s.start_time::timestamptz))/60)
		), 0)::int
		FROM shift_attendance sa
		JOIN shifts s ON s.id=sa.shift_id
		WHERE sa.shift_id=$1 AND sa.user_id=$2`, shiftID, cashierID,
	).Scan(&lateMinutes)
	attScore := ScoreAttendance(lateMinutes, 0, 0)

	// ── 6. Customer service from employee_feedback ────────────────────────────
	var posFeedback, totalFeedback, complaintCount int
	db.QueryRow(ctx, `
		SELECT
		  SUM(CASE WHEN feedback_type IN ('positive','commendation') THEN 1 ELSE 0 END),
		  COUNT(*),
		  SUM(CASE WHEN feedback_type='complaint' THEN 1 ELSE 0 END)
		FROM employee_feedback
		WHERE employee_id=$1 AND shift_id=$2`, cashierID, shiftID,
	).Scan(&posFeedback, &totalFeedback, &complaintCount)
	csScore := ScoreCustomerService(posFeedback, totalFeedback, complaintCount, 0)

	// ── 7. Compliance & team (defaults — updated via separate endpoints) ──────
	complianceScore := 4.0 // default until checklist data is available
	teamScore := ScoreTeam(0, 0, 0, 5)

	// ── 8. Aggregate raw score ────────────────────────────────────────────────
	raw := cashScore + txnScore + salesScore + attScore + csScore + complianceScore + teamScore

	bonuses := CPSBonuses(raw, varPct, 0, 0, false)
	penalties := CPSPenalties(varPct, 0, 0, voidCount)
	final, totalBonus, totalPenalty := applyAdjustments(raw, bonuses, penalties)

	bonusJSON := marshalScoringAdj(bonuses)
	penaltyJSON := marshalScoringAdj(penalties)

	// ── 9. UPSERT score row ───────────────────────────────────────────────────
	nullBranch := interface{}(nil)
	if branchID != "" {
		nullBranch = branchID
	}
	var varPctPtr interface{}
	if totalSales > 0 {
		varPctPtr = varPct
	}
	var serPtr interface{}
	if ser > 0 {
		serPtr = ser
	}

	db.Exec(ctx, `
		INSERT INTO cashier_shift_scores
		  (shift_id, cashier_id, business_id, branch_id,
		   score_cash_accuracy, score_transaction_quality, score_sales_effectiveness,
		   score_attendance, score_customer_service, score_compliance, score_team,
		   total_bonuses, total_penalties, bonus_breakdown, penalty_breakdown,
		   cps_shift_raw, cps_shift_final,
		   cash_variance_amt, cash_variance_pct, total_transactions, void_count,
		   refund_count, total_sales, sales_efficiency_ratio)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
		ON CONFLICT (shift_id) DO UPDATE SET
		  score_cash_accuracy=$5, score_transaction_quality=$6, score_sales_effectiveness=$7,
		  score_attendance=$8, score_customer_service=$9, score_compliance=$10, score_team=$11,
		  total_bonuses=$12, total_penalties=$13, bonus_breakdown=$14, penalty_breakdown=$15,
		  cps_shift_raw=$16, cps_shift_final=$17,
		  cash_variance_amt=$18, cash_variance_pct=$19, total_transactions=$20, void_count=$21,
		  refund_count=$22, total_sales=$23, sales_efficiency_ratio=$24, scored_at=NOW()`,
		shiftID, cashierID, businessID, nullBranch,
		cashScore, txnScore, salesScore, attScore, csScore, complianceScore, teamScore,
		r2(totalBonus), r2(totalPenalty), bonusJSON, penaltyJSON,
		r2(raw), final,
		cashVariance, varPctPtr, totalOrders, voidCount, refundItemCount, totalSales, serPtr,
	)

	// ── 10. Update lifetime stats ─────────────────────────────────────────────
	updateCashierLifetimeStats(ctx, db, cashierID, businessID, final, totalSales)
}

// ═══════════════════════════════════════════════════════════════════════════════
// APS Shift Scoring  (called at shift close)
// ═══════════════════════════════════════════════════════════════════════════════

// ComputeAndStoreAPSScore is called for each attendant on a closing shift.
func ComputeAndStoreAPSScore(ctx context.Context, db *pgxpool.Pool, shiftID, businessID string) {
	// Get all attendants on this shift
	rows, err := db.Query(ctx, `
		SELECT DISTINCT sa.user_id::text
		FROM shift_attendance sa
		JOIN users u ON u.id=sa.user_id
		WHERE sa.shift_id=$1 AND u.role='Attendant'`, shiftID)
	if err != nil || rows == nil {
		return
	}
	var attendants []string
	for rows.Next() {
		var id string
		rows.Scan(&id)
		attendants = append(attendants, id)
	}
	rows.Close()

	var branchID string
	db.QueryRow(ctx, `SELECT COALESCE(branch_id::text,'') FROM shifts WHERE id=$1`, shiftID).Scan(&branchID)

	for _, attID := range attendants {
		computeAPSForAttendant(ctx, db, shiftID, attID, businessID, branchID)
	}
}

func computeAPSForAttendant(ctx context.Context, db *pgxpool.Pool, shiftID, attendantID, businessID, branchID string) {
	// ── 1. Fuel accountability from nozzle_logs vs tank_logs ─────────────────
	var meterDispensed float64
	db.QueryRow(ctx, `
		SELECT COALESCE(SUM(nl.ending_reading - nl.starting_reading), 0)
		FROM nozzle_logs nl
		JOIN nozzles n ON n.id=nl.nozzle_id
		WHERE nl.shift_id=$1`, shiftID,
	).Scan(&meterDispensed)

	// Tank-based: opening + delivery − closing
	var tankActual float64
	db.QueryRow(ctx, `
		SELECT COALESCE(SUM(
		  COALESCE(tl.opening_level,0) + COALESCE(tl.delivery_litres,0) - COALESCE(tl.closing_level,0)
		),0)
		FROM tank_logs tl WHERE tl.shift_id=$1`, shiftID,
	).Scan(&tankActual)

	// meterDispensed vs tankActual
	fuelScore, fuelVarPct := ScoreFuelAccountability(tankActual, meterDispensed)

	// ── 2. Forecourt ops (defaults — updated via separate endpoint) ───────────
	forecourtScore := ScoreForecourt(1, 1, 3.5, 1, 1) // neutral defaults

	// ── 3. Productivity (vehicles served normalised by station average) ───────
	var vehiclesServed int
	// Approximate: 1 vehicle per nozzle log entry (simplified)
	db.QueryRow(ctx,
		`SELECT COUNT(DISTINCT nl.id) FROM nozzle_logs nl WHERE nl.shift_id=$1`, shiftID,
	).Scan(&vehiclesServed)

	var shiftHours float64 = 8
	db.QueryRow(ctx, `
		SELECT GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(end_time, NOW())::timestamptz - start_time::timestamptz))/3600)
		FROM shifts WHERE id=$1`, shiftID,
	).Scan(&shiftHours)

	var stationAvgVPH float64
	if branchID != "" {
		db.QueryRow(ctx, `
			SELECT COALESCE(AVG(vehicles_served / 8.0), 0)
			FROM attendant_shift_scores
			WHERE business_id=$1 AND branch_id=$2::uuid
			  AND scored_at > NOW() - INTERVAL '7 days'`,
			businessID, branchID,
		).Scan(&stationAvgVPH)
	}
	prodScore, ratio := ScoreProductivity(vehiclesServed, shiftHours, stationAvgVPH)

	// ── 4. Attendance ─────────────────────────────────────────────────────────
	var lateMinutes int
	db.QueryRow(ctx, `
		SELECT COALESCE(SUM(
		  GREATEST(0, EXTRACT(EPOCH FROM (clock_in - s.start_time::timestamptz))/60)
		),0)::int
		FROM shift_attendance sa JOIN shifts s ON s.id=sa.shift_id
		WHERE sa.shift_id=$1 AND sa.user_id=$2`, shiftID, attendantID,
	).Scan(&lateMinutes)
	attScore := ScoreAttendance(lateMinutes, 0, 0)

	// ── 5. Customer service ───────────────────────────────────────────────────
	var posF, totF, compC int
	db.QueryRow(ctx, `
		SELECT SUM(CASE WHEN feedback_type IN ('positive','commendation') THEN 1 ELSE 0 END),
		       COUNT(*),
		       SUM(CASE WHEN feedback_type='complaint' THEN 1 ELSE 0 END)
		FROM employee_feedback WHERE employee_id=$1 AND shift_id=$2`, attendantID, shiftID,
	).Scan(&posF, &totF, &compC)
	csScore := ScoreCustomerService(posF, totF, compC, 0)

	// ── 6. Safety (defaults) ──────────────────────────────────────────────────
	safetyScore := ScoreSafety(1, 1, true, 0, 0)

	// ── 7. Team ───────────────────────────────────────────────────────────────
	teamScore := ScoreTeam(0, 0, 0, 3)

	// ── 8. Aggregate ─────────────────────────────────────────────────────────
	raw := fuelScore + forecourtScore + prodScore + attScore + csScore + safetyScore + teamScore

	bonuses := APSBonuses(raw, fuelVarPct, 0)
	penalties := APSPenalties(fuelVarPct, 0, 0)
	final, totalBonus, totalPenalty := applyAdjustments(raw, bonuses, penalties)

	bonusJSON := marshalScoringAdj(bonuses)
	penaltyJSON := marshalScoringAdj(penalties)

	nullBranch := interface{}(nil)
	if branchID != "" {
		nullBranch = branchID
	}
	var fuelVarPtr interface{}
	if fuelVarPct >= 0 {
		fuelVarPtr = fuelVarPct
	}
	var ratioPtr interface{}
	if ratio > 0 {
		ratioPtr = ratio
	}

	db.Exec(ctx, `
		INSERT INTO attendant_shift_scores
		  (shift_id, attendant_id, business_id, branch_id,
		   score_fuel_accountability, score_forecourt_ops, score_productivity,
		   score_attendance, score_customer_service, score_safety, score_team,
		   total_bonuses, total_penalties, bonus_breakdown, penalty_breakdown,
		   aps_shift_raw, aps_shift_final,
		   fuel_variance_pct, vehicles_served, fuel_volume_litres, productivity_ratio)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
		ON CONFLICT (shift_id, attendant_id) DO UPDATE SET
		  score_fuel_accountability=$5, score_forecourt_ops=$6, score_productivity=$7,
		  score_attendance=$8, score_customer_service=$9, score_safety=$10, score_team=$11,
		  total_bonuses=$12, total_penalties=$13, bonus_breakdown=$14, penalty_breakdown=$15,
		  aps_shift_raw=$16, aps_shift_final=$17,
		  fuel_variance_pct=$18, vehicles_served=$19, fuel_volume_litres=$20,
		  productivity_ratio=$21, scored_at=NOW()`,
		shiftID, attendantID, businessID, nullBranch,
		fuelScore, forecourtScore, prodScore, attScore, csScore, safetyScore, teamScore,
		r2(totalBonus), r2(totalPenalty), bonusJSON, penaltyJSON,
		r2(raw), final,
		fuelVarPtr, vehiclesServed, r2(meterDispensed), ratioPtr,
	)

	updateAttendantLifetimeStats(ctx, db, attendantID, businessID, final, meterDispensed, vehiclesServed)
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI Coaching Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Rule-based insight generation — no LLM dependency.
// Each insight is triggered by a comparison condition.
// The system compares the employee's last 30-day average to their prior 30 days
// and to top-10% performers at similar-traffic stations.
//
// Extension point: replace marshalCoachingInsight with an LLM call that receives
// the structured insight data and generates richer prose.

type cpsInsightInput struct {
	EmployeeID          string
	CurrentAvg          float64
	PriorAvg            float64
	TopTenPctThreshold  float64
	BestComponent       string
	WorstComponent      string
	WorstComponentScore float64
	WorstComponentMax   float64
	TotalShifts         int
	CurrentTier         string
}

func GenerateCashierCoachingInsight(input cpsInsightInput) model.CoachingInsight {
	delta := r2(input.CurrentAvg - input.PriorAvg)
	var strengths, improvements, actions, comparisons []string
	var summary string

	// Delta narrative
	if delta > 0 {
		summary = fmt.Sprintf("Your CPS improved by %.1f points this month.", delta)
	} else if delta < 0 {
		summary = fmt.Sprintf("Your CPS declined by %.1f points this month — let's turn it around.", math.Abs(delta))
	} else {
		summary = "Your CPS is holding steady this month."
	}

	// Strengths
	if input.CurrentAvg >= input.TopTenPctThreshold {
		strengths = append(strengths, "Your overall performance is in the top 10% of cashiers at stations with similar traffic volume.")
	}

	// Worst component coaching
	pct := 0.0
	if input.WorstComponentMax > 0 {
		pct = input.WorstComponentScore / input.WorstComponentMax * 100
	}
	if pct < 60 {
		msg := ""
		switch input.WorstComponent {
		case "cash_accuracy":
			msg = "Cash variance is your biggest gap. Double-check your counts at every safe drop, not just end-of-shift."
			actions = append(actions, "Count your drawer every 2 hours and record the result.")
		case "transaction_quality":
			msg = "Transaction exceptions (voids, refunds) are elevated. Ensure each one has supervisor approval before processing."
			actions = append(actions, "Always call your supervisor before voiding an order — document the reason.")
		case "sales_effectiveness":
			msg = "Sales efficiency is below the station average. Focus on mentioning loyalty rewards and promotions to every customer."
			actions = append(actions, "Mention the loyalty programme to every customer who doesn't already have a card.")
		case "attendance":
			msg = "Attendance and punctuality are dragging your score. Clock in 5 minutes early to build a buffer."
			actions = append(actions, "Set a phone alarm 15 minutes before your scheduled shift start.")
		case "customer_service":
			msg = "Customer satisfaction scores are below average. Greet every customer by name if they're on loyalty, and end each transaction with a genuine thank-you."
			actions = append(actions, "Acknowledge every customer within 10 seconds of approaching the register.")
		}
		if msg != "" {
			improvements = append(improvements, msg)
		}
	}

	// Confidence note for new employees
	if input.TotalShifts < 20 {
		comparisons = append(comparisons, fmt.Sprintf("You have %d shifts so far. Scores stabilise after ~40 shifts as the system builds confidence in your performance data.", input.TotalShifts))
	}

	return model.CoachingInsight{
		EmployeeID:  input.EmployeeID,
		Period:      "last_30_days",
		ScoreDelta:  delta,
		Strengths:   strengths,
		Improvements: improvements,
		Actions:     actions,
		Comparisons: comparisons,
		Summary:     summary,
		GeneratedAt: time.Now().Format(time.RFC3339),
	}
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

func marshalScoringAdj(adj []ScoringAdjustment) string {
	if len(adj) == 0 {
		return "[]"
	}
	parts := make([]string, len(adj))
	for i, a := range adj {
		sign := "+"
		if a.Pts < 0 {
			sign = ""
		}
		parts[i] = fmt.Sprintf(`{"reason":%q,"pts":%s%.2f}`, a.Reason, sign, a.Pts)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
