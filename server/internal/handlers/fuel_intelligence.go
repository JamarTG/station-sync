package handlers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

// ─── Constants & thresholds ───────────────────────────────────────────────────

const (
	// Variance classification thresholds (%)
	varAcceptable = 0.50 // ≤ 0.5% = acceptable
	varWarning    = 1.50 // ≤ 1.5% = warning
	// > 1.5% = critical

	// Delivery accuracy thresholds (%)
	deliveryAcceptable = 98.0
	deliveryWarning    = 95.0

	// Inventory status thresholds (% of capacity)
	invCritical = 10.0 // ≤ 10% = critical
	invLow      = 25.0 // ≤ 25% = low
	invHigh     = 90.0 // ≥ 90% = high

	// FPS component weights
	fpsWeightInventory  = 25.0
	fpsWeightLoss       = 25.0
	fpsWeightDelivery   = 15.0
	fpsWeightUtil       = 15.0
	fpsWeightSales      = 10.0
	fpsWeightCompliance = 10.0

	defaultLeadTime    = 3.0 // days
	defaultSafetyStock = 0.10 // 10% of ADU * lead_time
)

// ─── FuelIntelligenceHandler ──────────────────────────────────────────────────

type FuelIntelligenceHandler struct {
	DB *pgxpool.Pool
}

// ─── Variance classifier ──────────────────────────────────────────────────────

func classifyVariance(pct float64) string {
	abs := math.Abs(pct)
	switch {
	case abs <= varAcceptable:
		return "acceptable"
	case abs <= varWarning:
		return "warning"
	default:
		return "critical"
	}
}

func fpsGrade(fps float64) string {
	switch {
	case fps >= 90:
		return "A+"
	case fps >= 80:
		return "A"
	case fps >= 70:
		return "B"
	case fps >= 60:
		return "C"
	case fps >= 50:
		return "D"
	default:
		return "F"
	}
}

// ─── GetFPS — GET /fuel/fps ───────────────────────────────────────────────────
//
// Computes the Fuel Performance Score for the last 30 days.
func (h *FuelIntelligenceHandler) GetFPS(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	days := 30

	since := time.Now().AddDate(0, 0, -days).Format("2006-01-02")

	// ── 1. Inventory Accuracy Score (25 pts) ─────────────────────────────────
	// For each (tank, shift) pair: compute variance between theoretical and actual closing.
	type varRow struct {
		variancePct float64
	}
	varRows, _ := h.DB.Query(ctx, `
		SELECT
			ABS(
				COALESCE(tl.closing_level, 0) - (
					COALESCE(tl.opening_level, 0)
					+ COALESCE(tl.delivery_litres, 0)
					- COALESCE(nozzle_dispensed.litres, 0)
				)
			) / NULLIF(COALESCE(tl.opening_level, 0) + COALESCE(tl.delivery_litres, 0), 0) * 100 AS variance_pct
		FROM tank_logs tl
		JOIN shifts s ON s.id = tl.shift_id AND s.business_id = $1 AND s.date >= $3
		LEFT JOIN (
			SELECT nl.shift_id,
			       n.fuel_id,
			       SUM(nl.ending_reading - nl.starting_reading) AS litres
			FROM nozzle_logs nl
			JOIN nozzles n ON n.id = nl.nozzle_id
			GROUP BY nl.shift_id, n.fuel_id
		) nozzle_dispensed
		  ON nozzle_dispensed.shift_id = tl.shift_id
		 AND nozzle_dispensed.fuel_id = (SELECT fuel_id FROM tanks WHERE id = tl.tank_id)
		JOIN tanks t ON t.id = tl.tank_id AND ($2 = '' OR t.branch_id::text = $2)
		WHERE tl.opening_level IS NOT NULL
		  AND tl.closing_level IS NOT NULL
		  AND (COALESCE(tl.opening_level, 0) + COALESCE(tl.delivery_litres, 0)) > 0`,
		businessID, branchID, since,
	)

	var varSum, varCount float64
	var totalVarianceLitres float64
	if varRows != nil {
		defer varRows.Close()
		for varRows.Next() {
			var vp float64
			varRows.Scan(&vp)
			varSum += vp
			varCount++
		}
	}
	avgVarPct := 0.0
	if varCount > 0 {
		avgVarPct = varSum / varCount
	}
	// Score: 25 pts at 0% variance, 0 pts at ≥ 3%
	inventoryScore := math.Max(0, fpsWeightInventory*(1-avgVarPct/3.0))

	// ── 2. Fuel Loss Score (25 pts) ───────────────────────────────────────────
	var totalReceived, totalDispensed, totalActualClosing float64
	h.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(fr.litres_ordered), 0)
		FROM fuel_receivals fr
		JOIN shifts s ON s.id = fr.shift_id AND s.business_id = $1 AND s.date >= $2
		WHERE ($3 = '' OR s.branch_id::text = $3)`,
		businessID, since, branchID,
	).Scan(&totalReceived)

	h.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(nl.ending_reading - nl.starting_reading), 0)
		FROM nozzle_logs nl
		JOIN shifts s ON s.id = nl.shift_id AND s.business_id = $1 AND s.date >= $2
		WHERE ($3 = '' OR s.branch_id::text = $3)`,
		businessID, since, branchID,
	).Scan(&totalDispensed)

	// Shrinkage = received - dispensed (simplified: unaccounted fuel)
	shrinkage := 0.0
	if totalReceived > 0 {
		unaccounted := totalReceived - totalDispensed
		if unaccounted > 0 {
			// Check against actual closing inventory levels
			shrinkage = unaccounted / totalReceived * 100
		}
	}
	totalVarianceLitres = math.Abs(totalReceived - totalDispensed - totalActualClosing)
	// Loss score: 25 at 0% shrinkage, 0 at ≥ 1%
	lossScore := math.Max(0, fpsWeightLoss*(1-shrinkage/1.0))

	// ── 3. Delivery Efficiency Score (15 pts) ────────────────────────────────
	type delivAccRow struct{ accuracy float64 }
	dRows, _ := h.DB.Query(ctx, `
		SELECT
			(COALESCE(fr.closing_level,0) - COALESCE(fr.opening_level,0))
			/ NULLIF(fr.litres_ordered, 0) * 100 AS accuracy
		FROM fuel_receivals fr
		JOIN shifts s ON s.id = fr.shift_id AND s.business_id = $1 AND s.date >= $2
		WHERE fr.opening_level IS NOT NULL AND fr.closing_level IS NOT NULL
		  AND fr.litres_ordered > 0
		  AND ($3 = '' OR s.branch_id::text = $3)`,
		businessID, since, branchID,
	)
	var delivSum, delivCount, totalDeliveries float64
	if dRows != nil {
		defer dRows.Close()
		for dRows.Next() {
			var acc float64
			dRows.Scan(&acc)
			delivSum += math.Min(acc, 105) // cap surplus at 105%
			delivCount++
		}
	}
	totalDeliveries = delivCount
	avgDelivAcc := 100.0
	if delivCount > 0 {
		avgDelivAcc = delivSum / delivCount
	}
	// Score: 15 at 100% accuracy, 0 at ≤ 90%
	delivScore := math.Max(0, fpsWeightDelivery*(avgDelivAcc-90)/10)

	// ── 4. Tank Utilization Score (15 pts) ───────────────────────────────────
	// Optimal utilization = 70%. Score falls away from optimum.
	uRows, _ := h.DB.Query(ctx, `
		SELECT
			(COALESCE(tl.opening_level,0) + COALESCE(tl.closing_level,0)) / 2.0
			/ NULLIF(t.capacity_litres, 0) * 100 AS util_pct
		FROM tank_logs tl
		JOIN tanks t ON t.id = tl.tank_id AND t.capacity_litres > 0
		JOIN shifts s ON s.id = tl.shift_id AND s.business_id = $1 AND s.date >= $2
		WHERE tl.opening_level IS NOT NULL AND tl.closing_level IS NOT NULL
		  AND ($3 = '' OR t.branch_id::text = $3)`,
		businessID, since, branchID,
	)
	var utilSum, utilCount float64
	if uRows != nil {
		defer uRows.Close()
		for uRows.Next() {
			var u float64
			uRows.Scan(&u)
			utilSum += u
			utilCount++
		}
	}
	avgUtil := 70.0
	if utilCount > 0 {
		avgUtil = utilSum / utilCount
	}
	// Score peaks at 70% utilization
	utilScore := fpsWeightUtil * math.Max(0, 1-math.Abs(avgUtil-70)/70)

	// ── 5. Sales Performance Score (10 pts) ──────────────────────────────────
	var totalSales, prevSales float64
	h.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(d.amount), 0) FROM deposits d
		JOIN shifts s ON s.id = d.shift_id AND s.business_id = $1 AND s.date >= $2
		WHERE ($3 = '' OR s.branch_id::text = $3) AND d.type NOT IN ('Expenditure','Advance')`,
		businessID, since, branchID,
	).Scan(&totalSales)
	h.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(d.amount), 0) FROM deposits d
		JOIN shifts s ON s.id = d.shift_id AND s.business_id = $1
		  AND s.date >= $2 AND s.date < $3
		WHERE ($4 = '' OR s.branch_id::text = $4) AND d.type NOT IN ('Expenditure','Advance')`,
		businessID,
		time.Now().AddDate(0, 0, -days*2).Format("2006-01-02"),
		since, branchID,
	).Scan(&prevSales)

	salesScore := 8.0 // baseline
	if prevSales > 0 {
		growth := (totalSales - prevSales) / prevSales
		salesScore = math.Min(fpsWeightSales, 8.0+growth*10)
		salesScore = math.Max(0, salesScore)
	}

	// ── 6. Compliance Score (10 pts) ─────────────────────────────────────────
	var closedShifts, shiftsWithTankLog, shiftsWithNozzleLog float64
	h.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM shifts
		WHERE business_id = $1 AND end_time IS NOT NULL AND date >= $2
		  AND ($3 = '' OR branch_id::text = $3)
		  AND COALESCE(shift_type,'service_station') = 'service_station'`,
		businessID, since, branchID,
	).Scan(&closedShifts)
	h.DB.QueryRow(ctx, `
		SELECT COUNT(DISTINCT tl.shift_id) FROM tank_logs tl
		JOIN shifts s ON s.id = tl.shift_id AND s.business_id = $1 AND s.date >= $2
		WHERE ($3 = '' OR s.branch_id::text = $3)`,
		businessID, since, branchID,
	).Scan(&shiftsWithTankLog)
	h.DB.QueryRow(ctx, `
		SELECT COUNT(DISTINCT nl.shift_id) FROM nozzle_logs nl
		JOIN shifts s ON s.id = nl.shift_id AND s.business_id = $1 AND s.date >= $2
		WHERE ($3 = '' OR s.branch_id::text = $3)`,
		businessID, since, branchID,
	).Scan(&shiftsWithNozzleLog)

	complianceRate := 0.0
	if closedShifts > 0 {
		tankComp := shiftsWithTankLog / closedShifts
		nozzleComp := shiftsWithNozzleLog / closedShifts
		complianceRate = (tankComp + nozzleComp) / 2
	}
	complianceScore := fpsWeightCompliance * complianceRate

	// ── Final FPS ─────────────────────────────────────────────────────────────
	fps := inventoryScore + lossScore + delivScore + utilScore + salesScore + complianceScore

	result := model.FPSResult{
		BusinessID:           businessID,
		BranchID:             branchID,
		Period:               "last_30_days",
		ScoreInventoryAccuracy: math.Round(inventoryScore*10) / 10,
		ScoreFuelLoss:          math.Round(lossScore*10) / 10,
		ScoreDeliveryEff:       math.Round(delivScore*10) / 10,
		ScoreTankUtilization:   math.Round(utilScore*10) / 10,
		ScoreSalesPerformance:  math.Round(salesScore*10) / 10,
		ScoreCompliance:        math.Round(complianceScore*10) / 10,
		FPSTotal:               math.Round(fps*10) / 10,
		Grade:                  fpsGrade(fps),
		TotalTanksScored:       int(varCount),
		AvgVariancePct:         math.Round(avgVarPct*100) / 100,
		TotalShrinkageLitres:   math.Round(totalVarianceLitres*10) / 10,
		TotalDeliveries:        int(totalDeliveries),
		ComplianceRate:         math.Round(complianceRate*1000) / 10,
	}
	c.JSON(http.StatusOK, result)
}

// ─── GetTanksSummary — GET /fuel/tanks/summary ────────────────────────────────

func (h *FuelIntelligenceHandler) GetTanksSummary(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	since := time.Now().AddDate(0, 0, -30).Format("2006-01-02")

	// Load all tanks for this business/branch
	tankRows, err := h.DB.Query(ctx, `
		SELECT t.id::text, t.name, COALESCE(f.name,'Unknown'), COALESCE(t.capacity_litres,0),
		       COALESCE(t.lead_time_days, $3), COALESCE(t.safety_stock_litres, 0)
		FROM tanks t
		LEFT JOIN fuels f ON f.id = t.fuel_id
		WHERE t.business_id = $1 AND ($2 = '' OR t.branch_id::text = $2)
		ORDER BY t.name`,
		businessID, branchID, defaultLeadTime,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tankRows.Close()

	type tankBase struct {
		id, name, fuelName string
		capacity, leadTime, safetyStock float64
	}
	var tanks []tankBase
	for tankRows.Next() {
		var t tankBase
		tankRows.Scan(&t.id, &t.name, &t.fuelName, &t.capacity, &t.leadTime, &t.safetyStock)
		tanks = append(tanks, t)
	}

	summaries := make([]model.TankSummary, 0, len(tanks))
	for _, tank := range tanks {
		// Latest closing level
		var latestClosing, latestOpening float64
		h.DB.QueryRow(ctx, `
			SELECT COALESCE(closing_level,0), COALESCE(opening_level,0)
			FROM tank_logs WHERE tank_id = $1 AND closing_level IS NOT NULL
			ORDER BY (SELECT date FROM shifts WHERE id = shift_id) DESC,
			         (SELECT created_at FROM shifts WHERE id = shift_id) DESC
			LIMIT 1`, tank.id,
		).Scan(&latestClosing, &latestOpening)

		// ADU from last 14 days of nozzle logs
		var aduLitres float64
		h.DB.QueryRow(ctx, `
			SELECT COALESCE(SUM(nl.ending_reading - nl.starting_reading) / NULLIF(COUNT(DISTINCT s.date), 0), 0)
			FROM nozzle_logs nl
			JOIN nozzles n ON n.id = nl.nozzle_id
			JOIN shifts s ON s.id = nl.shift_id
			WHERE s.business_id = $1
			  AND s.date >= $2
			  AND n.fuel_id = (SELECT fuel_id FROM tanks WHERE id = $3)
			  AND ($4 = '' OR s.branch_id::text = $4)`,
			businessID,
			time.Now().AddDate(0, 0, -14).Format("2006-01-02"),
			tank.id, branchID,
		).Scan(&aduLitres)

		// Variance analysis (last 30 days)
		vRows, _ := h.DB.Query(ctx, `
			SELECT
				COALESCE(tl.closing_level,0) - (
					COALESCE(tl.opening_level,0) + COALESCE(tl.delivery_litres,0)
					- COALESCE(nd.litres,0)
				) AS variance_litres,
				ABS(
					COALESCE(tl.closing_level,0) - (
						COALESCE(tl.opening_level,0) + COALESCE(tl.delivery_litres,0)
						- COALESCE(nd.litres,0)
					)
				) / NULLIF(COALESCE(tl.opening_level,0) + COALESCE(tl.delivery_litres,0), 0) * 100 AS variance_pct
			FROM tank_logs tl
			JOIN shifts s ON s.id = tl.shift_id AND s.business_id = $1 AND s.date >= $2
			LEFT JOIN (
				SELECT nl.shift_id, SUM(nl.ending_reading - nl.starting_reading) AS litres
				FROM nozzle_logs nl JOIN nozzles n2 ON n2.id = nl.nozzle_id
				WHERE n2.fuel_id = (SELECT fuel_id FROM tanks WHERE id = $3)
				GROUP BY nl.shift_id
			) nd ON nd.shift_id = tl.shift_id
			WHERE tl.tank_id = $3
			  AND tl.opening_level IS NOT NULL AND tl.closing_level IS NOT NULL
			  AND (COALESCE(tl.opening_level,0) + COALESCE(tl.delivery_litres,0)) > 0`,
			businessID, since, tank.id,
		)

		var varTotal, varPctSum float64
		var shiftsAnalysed int
		if vRows != nil {
			defer vRows.Close()
			for vRows.Next() {
				var vl, vp float64
				vRows.Scan(&vl, &vp)
				varTotal += vl
				varPctSum += vp
				shiftsAnalysed++
			}
		}
		avgVarPct := 0.0
		if shiftsAnalysed > 0 {
			avgVarPct = varPctSum / float64(shiftsAnalysed)
		}

		// Utilization
		var utilSum float64
		var utilCount int
		uRows, _ := h.DB.Query(ctx, `
			SELECT (COALESCE(opening_level,0)+COALESCE(closing_level,0))/2 / NULLIF($3,0) * 100
			FROM tank_logs WHERE tank_id = $1
			  AND opening_level IS NOT NULL AND closing_level IS NOT NULL
			  AND shift_id IN (SELECT id FROM shifts WHERE business_id = $2 AND date >= $4)`,
			tank.id, businessID, tank.capacity, since,
		)
		if uRows != nil {
			defer uRows.Close()
			for uRows.Next() {
				var u float64
				uRows.Scan(&u)
				utilSum += u
				utilCount++
			}
		}
		avgUtil := 0.0
		if utilCount > 0 {
			avgUtil = utilSum / float64(utilCount)
		}

		// Reorder calculations
		leadTime := tank.leadTime
		if leadTime <= 0 {
			leadTime = defaultLeadTime
		}
		safetyStock := tank.safetyStock
		if safetyStock <= 0 && aduLitres > 0 {
			safetyStock = aduLitres * leadTime * defaultSafetyStock
		}
		rop := aduLitres*leadTime + safetyStock
		daysUntilReorder := 0.0
		daysUntilEmpty := 0.0
		if aduLitres > 0 {
			daysUntilReorder = (latestClosing - rop) / aduLitres
			daysUntilEmpty = latestClosing / aduLitres
		}

		// Inventory status
		pct := 0.0
		if tank.capacity > 0 {
			pct = latestClosing / tank.capacity * 100
		}
		invStatus := "normal"
		switch {
		case pct <= invCritical:
			invStatus = "critical"
		case pct <= invLow:
			invStatus = "low"
		case pct >= invHigh:
			invStatus = "high"
		}

		// Per-tank FPS (simplified)
		tankFPS := 0.0
		if shiftsAnalysed > 0 {
			accScore := math.Max(0, 40*(1-avgVarPct/3.0))
			utilScore := 30 * math.Max(0, 1-math.Abs(avgUtil-70)/70)
			reorderScore := 0.0
			if daysUntilReorder > 2 {
				reorderScore = 30
			} else if daysUntilReorder > 0 {
				reorderScore = 15
			}
			tankFPS = math.Min(100, accScore+utilScore+reorderScore)
		}

		summaries = append(summaries, model.TankSummary{
			TankID:              tank.id,
			TankName:            tank.name,
			FuelName:            tank.fuelName,
			CapacityLitres:      tank.capacity,
			CurrentLevel:        math.Round(latestClosing*10) / 10,
			CurrentPct:          math.Round(pct*10) / 10,
			UllageLitres:        math.Round((tank.capacity-latestClosing)*10) / 10,
			InventoryStatus:     invStatus,
			AvgVariancePct:      math.Round(avgVarPct*100) / 100,
			TotalVarianceLitres: math.Round(varTotal*10) / 10,
			VarianceClass:       classifyVariance(avgVarPct),
			ShiftsAnalysed:      shiftsAnalysed,
			AvgUtilizationPct:   math.Round(avgUtil*10) / 10,
			AvgDailyUsageLitres: math.Round(aduLitres*10) / 10,
			DaysUntilReorder:    math.Round(daysUntilReorder*10) / 10,
			DaysUntilEmpty:      math.Round(daysUntilEmpty*10) / 10,
			ReorderPointLitres:  math.Round(rop*10) / 10,
			ReorderSuggested:    daysUntilReorder <= 1 || pct <= invLow,
			LeadTimeDays:        leadTime,
			SafetyStockLitres:   math.Round(safetyStock*10) / 10,
			TankFPS:             math.Round(tankFPS*10) / 10,
		})
	}
	c.JSON(http.StatusOK, summaries)
}

// ─── GetGradeAnalytics — GET /fuel/grades/analytics ──────────────────────────

func (h *FuelIntelligenceHandler) GetGradeAnalytics(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	since := time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	prevSince := time.Now().AddDate(0, 0, -60).Format("2006-01-02")

	// Aggregate nozzle-log litres + shift_fuel_prices revenue per fuel, current period
	rows, err := h.DB.Query(ctx, `
		SELECT
			COALESCE(f.id::text, 'unknown') AS fuel_id,
			COALESCE(f.name, 'Unknown')     AS fuel_name,
			COALESCE(SUM(nl.ending_reading - nl.starting_reading), 0) AS litres_sold,
			COALESCE(SUM(
				(nl.ending_reading - nl.starting_reading)
				* COALESCE((
					SELECT sfp.price FROM shift_fuel_prices sfp
					WHERE sfp.shift_id = nl.shift_id AND sfp.fuel_id = f.id LIMIT 1
				), 0)
			), 0) AS revenue
		FROM nozzle_logs nl
		JOIN nozzles n ON n.id = nl.nozzle_id
		LEFT JOIN fuels f ON f.id = n.fuel_id
		JOIN shifts s ON s.id = nl.shift_id AND s.business_id = $1 AND s.date >= $2
		WHERE ($3 = '' OR s.branch_id::text = $3)
		GROUP BY f.id, f.name
		ORDER BY revenue DESC`,
		businessID, since, branchID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type gradeRow struct {
		fuelID, fuelName string
		litresSold, revenue float64
	}
	var gradeRows []gradeRow
	var totalRevenue float64
	for rows.Next() {
		var r gradeRow
		rows.Scan(&r.fuelID, &r.fuelName, &r.litresSold, &r.revenue)
		gradeRows = append(gradeRows, r)
		totalRevenue += r.revenue
	}

	analytics := make([]model.GradeAnalytics, 0, len(gradeRows))
	for _, g := range gradeRows {
		// Cost (from fuel_receivals with rate)
		var cost float64
		h.DB.QueryRow(ctx, `
			SELECT COALESCE(SUM(fr.litres_ordered * COALESCE(fr.rate,0)), 0)
			FROM fuel_receivals fr
			JOIN shifts s ON s.id = fr.shift_id AND s.business_id = $1 AND s.date >= $2
			WHERE fr.fuel_name = (SELECT name FROM fuels WHERE id = $3)
			  AND ($4 = '' OR s.branch_id::text = $4)`,
			businessID, since, g.fuelID, branchID,
		).Scan(&cost)

		// Litres received
		var litresReceived float64
		h.DB.QueryRow(ctx, `
			SELECT COALESCE(SUM(fr.litres_ordered), 0)
			FROM fuel_receivals fr
			JOIN shifts s ON s.id = fr.shift_id AND s.business_id = $1 AND s.date >= $2
			WHERE fr.fuel_name = (SELECT name FROM fuels WHERE id = $3)
			  AND ($4 = '' OR s.branch_id::text = $4)`,
			businessID, since, g.fuelID, branchID,
		).Scan(&litresReceived)

		// Previous period volume for growth calc
		var prevLitres, prevRevenue float64
		h.DB.QueryRow(ctx, `
			SELECT COALESCE(SUM(nl.ending_reading - nl.starting_reading), 0)
			FROM nozzle_logs nl JOIN nozzles n ON n.id = nl.nozzle_id
			JOIN shifts s ON s.id = nl.shift_id AND s.business_id = $1
			  AND s.date >= $2 AND s.date < $3
			WHERE n.fuel_id = $4 AND ($5 = '' OR s.branch_id::text = $5)`,
			businessID, prevSince, since, g.fuelID, branchID,
		).Scan(&prevLitres)

		h.DB.QueryRow(ctx, `
			SELECT COALESCE(SUM(
				(nl.ending_reading - nl.starting_reading)
				* COALESCE((SELECT sfp.price FROM shift_fuel_prices sfp
				            WHERE sfp.shift_id = nl.shift_id AND sfp.fuel_id = $4 LIMIT 1), 0)
			), 0)
			FROM nozzle_logs nl JOIN nozzles n ON n.id = nl.nozzle_id
			JOIN shifts s ON s.id = nl.shift_id AND s.business_id = $1
			  AND s.date >= $2 AND s.date < $3
			WHERE n.fuel_id = $4 AND ($5 = '' OR s.branch_id::text = $5)`,
			businessID, prevSince, since, g.fuelID, branchID,
		).Scan(&prevRevenue)

		grossProfit := g.revenue - cost
		marginPct := 0.0
		if g.revenue > 0 {
			marginPct = grossProfit / g.revenue * 100
		}
		profitPerLitre := 0.0
		if g.litresSold > 0 {
			profitPerLitre = grossProfit / g.litresSold
		}
		turnover := 0.0
		if litresReceived > 0 {
			turnover = g.litresSold / litresReceived
		}
		revShare := 0.0
		if totalRevenue > 0 {
			revShare = g.revenue / totalRevenue * 100
		}
		shrinkagePct := 0.0
		if litresReceived > 0 {
			shrinkagePct = math.Abs(litresReceived-g.litresSold) / litresReceived * 100
		}
		revGrowth, volGrowth := 0.0, 0.0
		if prevRevenue > 0 {
			revGrowth = (g.revenue - prevRevenue) / prevRevenue * 100
		}
		if prevLitres > 0 {
			volGrowth = (g.litresSold - prevLitres) / prevLitres * 100
		}

		analytics = append(analytics, model.GradeAnalytics{
			FuelID:              g.fuelID,
			FuelName:            g.fuelName,
			TotalLitresSold:     math.Round(g.litresSold*10) / 10,
			AvgDailyLitres:      math.Round(g.litresSold/30*10) / 10,
			TotalLitresReceived: math.Round(litresReceived*10) / 10,
			InventoryTurnover:   math.Round(turnover*100) / 100,
			TotalRevenue:        math.Round(g.revenue*100) / 100,
			TotalCost:           math.Round(cost*100) / 100,
			GrossProfit:         math.Round(grossProfit*100) / 100,
			MarginPct:           math.Round(marginPct*100) / 100,
			ProfitPerLitre:      math.Round(profitPerLitre*100) / 100,
			RevenueShare:        math.Round(revShare*100) / 100,
			TotalVarianceLitres: math.Round((litresReceived-g.litresSold)*10) / 10,
			ShrinkagePct:        math.Round(shrinkagePct*100) / 100,
			RevenueGrowthPct:    math.Round(revGrowth*100) / 100,
			VolumeGrowthPct:     math.Round(volGrowth*100) / 100,
		})
	}
	c.JSON(http.StatusOK, analytics)
}

// ─── GetDeliverySummary — GET /fuel/deliveries/summary ───────────────────────

func (h *FuelIntelligenceHandler) GetDeliverySummary(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	since := time.Now().AddDate(0, 0, -30).Format("2006-01-02")

	rows, err := h.DB.Query(ctx, `
		SELECT
			fr.id::text, fr.shift_id::text, s.date::text,
			fr.tank_id::text, COALESCE(t.name,'—'), fr.fuel_name,
			COALESCE(fr.supplier_name,'—'), COALESCE(fr.invoice_no,'—'),
			fr.litres_ordered,
			COALESCE(fr.closing_level,0) - COALESCE(fr.opening_level,0) AS litres_measured,
			COALESCE(fr.rate,0), COALESCE(fr.haulage,0), COALESCE(fr.gct,0)
		FROM fuel_receivals fr
		JOIN shifts s ON s.id = fr.shift_id AND s.business_id = $1 AND s.date >= $2
		LEFT JOIN tanks t ON t.id = fr.tank_id
		WHERE ($3 = '' OR s.branch_id::text = $3)
		  AND fr.opening_level IS NOT NULL AND fr.closing_level IS NOT NULL
		ORDER BY s.date DESC, fr.id`,
		businessID, since, branchID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var records []model.DeliveryRecord
	var totOrd, totMeas, shortfall float64
	var shortCount, surplusCount int

	for rows.Next() {
		var r model.DeliveryRecord
		var rate, haulage, gct float64
		rows.Scan(&r.ID, &r.ShiftID, &r.ShiftDate, &r.TankID, &r.TankName,
			&r.FuelName, &r.SupplierName, &r.InvoiceNo,
			&r.LitresOrdered, &r.LitresMeasured, &rate, &haulage, &gct)

		r.DeliveryVariance = r.LitresMeasured - r.LitresOrdered
		if r.LitresOrdered > 0 {
			r.AccuracyPct = math.Round(r.LitresMeasured/r.LitresOrdered*10000) / 100
		} else {
			r.AccuracyPct = 100
		}
		switch {
		case r.AccuracyPct < deliveryWarning:
			r.AccuracyClass = "short"
			shortCount++
			shortfall += r.LitresOrdered - r.LitresMeasured
		case r.AccuracyPct > 102:
			r.AccuracyClass = "surplus"
			surplusCount++
		default:
			r.AccuracyClass = "accurate"
		}
		r.CostPerLitre = rate
		r.TotalCost = math.Round(r.LitresOrdered*(rate+haulage)*1.0*(1+gct/100)*100) / 100

		totOrd += r.LitresOrdered
		totMeas += r.LitresMeasured
		records = append(records, r)
	}

	overall := 100.0
	if totOrd > 0 {
		overall = math.Round(totMeas/totOrd*10000) / 100
	}
	var avgCost float64
	if len(records) > 0 {
		for _, r := range records {
			avgCost += r.CostPerLitre
		}
		avgCost /= float64(len(records))
	}

	c.JSON(http.StatusOK, model.DeliverySummary{
		TotalDeliveries:     len(records),
		TotalLitresOrdered:  math.Round(totOrd*10) / 10,
		TotalLitresMeasured: math.Round(totMeas*10) / 10,
		OverallAccuracyPct:  overall,
		ShortDeliveries:     shortCount,
		SurplusDeliveries:   surplusCount,
		TotalShortfall:      math.Round(shortfall*10) / 10,
		AvgCostPerLitre:     math.Round(avgCost*100) / 100,
		Records:             records,
	})
}

// ─── GetReorderStatus — GET /fuel/reorder ────────────────────────────────────

func (h *FuelIntelligenceHandler) GetReorderStatus(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")

	rows, err := h.DB.Query(ctx, `
		SELECT t.id::text, t.name, COALESCE(f.name,'Unknown'),
		       COALESCE(t.capacity_litres,0),
		       COALESCE(t.lead_time_days,$3), COALESCE(t.safety_stock_litres,0)
		FROM tanks t
		LEFT JOIN fuels f ON f.id = t.fuel_id
		WHERE t.business_id = $1 AND ($2 = '' OR t.branch_id::text = $2)
		ORDER BY t.name`,
		businessID, branchID, defaultLeadTime,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type tankRow struct{ id, name, fuel string; cap, lead, safety float64 }
	var tanks []tankRow
	for rows.Next() {
		var t tankRow
		rows.Scan(&t.id, &t.name, &t.fuel, &t.cap, &t.lead, &t.safety)
		tanks = append(tanks, t)
	}

	statuses := make([]model.ReorderStatus, 0, len(tanks))
	for _, tank := range tanks {
		var current float64
		h.DB.QueryRow(ctx, `
			SELECT COALESCE(closing_level,0) FROM tank_logs
			WHERE tank_id = $1 AND closing_level IS NOT NULL
			ORDER BY (SELECT date FROM shifts WHERE id = shift_id) DESC LIMIT 1`,
			tank.id,
		).Scan(&current)

		var adu float64
		h.DB.QueryRow(ctx, `
			SELECT COALESCE(SUM(nl.ending_reading - nl.starting_reading)
			       / NULLIF(COUNT(DISTINCT s.date),0), 0)
			FROM nozzle_logs nl
			JOIN nozzles n ON n.id = nl.nozzle_id
			JOIN shifts s ON s.id = nl.shift_id
			WHERE s.business_id = $1
			  AND s.date >= $2
			  AND n.fuel_id = (SELECT fuel_id FROM tanks WHERE id = $3)
			  AND ($4 = '' OR s.branch_id::text = $4)`,
			businessID,
			time.Now().AddDate(0, 0, -14).Format("2006-01-02"),
			tank.id, branchID,
		).Scan(&adu)

		lead := tank.lead
		if lead <= 0 {
			lead = defaultLeadTime
		}
		safety := tank.safety
		if safety <= 0 && adu > 0 {
			safety = adu * lead * defaultSafetyStock
		}
		rop := adu*lead + safety
		reorderQty := math.Max(0, tank.cap-current)
		daysUntilReorder := 0.0
		daysUntilEmpty := 0.0
		if adu > 0 {
			daysUntilReorder = (current - rop) / adu
			daysUntilEmpty = current / adu
		}

		urgency := "normal"
		switch {
		case daysUntilReorder <= 0 || current <= rop:
			urgency = "critical"
		case daysUntilReorder <= 1:
			urgency = "urgent"
		case daysUntilReorder <= 3:
			urgency = "soon"
		}

		statuses = append(statuses, model.ReorderStatus{
			TankID:             tank.id,
			TankName:           tank.name,
			FuelName:           tank.fuel,
			CurrentLitres:      math.Round(current*10) / 10,
			CapacityLitres:     tank.cap,
			AvgDailyUsage:      math.Round(adu*10) / 10,
			LeadTimeDays:       lead,
			SafetyStockLitres:  math.Round(safety*10) / 10,
			ReorderPointLitres: math.Round(rop*10) / 10,
			ReorderQtyLitres:   math.Round(reorderQty*10) / 10,
			DaysUntilReorder:   math.Round(daysUntilReorder*10) / 10,
			DaysUntilEmpty:     math.Round(daysUntilEmpty*10) / 10,
			Urgency:            urgency,
			ReorderSuggested:   urgency == "critical" || urgency == "urgent",
		})
	}
	c.JSON(http.StatusOK, statuses)
}

// ─── GetAlerts — GET /fuel/alerts ────────────────────────────────────────────

func (h *FuelIntelligenceHandler) GetAlerts(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	all := c.Query("all") == "true"

	query := `
		SELECT fa.id::text, fa.business_id::text,
		       fa.branch_id::text, fa.tank_id::text,
		       COALESCE(t.name,'—') AS tank_name,
		       fa.shift_id::text,
		       fa.alert_type, fa.severity, fa.title, fa.message,
		       fa.value, fa.threshold,
		       fa.resolved, fa.resolved_at::text, fa.created_at::text
		FROM fuel_alerts fa
		LEFT JOIN tanks t ON t.id = fa.tank_id
		WHERE fa.business_id = $1
		  AND ($2 = '' OR fa.branch_id::text = $2)`
	if !all {
		query += ` AND fa.resolved = false`
	}
	query += ` ORDER BY fa.created_at DESC LIMIT 200`

	rows, err := h.DB.Query(ctx, query, businessID, branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	alerts := []model.FuelAlert{}
	for rows.Next() {
		var a model.FuelAlert
		var branchStr, tankStr, shiftStr, resolvedAt *string
		rows.Scan(&a.ID, &a.BusinessID, &branchStr, &tankStr, &a.TankName,
			&shiftStr, &a.AlertType, &a.Severity, &a.Title, &a.Message,
			&a.Value, &a.Threshold, &a.Resolved, &resolvedAt, &a.CreatedAt)
		a.BranchID = branchStr
		a.TankID = tankStr
		a.ShiftID = shiftStr
		a.ResolvedAt = resolvedAt
		alerts = append(alerts, a)
	}
	c.JSON(http.StatusOK, alerts)
}

// ─── ResolveAlert — PATCH /fuel/alerts/:id/resolve ───────────────────────────

func (h *FuelIntelligenceHandler) ResolveAlert(c *gin.Context) {
	ctx := c.Request.Context()
	businessID := c.GetString("business_id")
	_, err := h.DB.Exec(ctx, `
		UPDATE fuel_alerts SET resolved = true, resolved_at = NOW()
		WHERE id = $1 AND business_id = $2`,
		c.Param("alertId"), businessID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ─── CheckAlerts — POST /fuel/alerts/check ───────────────────────────────────
//
// Inspects current tank levels, latest variances and delivery data,
// then creates new fuel_alerts for anything that breaches thresholds.
// Called automatically after a shift closes (same goroutine pattern as SPS).
func CheckFuelAlerts(ctx context.Context, db *pgxpool.Pool, businessID, branchID string) {
	// Low inventory alerts
	invRows, err := db.Query(ctx, `
		SELECT t.id::text, t.name, COALESCE(f.name,'Unknown'),
		       COALESCE(t.capacity_litres,0),
		       (SELECT COALESCE(closing_level,0)
		        FROM tank_logs WHERE tank_id = t.id AND closing_level IS NOT NULL
		        ORDER BY (SELECT date FROM shifts WHERE id = shift_id) DESC LIMIT 1) AS level
		FROM tanks t
		LEFT JOIN fuels f ON f.id = t.fuel_id
		WHERE t.business_id = $1 AND ($2 = '' OR t.branch_id::text = $2)`,
		businessID, branchID,
	)
	if err == nil && invRows != nil {
		defer invRows.Close()
		for invRows.Next() {
			var tankID, tankName, fuelName string
			var capacity, level float64
			invRows.Scan(&tankID, &tankName, &fuelName, &capacity, &level)

			if capacity <= 0 {
				continue
			}
			pct := level / capacity * 100
			var severity, title, msg string
			if pct <= invCritical {
				severity = "critical"
				title = tankName + " — Critical Low Inventory"
				msg = fuelName + " level at " + formatPct(pct) + "% capacity (" + formatLitres(level) + " L remaining). Immediate reorder required."
			} else if pct <= invLow {
				severity = "warning"
				title = tankName + " — Low Inventory"
				msg = fuelName + " level at " + formatPct(pct) + "% capacity. Consider placing a reorder."
			} else {
				continue
			}

			// Avoid duplicate active alerts for same tank + type
			var existing int
			db.QueryRow(ctx, `
				SELECT COUNT(*) FROM fuel_alerts
				WHERE tank_id = $1 AND alert_type = 'low_inventory' AND resolved = false
				  AND created_at >= NOW() - INTERVAL '24 hours'`,
				tankID,
			).Scan(&existing)
			if existing > 0 {
				continue
			}

			db.Exec(ctx, `
				INSERT INTO fuel_alerts
				  (business_id, branch_id, tank_id, alert_type, severity, title, message, value, threshold)
				VALUES ($1, NULLIF($2,'')::uuid, $3, 'low_inventory', $4, $5, $6, $7, $8)`,
				businessID, branchID, tankID, severity, title, msg, pct, invLow,
			)
		}
	}

	// High variance alert — last closed shift with variance > warning threshold
	varRows, _ := db.Query(ctx, `
		SELECT
			t.id::text, t.name, COALESCE(f.name,'Unknown'),
			ABS(
				COALESCE(tl.closing_level,0) - (
					COALESCE(tl.opening_level,0) + COALESCE(tl.delivery_litres,0)
					- COALESCE(nd.litres,0)
				)
			) / NULLIF(COALESCE(tl.opening_level,0)+COALESCE(tl.delivery_litres,0),0)*100 AS var_pct,
			tl.shift_id::text
		FROM tank_logs tl
		JOIN tanks t ON t.id = tl.tank_id
		LEFT JOIN fuels f ON f.id = t.fuel_id
		LEFT JOIN (
			SELECT nl.shift_id, n.fuel_id, SUM(nl.ending_reading-nl.starting_reading) AS litres
			FROM nozzle_logs nl JOIN nozzles n ON n.id = nl.nozzle_id
			GROUP BY nl.shift_id, n.fuel_id
		) nd ON nd.shift_id = tl.shift_id AND nd.fuel_id = t.fuel_id
		JOIN shifts s ON s.id = tl.shift_id AND s.business_id = $1 AND s.end_time IS NOT NULL
		  AND s.date >= $2
		WHERE tl.opening_level IS NOT NULL AND tl.closing_level IS NOT NULL
		  AND (COALESCE(tl.opening_level,0)+COALESCE(tl.delivery_litres,0)) > 0
		  AND t.business_id = $1 AND ($3 = '' OR t.branch_id::text = $3)`,
		businessID,
		time.Now().AddDate(0, 0, -3).Format("2006-01-02"),
		branchID,
	)
	if varRows != nil {
		defer varRows.Close()
		for varRows.Next() {
			var tankID, tankName, fuelName, shiftID string
			var varPct float64
			varRows.Scan(&tankID, &tankName, &fuelName, &varPct, &shiftID)
			if varPct <= varWarning {
				continue
			}
			var existing int
			db.QueryRow(ctx, `
				SELECT COUNT(*) FROM fuel_alerts
				WHERE tank_id=$1 AND alert_type='high_variance' AND resolved=false
				  AND created_at >= NOW()-INTERVAL '12 hours'`,
				tankID,
			).Scan(&existing)
			if existing > 0 {
				continue
			}
			severity := "warning"
			if varPct > 3 {
				severity = "critical"
			}
			db.Exec(ctx, `
				INSERT INTO fuel_alerts
				  (business_id, branch_id, tank_id, shift_id, alert_type, severity, title, message, value, threshold)
				VALUES ($1, NULLIF($2,'')::uuid, $3, $4, 'high_variance', $5,
				        $6, $7, $8, $9)`,
				businessID, branchID, tankID, shiftID, severity,
				tankName+" — Fuel Variance Alert",
				fuelName+" recorded "+formatPct(varPct)+"% variance this shift. Investigate meter readings and dip logs.",
				varPct, varWarning,
			)
		}
	}
}

func (h *FuelIntelligenceHandler) CheckAlerts(c *gin.Context) {
	go CheckFuelAlerts(context.Background(), h.DB,
		c.GetString("business_id"), c.GetString("branch_id"))
	c.JSON(http.StatusAccepted, gin.H{"status": "alert check queued"})
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func formatPct(f float64) string  { return fmt.Sprintf("%.1f", f) }
func formatLitres(f float64) string { return fmt.Sprintf("%.0f", f) }
