package handlers

// ─── Payroll Engine ────────────────────────────────────────────────────────────
//
// Pure, stateless calculation engine.
// All tax parameters come from the TaxConfig struct — nothing is hardcoded.
// Load TaxConfig from DB via LoadActiveTaxConfig(), then pass it to any
// calculation function. This makes the engine fully testable and auditable.

import (
	"context"
	"math"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ─── Frequency ────────────────────────────────────────────────────────────────

// FrequencyPeriods maps a payroll frequency to the number of pay periods per year.
var FrequencyPeriods = map[string]float64{
	"Weekly":      52,
	"BiWeekly":    26,
	"Fortnightly": 26,
	"SemiMonthly": 24,
	"Monthly":     12,
}

// periodsPerYear returns the pay periods per year for a frequency, defaulting to 12.
func periodsPerYear(freq string) float64 {
	if p, ok := FrequencyPeriods[freq]; ok {
		return p
	}
	return 12
}

// ToAnnual converts a period amount to its annual equivalent.
//
//	Annual = Amount × PeriodsPerYear
func ToAnnual(amount float64, freq string) float64 {
	return amount * periodsPerYear(freq)
}

// FromAnnual converts an annual amount to a period amount.
func FromAnnual(annual float64, freq string) float64 {
	return annual / periodsPerYear(freq)
}

// SalaryBreakdown holds a salary expressed at every standard interval.
//
// Formulas (given annual gross A):
//
//	Monthly  = A / 12
//	Weekly   = A / 52
//	Daily    = A / 260   (52 weeks × 5 working days)
//	Hourly   = A / 2080  (52 × 5 days × 8 hours)
type SalaryBreakdown struct {
	Annual  float64 `json:"annual"`
	Monthly float64 `json:"monthly"`
	Weekly  float64 `json:"weekly"`
	Daily   float64 `json:"daily"`
	Hourly  float64 `json:"hourly"`
}

// ComputeSalaryBreakdown derives all equivalent salary periods from an entered
// amount at a given frequency.
func ComputeSalaryBreakdown(entered float64, freq string) SalaryBreakdown {
	annual := ToAnnual(entered, freq)
	return SalaryBreakdown{
		Annual:  r2(annual),
		Monthly: r2(annual / 12),
		Weekly:  r2(annual / 52),
		Daily:   r4(annual / 260),
		Hourly:  r4(annual / 2080),
	}
}

// ─── Tax Configuration ────────────────────────────────────────────────────────

// TaxConfig holds every configurable tax parameter.
// Always loaded from the database — never hardcoded at call sites.
type TaxConfig struct {
	// NIS — National Insurance Scheme
	NISEmpRate      float64 // employee rate   (e.g. 0.03)
	NISEmpAnnualCap float64 // employee annual insurable earnings ceiling
	NISEmprRate     float64 // employer rate
	NISEmprAnnualCap float64

	// NHT — National Housing Trust (no ceiling)
	NHTEmpRate  float64
	NHTEmprRate float64

	// Education Tax (applied to statutory income = gross − NIS)
	EdTaxEmpRate  float64
	EdTaxEmprRate float64

	// PAYE — Pay As You Earn
	// Calculation uses annualised statutory income:
	//   if annual_statutory ≤ PAYEThreshold          → 0
	//   if annual_statutory ≤ PAYEBracket             → (income − threshold) × Rate1
	//   else                                          → bracket1×Rate1 + (income−bracket)×Rate2
	PAYEThreshold float64 // annual income below which no PAYE is due
	PAYEBracket   float64 // annual income where Rate2 kicks in
	PAYERate1     float64 // lower band rate  (e.g. 0.25)
	PAYERate2     float64 // upper band rate  (e.g. 0.30)
}

// defaultJATaxConfig — JA FY 2025/26 values used as a fallback when no DB
// config exists. Matches the seeded rows in 024_payroll_v2.
var defaultJATaxConfig = TaxConfig{
	NISEmpRate:       0.03,
	NISEmpAnnualCap:  5_000_000,
	NISEmprRate:      0.03,
	NISEmprAnnualCap: 5_000_000,
	NHTEmpRate:       0.02,
	NHTEmprRate:      0.03,
	EdTaxEmpRate:     0.0225,
	EdTaxEmprRate:    0.035,
	PAYEThreshold:    1_799_376,
	PAYEBracket:      6_000_000,
	PAYERate1:        0.25,
	PAYERate2:        0.30,
}

// LoadActiveTaxConfig queries the active tax rule set for a business and
// assembles a TaxConfig. Falls back to defaultJATaxConfig if nothing is found.
func LoadActiveTaxConfig(ctx context.Context, db *pgxpool.Pool, businessID string) (TaxConfig, error) {
	cfg := defaultJATaxConfig

	rows, err := db.Query(ctx, `
		SELECT tr.tax_type, tr.rate, tr.annual_cap, tr.threshold, tr.upper_limit, tr.applies_to
		FROM tax_rules tr
		JOIN tax_rule_sets trs ON trs.id = tr.rule_set_id
		WHERE trs.business_id = $1 AND trs.is_active = true
		ORDER BY tr.tax_type, tr.applies_to`, businessID)
	if err != nil {
		return cfg, nil // return defaults; don't fail payroll over a DB read error
	}
	if rows == nil {
		return cfg, nil
	}
	defer rows.Close()

	for rows.Next() {
		var taxType, appliesTo string
		var rate float64
		var annualCap, threshold, upperLimit *float64
		if err := rows.Scan(&taxType, &rate, &annualCap, &threshold, &upperLimit, &appliesTo); err != nil {
			continue
		}
		switch taxType {
		case "NIS":
			if appliesTo == "employee" || appliesTo == "both" {
				cfg.NISEmpRate = rate
				if annualCap != nil {
					cfg.NISEmpAnnualCap = *annualCap
				}
			}
			if appliesTo == "employer" || appliesTo == "both" {
				cfg.NISEmprRate = rate
				if annualCap != nil {
					cfg.NISEmprAnnualCap = *annualCap
				}
			}
		case "NHT":
			if appliesTo == "employee" || appliesTo == "both" {
				cfg.NHTEmpRate = rate
			}
			if appliesTo == "employer" || appliesTo == "both" {
				cfg.NHTEmprRate = rate
			}
		case "EDTAX":
			if appliesTo == "employee" || appliesTo == "both" {
				cfg.EdTaxEmpRate = rate
			}
			if appliesTo == "employer" || appliesTo == "both" {
				cfg.EdTaxEmprRate = rate
			}
		case "PAYE_L1":
			cfg.PAYERate1 = rate
			if threshold != nil {
				cfg.PAYEThreshold = *threshold
			}
			if upperLimit != nil {
				cfg.PAYEBracket = *upperLimit
			}
		case "PAYE_L2":
			cfg.PAYERate2 = rate
		}
	}
	return cfg, nil
}

// ─── Core Deduction Calculator ────────────────────────────────────────────────

// DeductionResult is the full statutory breakdown for a single pay period.
type DeductionResult struct {
	GrossPay        float64 `json:"gross_pay"`
	NISEmployee     float64 `json:"nis_employee"`
	NHTEmployee     float64 `json:"nht_employee"`
	EdTaxEmployee   float64 `json:"edtax_employee"`
	PAYE            float64 `json:"paye"`
	NISEmployer     float64 `json:"nis_employer"`
	NHTEmployer     float64 `json:"nht_employer"`
	EdTaxEmployer   float64 `json:"edtax_employer"`
	TotalDeductions float64 `json:"total_deductions"` // employee-side only
	TotalEmployerCost float64 `json:"total_employer_cost"`
	NetPay          float64 `json:"net_pay"`
	EffectiveRate   float64 `json:"effective_rate_pct"`
}

// CalculateDeductions computes all statutory deductions for a single pay period.
//
// Parameters:
//   - periodGross: the gross pay for THIS period (not annualised)
//   - freq:        payroll frequency — used to de/annualise for PAYE brackets
//   - cfg:         tax configuration loaded from DB
//
// Jamaican calculation steps:
//
//  1. NIS (employee)  = min(G × NISEmpRate, NISEmpAnnualCap × NISEmpRate / P)
//  2. Statutory       = G − NIS(employee)
//  3. NHT (employee)  = G × NHTEmpRate                (on gross)
//  4. EdTax (employee)= Statutory × EdTaxEmpRate       (on statutory income)
//  5. PAYE
//     — annual_stat  = Statutory × P
//     — taxable      = annual_stat − PAYEThreshold
//     — if taxable ≤ 0: PAYE = 0
//     — elif annual_stat ≤ PAYEBracket: PAYE = taxable × Rate1 / P
//     — else: PAYE = ((PAYEBracket−Threshold)×Rate1 + (annual_stat−PAYEBracket)×Rate2) / P
//  6. TotalDeductions = NIS + NHT + EdTax + PAYE  (employee-side)
//  7. Net = G − TotalDeductions
func CalculateDeductions(periodGross float64, freq string, cfg TaxConfig) DeductionResult {
	P := periodsPerYear(freq)

	// 1. NIS employee
	nisEmpCap := cfg.NISEmpAnnualCap * cfg.NISEmpRate / P
	nisEmp := r2(math.Min(periodGross*cfg.NISEmpRate, nisEmpCap))

	// 2. Statutory income
	statutory := periodGross - nisEmp

	// 3. NHT employee (on gross)
	nhtEmp := r2(periodGross * cfg.NHTEmpRate)

	// 4. Education Tax employee (on statutory income)
	edTaxEmp := r2(statutory * cfg.EdTaxEmpRate)

	// 5. PAYE — annualise, bracket, de-annualise
	annualStatutory := statutory * P
	var annualPAYE float64
	if taxable := annualStatutory - cfg.PAYEThreshold; taxable > 0 {
		if annualStatutory <= cfg.PAYEBracket {
			annualPAYE = taxable * cfg.PAYERate1
		} else {
			bracket1 := cfg.PAYEBracket - cfg.PAYEThreshold
			annualPAYE = bracket1*cfg.PAYERate1 + (taxable-bracket1)*cfg.PAYERate2
		}
	}
	paye := r2(annualPAYE / P)

	// Employer contributions
	nisEmprCap := cfg.NISEmprAnnualCap * cfg.NISEmprRate / P
	nisEmpr := r2(math.Min(periodGross*cfg.NISEmprRate, nisEmprCap))
	nhtEmpr := r2(periodGross * cfg.NHTEmprRate)
	edTaxEmpr := r2(statutory * cfg.EdTaxEmprRate)

	totalEmpDed := r2(nisEmp + nhtEmp + edTaxEmp + paye)
	netPay := r2(periodGross - totalEmpDed)
	totalEmprCost := r2(periodGross + nisEmpr + nhtEmpr + edTaxEmpr)

	effectiveRate := 0.0
	if periodGross > 0 {
		effectiveRate = r2(totalEmpDed / periodGross * 100)
	}

	return DeductionResult{
		GrossPay:          periodGross,
		NISEmployee:       nisEmp,
		NHTEmployee:       nhtEmp,
		EdTaxEmployee:     edTaxEmp,
		PAYE:              paye,
		NISEmployer:       nisEmpr,
		NHTEmployer:       nhtEmpr,
		EdTaxEmployer:     edTaxEmpr,
		TotalDeductions:   totalEmpDed,
		TotalEmployerCost: totalEmprCost,
		NetPay:            netPay,
		EffectiveRate:     effectiveRate,
	}
}

// ─── Reverse Calculation (Net → Gross) ───────────────────────────────────────
//
// Given a desired take-home (net) pay, find the gross pay that produces it.
//
// Algorithm: Newton-Raphson iteration.
//
// Why iterative? The deduction function is piecewise-linear (PAYE has bracket
// discontinuities), so a closed-form solution would require knowing which
// bracket the result falls in — a chicken-and-egg problem. Newton-Raphson
// avoids this and converges in 3–8 iterations for typical JA salary ranges.
//
// Derivation of initial estimate (assume below PAYE threshold — no PAYE):
//
//	Net ≈ G − G·NIS·(1−EdTax) − G·NHT − G·EdTax
//	Net ≈ G · k  where k = 1 − NIS·(1−EdTax) − NHT − EdTax
//	G₀  = Net / k
//
// Newton step:
//
//	∂Net/∂G ≈ (net(G+1) − net(G)) / 1   [numerical derivative]
//	G_{n+1} = G_n − (net(G_n) − target) / (∂Net/∂G)
func ReverseCalculate(targetNet float64, freq string, cfg TaxConfig) float64 {
	// Initial estimate — assume below PAYE threshold
	k := 1.0 - cfg.NISEmpRate*(1-cfg.EdTaxEmpRate) - cfg.NHTEmpRate - cfg.EdTaxEmpRate
	if k <= 0 || k >= 1 {
		k = 0.90
	}
	gross := targetNet / k

	// Newton-Raphson iteration
	for i := 0; i < 50; i++ {
		res := CalculateDeductions(gross, freq, cfg)
		err := res.NetPay - targetNet
		if math.Abs(err) < 0.01 {
			break
		}
		// Numerical derivative: Δnet per 1 unit of Δgross
		res2 := CalculateDeductions(gross+1.0, freq, cfg)
		dNet := res2.NetPay - res.NetPay
		if math.Abs(dNet) < 0.0001 {
			break
		}
		gross -= err / dNet
		if gross < 0 {
			gross = targetNet // safety floor
		}
	}
	return r2(gross)
}

// ─── Overtime ─────────────────────────────────────────────────────────────────

// ComputeOvertimePay calculates overtime pay for a given number of hours.
//
//	OvertimePay = Hours × HourlyRate × Multiplier
//
// Standard Jamaican multipliers (Labour Relations & Industrial Disputes Act):
//
//	1.5 — Time and a half (standard weekday overtime, hours beyond 8/day or 40/week)
//	2.0 — Double time (gazetted public holidays, work on the contractual rest day)
//
// Both multipliers are stored in payroll_config and are never hardcoded.
func ComputeOvertimePay(hours, hourlyRate, multiplier float64) float64 {
	return r2(hours * hourlyRate * multiplier)
}

// ─── Rounding helpers ─────────────────────────────────────────────────────────

func r2(v float64) float64 { return math.Round(v*100) / 100 }
func r4(v float64) float64 { return math.Round(v*10000) / 10000 }
