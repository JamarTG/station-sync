package handlers

// ═══════════════════════════════════════════════════════════════════════════════
// Jamaican Holiday Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Centralised, pure-function engine that resolves Jamaican public holidays for
// any given year — including the Easter-derived variable holidays — and computes
// configurable premium pay.
//
// Variable holidays are derived from Easter Sunday via the Gregorian Computus
// (Anonymous / Meeus-Jones-Butcher algorithm), so no dates are hardcoded:
//
//   Ash Wednesday  = Easter − 46 days
//   Good Friday    = Easter −  2 days
//   Easter Monday  = Easter +  1 day
//
// National Heroes Day is the third Monday of October (also rule-based).
//
// Fixed holidays use month_of/day_of. The "observed" rule shifts a holiday that
// falls on a Sunday to the following Monday (Jamaican statutory convention).

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"project-sync/internal/model"
)

// ─── Computus: Gregorian Easter Sunday ─────────────────────────────────────────

// easterSunday returns the date of Easter Sunday for the given year using the
// Meeus/Jones/Butcher algorithm (valid for all Gregorian years).
func easterSunday(year int) time.Time {
	a := year % 19
	b := year / 100
	c := year % 100
	d := b / 4
	e := b % 4
	f := (b + 8) / 25
	g := (b - f + 1) / 3
	h := (19*a + b - d - g + 15) % 30
	i := c / 4
	k := c % 4
	l := (32 + 2*e + 2*i - h - k) % 7
	m := (a + 11*h + 22*l) / 451
	month := (h + l - 7*m + 114) / 31
	day := ((h + l - 7*m + 114) % 31) + 1
	return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
}

// nthWeekdayOfMonth returns the date of the n-th given weekday in a month.
// e.g. nthWeekdayOfMonth(2025, October, Monday, 3) → 3rd Monday of Oct 2025.
func nthWeekdayOfMonth(year int, month time.Month, weekday time.Weekday, n int) time.Time {
	d := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	offset := (int(weekday) - int(d.Weekday()) + 7) % 7
	day := 1 + offset + (n-1)*7
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

// resolveRuleKeyDate returns the gazetted date for a known variable rule_key.
// Returns zero time if the rule_key is not a recognised variable holiday.
func resolveRuleKeyDate(ruleKey string, year int) time.Time {
	easter := easterSunday(year)
	switch ruleKey {
	case "ash_wednesday":
		return easter.AddDate(0, 0, -46)
	case "good_friday":
		return easter.AddDate(0, 0, -2)
	case "easter_monday":
		return easter.AddDate(0, 0, 1)
	case "heroes_day":
		// Third Monday of October
		return nthWeekdayOfMonth(year, time.October, time.Monday, 3)
	default:
		return time.Time{}
	}
}

// applyObservedRule shifts a date to its observed replacement if it falls on a
// weekend, per the holiday's observed_rule.
//
//   next_monday      — Sunday → Monday (Jamaican convention; Saturday stays)
//   nearest_weekday  — Saturday → Friday, Sunday → Monday
//   none             — no shift
func applyObservedRule(date time.Time, rule string) (observed time.Time, shifted bool) {
	switch rule {
	case "next_monday":
		if date.Weekday() == time.Sunday {
			return date.AddDate(0, 0, 1), true
		}
	case "nearest_weekday":
		switch date.Weekday() {
		case time.Saturday:
			return date.AddDate(0, 0, -1), true
		case time.Sunday:
			return date.AddDate(0, 0, 1), true
		}
	}
	return date, false
}

// ResolveHolidaysForYear materialises all active holidays for a business
// (national rows + that business's own rows) into concrete dates for `year`.
func ResolveHolidaysForYear(ctx context.Context, db *pgxpool.Pool, businessID string, year int) ([]model.ResolvedHoliday, error) {
	rows, err := db.Query(ctx, `
		SELECT name, holiday_type, category, COALESCE(rule_key,''),
		       month_of, day_of, holiday_date, observed_rule,
		       effective_date, expiry_date
		FROM holidays
		WHERE active = true
		  AND (business_id IS NULL OR business_id = $1)
		ORDER BY name`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var resolved []model.ResolvedHoliday
	for rows.Next() {
		var name, htype, category, ruleKey, observedRule string
		var monthOf, dayOf *int
		var explicitDate *time.Time
		var effectiveDate time.Time
		var expiryDate *time.Time
		if err := rows.Scan(&name, &htype, &category, &ruleKey,
			&monthOf, &dayOf, &explicitDate, &observedRule,
			&effectiveDate, &expiryDate); err != nil {
			continue
		}

		var date time.Time
		switch {
		case category == "declared" && explicitDate != nil:
			date = *explicitDate
		case category == "variable" && ruleKey != "":
			date = resolveRuleKeyDate(ruleKey, year)
		case monthOf != nil && dayOf != nil:
			date = time.Date(year, time.Month(*monthOf), *dayOf, 0, 0, 0, 0, time.UTC)
		default:
			continue
		}
		if date.IsZero() {
			continue
		}

		// Respect effective / expiry windows
		if date.Before(effectiveDate) {
			continue
		}
		if expiryDate != nil && date.After(*expiryDate) {
			continue
		}

		rh := model.ResolvedHoliday{
			Name:        name,
			Date:        date.Format("2006-01-02"),
			HolidayType: htype,
			Category:    category,
			RuleKey:     ruleKey,
			Weekday:     date.Weekday().String(),
			IsWeekend:   date.Weekday() == time.Saturday || date.Weekday() == time.Sunday,
		}
		if obs, shifted := applyObservedRule(date, observedRule); shifted {
			od := obs.Format("2006-01-02")
			rh.ObservedDate = &od
		}
		resolved = append(resolved, rh)
	}
	if resolved == nil {
		resolved = []model.ResolvedHoliday{}
	}
	return resolved, nil
}

// IsHoliday reports whether a given date is a holiday for a business, returning
// the holiday name and type. Checks both the gazetted date and observed date.
func IsHoliday(ctx context.Context, db *pgxpool.Pool, businessID string, date time.Time) (bool, string, string) {
	year := date.Year()
	resolved, err := ResolveHolidaysForYear(ctx, db, businessID, year)
	if err != nil {
		return false, "", ""
	}
	target := date.Format("2006-01-02")
	for _, h := range resolved {
		if h.Date == target {
			return true, h.Name, h.HolidayType
		}
		if h.ObservedDate != nil && *h.ObservedDate == target {
			return true, h.Name + " (Observed)", "observed"
		}
	}
	return false, "", ""
}

// ═══════════════════════════════════════════════════════════════════════════════
// Premium Pay Engine
// ═══════════════════════════════════════════════════════════════════════════════

// CalculateHolidayPay computes the full premium-pay breakdown for an employee
// working a holiday.
//
//   Regular Pay      = regularHours × H                       (base, unchanged)
//   Holiday Premium  = regularHours × H × (mult − 1)          (the extra)
//   Holiday Overtime = otHours × H × otMult                   (full OT premium)
//   Night Premium    = nightHours × H × (nightMult − mult)    (extra over day-holiday rate)
//   Holiday Total    = Regular Pay + Holiday Premium + Holiday Overtime + Night Premium
//
// On a contractual rest day the rest_day_multiplier replaces regular_multiplier.
func CalculateHolidayPay(
	holidayName, holidayDate string,
	baseHourly, regularHours, otHours, nightHours float64,
	isRestDay bool,
	rules model.HolidayPayRules,
) model.HolidayPayResult {

	mult := rules.RegularMultiplier
	if isRestDay {
		mult = rules.RestDayMultiplier
	}

	regularPay := r2(regularHours * baseHourly)
	holidayPremium := r2(regularHours * baseHourly * (mult - 1))
	holidayOT := r2(otHours * baseHourly * rules.OvertimeMultiplier)

	// Night premium = extra above the daytime holiday multiplier
	nightExtra := rules.NightShiftMultiplier - mult
	if nightExtra < 0 {
		nightExtra = 0
	}
	nightPremium := r2(nightHours * baseHourly * nightExtra)

	total := r2(regularPay + holidayPremium + holidayOT + nightPremium)

	return model.HolidayPayResult{
		HolidayName:     holidayName,
		HolidayDate:     holidayDate,
		BaseHourlyRate:  baseHourly,
		RegularHours:    regularHours,
		OvertimeHours:   otHours,
		NightHours:      nightHours,
		IsRestDay:       isRestDay,
		RegularPay:      regularPay,
		HolidayPremium:  holidayPremium,
		HolidayOvertime: holidayOT,
		NightPremium:    nightPremium,
		HolidayTotal:    total,
		MultiplierUsed:  mult,
	}
}

// CalculateAbsentHolidayPay computes pay for an employee who does NOT work the
// holiday, per company policy.
//
//   paid     → full standard day pay  (standardDayPay)
//   unpaid   → 0
//   partial  → standardDayPay × absent_partial_pct / 100
func CalculateAbsentHolidayPay(standardDayPay float64, rules model.HolidayPayRules) float64 {
	switch rules.AbsentPolicy {
	case "paid":
		return r2(standardDayPay)
	case "partial":
		return r2(standardDayPay * rules.AbsentPartialPct / 100)
	default: // unpaid
		return 0
	}
}

// LoadHolidayPayRules loads a business's premium pay rules, falling back to
// sensible Jamaican defaults if none are configured.
func LoadHolidayPayRules(ctx context.Context, db *pgxpool.Pool, businessID string) model.HolidayPayRules {
	rules := model.HolidayPayRules{
		BusinessID:           businessID,
		RegularMultiplier:    2.0,
		OvertimeMultiplier:   2.5,
		RestDayMultiplier:    2.5,
		NightShiftMultiplier: 2.25,
		AbsentPolicy:         "paid",
		AbsentPartialPct:     50,
		NightShiftStart:      22,
		NightShiftEnd:        5,
	}
	db.QueryRow(ctx, `
		SELECT regular_multiplier, overtime_multiplier, rest_day_multiplier,
		       night_shift_multiplier, absent_policy, absent_partial_pct,
		       night_shift_start, night_shift_end
		FROM holiday_pay_rules WHERE business_id = $1`, businessID,
	).Scan(&rules.RegularMultiplier, &rules.OvertimeMultiplier, &rules.RestDayMultiplier,
		&rules.NightShiftMultiplier, &rules.AbsentPolicy, &rules.AbsentPartialPct,
		&rules.NightShiftStart, &rules.NightShiftEnd)
	return rules
}

// ─── AI Insight generator ───────────────────────────────────────────────────────

// generateHolidayHeadline builds a human-readable insight line.
// (Rule-based; can be swapped for an LLM call later.)
func generateHolidayHeadline(template string, args ...interface{}) string {
	return fmt.Sprintf(template, args...)
}
