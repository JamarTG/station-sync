package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return pool, nil
}

// EnsureSchema applies any missing column/table migrations idempotently so the
// server starts correctly regardless of which SQL migration files have been run.
func EnsureSchema(ctx context.Context, pool *pgxpool.Pool) error {
	stmts := []string{
		// 003_branches
		`CREATE TABLE IF NOT EXISTS branches (
			id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			name        TEXT NOT NULL,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (business_id, name)
		)`,
		`ALTER TABLE users    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL`,
		`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL`,
		`ALTER TABLE pumps    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE`,
		`ALTER TABLE shifts   ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE`,

		// 007_must_change_password
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`,

		// 012_user_pay_sick_days
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_rate NUMERIC(10, 2)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_type TEXT CHECK (pay_type IN ('Hourly', 'Salary'))`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS sick_days INT`,

		// 006_payroll
		`CREATE TABLE IF NOT EXISTS payroll_periods (
			id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			start_date DATE NOT NULL,
			end_date   DATE NOT NULL,
			status     TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published')),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id)`,
		`CREATE TABLE IF NOT EXISTS payroll_records (
			id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			period_id    UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
			user_id      UUID NOT NULL REFERENCES users(id),
			gross_pay    NUMERIC(10, 2) NOT NULL,
			nis          NUMERIC(10, 2) NOT NULL,
			nht          NUMERIC(10, 2) NOT NULL,
			ed_tax       NUMERIC(10, 2) NOT NULL,
			paye         NUMERIC(10, 2) NOT NULL,
			net_pay      NUMERIC(10, 2) NOT NULL,
			hours_worked NUMERIC(8, 2),
			overage      NUMERIC(10, 2) NOT NULL DEFAULT 0,
			shortage     NUMERIC(10, 2) NOT NULL DEFAULT 0,
			created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (period_id, user_id)
		)`,

		// 013_cstore_products_orders
		`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS shift_type TEXT NOT NULL DEFAULT 'service_station'
		  CHECK (shift_type IN ('service_station', 'convenience_store'))`,
		`CREATE TABLE IF NOT EXISTS products (
			id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id UUID    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			branch_id   UUID    REFERENCES branches(id) ON DELETE SET NULL,
			name        TEXT    NOT NULL,
			category    TEXT,
			sku         TEXT,
			price       NUMERIC(10,2) NOT NULL DEFAULT 0,
			cost        NUMERIC(10,2),
			stock_qty   INT     NOT NULL DEFAULT 0,
			unit        TEXT    NOT NULL DEFAULT 'each',
			active      BOOLEAN NOT NULL DEFAULT true,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`DO $$ BEGIN
			ALTER TABLE products ADD CONSTRAINT products_business_sku_unique UNIQUE (business_id, sku);
		EXCEPTION WHEN duplicate_table THEN NULL; END $$`,
		`CREATE TABLE IF NOT EXISTS orders (
			id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			branch_id      UUID REFERENCES branches(id) ON DELETE SET NULL,
			shift_id       UUID REFERENCES shifts(id) ON DELETE SET NULL,
			cashier_id     UUID REFERENCES users(id) ON DELETE SET NULL,
			cashier_name   TEXT NOT NULL DEFAULT '',
			order_no       BIGSERIAL,
			status         TEXT NOT NULL DEFAULT 'open'
			                 CHECK (status IN ('open', 'paid', 'voided')),
			payment_method TEXT,
			subtotal       NUMERIC(10,2) NOT NULL DEFAULT 0,
			tax            NUMERIC(10,2) NOT NULL DEFAULT 0,
			total          NUMERIC(10,2) NOT NULL DEFAULT 0,
			note           TEXT,
			created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS order_items (
			id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
			product_id UUID REFERENCES products(id) ON DELETE SET NULL,
			name       TEXT    NOT NULL,
			sku        TEXT,
			quantity   INT     NOT NULL DEFAULT 1,
			unit_price NUMERIC(10,2) NOT NULL,
			discount   NUMERIC(10,2) NOT NULL DEFAULT 0,
			total      NUMERIC(10,2) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,

		// 014_cstore_order_fields
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount      NUMERIC(10,2) NOT NULL DEFAULT 0`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_given  NUMERIC(10,2)`,
		`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount  NUMERIC(10,2) NOT NULL DEFAULT 0`,

		// 015_order_invoice_no
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_no TEXT`,

		// 016_order_item_refund
		`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refunded BOOLEAN NOT NULL DEFAULT false`,

		// 017_order_held_status + 019_order_credit_status
		`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check`,
		`ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('open', 'paid', 'voided', 'held', 'credit'))`,

		// 018_customers
		`CREATE TABLE IF NOT EXISTS customers (
			id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			user_id        UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
			name           TEXT NOT NULL,
			phone          TEXT,
			email          TEXT,
			credit_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
			status         TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
			created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		// backfill a customer account for every existing staff member
		`INSERT INTO customers (business_id, user_id, name, phone, email)
		 SELECT u.business_id, u.id, u.name, u.phone, u.email
		 FROM users u
		 WHERE u.business_id IS NOT NULL
		   AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.user_id = u.id)`,

		// time_off_requests table
		`CREATE TABLE IF NOT EXISTS time_off_requests (
			id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			user_name        TEXT NOT NULL,
			date             DATE NOT NULL,
			reason           TEXT,
			status           TEXT NOT NULL DEFAULT 'Pending'
			                   CHECK (status IN ('Pending', 'Approved', 'Rejected')),
			reviewed_by      UUID REFERENCES users(id),
			reviewed_by_name TEXT,
			reviewed_at      TIMESTAMPTZ,
			created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`DO $$ BEGIN
			ALTER TABLE time_off_requests ADD CONSTRAINT time_off_requests_user_date_unique UNIQUE (user_id, date);
		EXCEPTION WHEN duplicate_table THEN NULL; END $$`,

		// 020_user_overtime_rate
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC(10, 2)`,

		// 021_issues
		`CREATE TABLE IF NOT EXISTS issues (
			id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id   UUID        NOT NULL REFERENCES businesses(id),
			branch_id     UUID        REFERENCES branches(id),
			reporter_id   UUID        REFERENCES users(id),
			reporter_name TEXT        NOT NULL,
			category      TEXT        NOT NULL,
			description   TEXT        NOT NULL,
			status        TEXT        NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
			created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,

		// 022_sps — Supervisor Performance Score tables
		`CREATE TABLE IF NOT EXISTS supervisor_shift_scores (
			id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			shift_id               UUID        NOT NULL UNIQUE REFERENCES shifts(id) ON DELETE CASCADE,
			supervisor_id          UUID        NOT NULL REFERENCES users(id),
			branch_id              UUID        REFERENCES branches(id),
			business_id            UUID        NOT NULL REFERENCES businesses(id),
			score_sales            NUMERIC(5,2) NOT NULL DEFAULT 0,
			score_cash_variance    NUMERIC(5,2) NOT NULL DEFAULT 0,
			score_fuel_variance    NUMERIC(5,2) NOT NULL DEFAULT 0,
			score_attendance       NUMERIC(5,2) NOT NULL DEFAULT 0,
			score_team             NUMERIC(5,2) NOT NULL DEFAULT 0,
			score_task_completion  NUMERIC(5,2) NOT NULL DEFAULT 0,
			score_inventory        NUMERIC(5,2) NOT NULL DEFAULT 0,
			score_incident         NUMERIC(5,2) NOT NULL DEFAULT 0,
			score_safety           NUMERIC(5,2) NOT NULL DEFAULT 0,
			score_customer_service NUMERIC(5,2) NOT NULL DEFAULT 0,
			total_penalties        NUMERIC(5,2) NOT NULL DEFAULT 0,
			total_bonuses          NUMERIC(5,2) NOT NULL DEFAULT 0,
			sps_shift_raw          NUMERIC(5,2) NOT NULL DEFAULT 0,
			sps_shift_final        NUMERIC(5,2) NOT NULL DEFAULT 0,
			sales_efficiency_ratio NUMERIC(6,4),
			fuel_variance_pct      NUMERIC(6,4),
			attendant_count        INT          NOT NULL DEFAULT 0,
			incident_count         INT          NOT NULL DEFAULT 0,
			bonus_breakdown        JSONB        NOT NULL DEFAULT '[]',
			penalty_breakdown      JSONB        NOT NULL DEFAULT '[]',
			scored_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sss_supervisor ON supervisor_shift_scores(supervisor_id, scored_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_sss_business   ON supervisor_shift_scores(business_id, scored_at DESC)`,

		`CREATE TABLE IF NOT EXISTS supervisor_lifetime_stats (
			supervisor_id            UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			business_id              UUID        NOT NULL REFERENCES businesses(id),
			total_shifts             INT         NOT NULL DEFAULT 0,
			confidence_weight        NUMERIC(5,4) NOT NULL DEFAULT 0,
			sps_raw_ewma             NUMERIC(5,2) NOT NULL DEFAULT 0,
			sps_lifetime_final       NUMERIC(5,2) NOT NULL DEFAULT 0,
			sps_peak                 NUMERIC(5,2) NOT NULL DEFAULT 0,
			current_tier             TEXT        NOT NULL DEFAULT 'Bronze',
			current_perfect_streak   INT         NOT NULL DEFAULT 0,
			best_perfect_streak      INT         NOT NULL DEFAULT 0,
			total_revenue_managed    NUMERIC(14,2) NOT NULL DEFAULT 0,
			total_fuel_volume_litres NUMERIC(14,2) NOT NULL DEFAULT 0,
			last_computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sls_business ON supervisor_lifetime_stats(business_id, sps_lifetime_final DESC)`,

		// 023_fuel_intelligence — Fuel Performance & Inventory Intelligence
		`ALTER TABLE fuel_receivals ADD COLUMN IF NOT EXISTS supplier_name TEXT`,
		`ALTER TABLE tanks ADD COLUMN IF NOT EXISTS low_level_threshold  NUMERIC(10,2)`,
		`ALTER TABLE tanks ADD COLUMN IF NOT EXISTS reorder_threshold     NUMERIC(10,2)`,
		`ALTER TABLE tanks ADD COLUMN IF NOT EXISTS lead_time_days        NUMERIC(5,2)  NOT NULL DEFAULT 3`,
		`ALTER TABLE tanks ADD COLUMN IF NOT EXISTS safety_stock_litres   NUMERIC(10,2)`,

		`CREATE TABLE IF NOT EXISTS fuel_alerts (
			id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id   UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			branch_id     UUID        REFERENCES branches(id) ON DELETE CASCADE,
			tank_id       UUID        REFERENCES tanks(id)    ON DELETE SET NULL,
			shift_id      UUID        REFERENCES shifts(id)   ON DELETE SET NULL,
			alert_type    TEXT        NOT NULL,
			severity      TEXT        NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
			title         TEXT        NOT NULL,
			message       TEXT        NOT NULL,
			value         NUMERIC(14,4),
			threshold     NUMERIC(14,4),
			resolved      BOOLEAN     NOT NULL DEFAULT false,
			resolved_at   TIMESTAMPTZ,
			created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_fuel_alerts_biz     ON fuel_alerts(business_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_fuel_alerts_unresolved ON fuel_alerts(business_id, resolved, created_at DESC)`,

		// 024_payroll_v2 — DB-driven tax engine, compensation, runs, audit log
		`CREATE TABLE IF NOT EXISTS payroll_config (
			id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id UUID        NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
			frequency   TEXT        NOT NULL DEFAULT 'Monthly'
			              CHECK (frequency IN ('Weekly','BiWeekly','Fortnightly','SemiMonthly','Monthly')),
			pay_day     INT,
			currency    TEXT        NOT NULL DEFAULT 'JMD',
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS tax_rule_sets (
			id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id    UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			name           TEXT        NOT NULL,
			effective_from DATE        NOT NULL,
			effective_to   DATE,
			is_active      BOOLEAN     NOT NULL DEFAULT false,
			created_by     UUID        REFERENCES users(id),
			created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_trs_one_active ON tax_rule_sets(business_id) WHERE is_active = true`,

		`CREATE TABLE IF NOT EXISTS tax_rules (
			id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			rule_set_id UUID        NOT NULL REFERENCES tax_rule_sets(id) ON DELETE CASCADE,
			tax_type    TEXT        NOT NULL
			              CHECK (tax_type IN ('NIS','NHT','EDTAX','PAYE_L1','PAYE_L2')),
			rate        NUMERIC(10,6) NOT NULL,
			threshold   NUMERIC(14,2),
			upper_limit NUMERIC(14,2),
			annual_cap  NUMERIC(14,2),
			basis       TEXT        NOT NULL DEFAULT 'gross'
			              CHECK (basis IN ('gross','statutory','taxable')),
			applies_to  TEXT        NOT NULL DEFAULT 'employee'
			              CHECK (applies_to IN ('employee','employer','both')),
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(rule_set_id, tax_type, applies_to)
		)`,

		`CREATE TABLE IF NOT EXISTS employee_compensation (
			id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id    UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			effective_from DATE        NOT NULL,
			effective_to   DATE,
			frequency      TEXT        NOT NULL DEFAULT 'Monthly'
			                 CHECK (frequency IN ('Weekly','BiWeekly','Fortnightly','SemiMonthly','Monthly')),
			pay_type       TEXT        NOT NULL DEFAULT 'Salary'
			                 CHECK (pay_type IN ('Salary','Hourly')),
			entered_amount NUMERIC(14,2) NOT NULL,
			is_after_tax   BOOLEAN     NOT NULL DEFAULT false,
			annual_gross   NUMERIC(14,2) NOT NULL,
			monthly_gross  NUMERIC(14,2) NOT NULL,
			weekly_gross   NUMERIC(14,2) NOT NULL,
			daily_rate     NUMERIC(14,4) NOT NULL,
			hourly_rate    NUMERIC(14,4) NOT NULL,
			notes          TEXT,
			created_by     UUID        REFERENCES users(id),
			created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_emp_comp_user ON employee_compensation(user_id, effective_from DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_emp_comp_biz  ON employee_compensation(business_id)`,

		`CREATE TABLE IF NOT EXISTS payroll_runs (
			id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id     UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			period_id       UUID        REFERENCES payroll_periods(id),
			tax_rule_set_id UUID        REFERENCES tax_rule_sets(id),
			label           TEXT        NOT NULL DEFAULT '',
			frequency       TEXT        NOT NULL DEFAULT 'Monthly',
			status          TEXT        NOT NULL DEFAULT 'Draft'
			                  CHECK (status IN ('Draft','Calculated','Approved','Locked','Paid','Cancelled')),
			total_gross      NUMERIC(14,2) NOT NULL DEFAULT 0,
			total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
			total_net        NUMERIC(14,2) NOT NULL DEFAULT 0,
			total_employer_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
			employee_count   INT         NOT NULL DEFAULT 0,
			notes            TEXT,
			approved_by      UUID        REFERENCES users(id),
			approved_at      TIMESTAMPTZ,
			locked_by        UUID        REFERENCES users(id),
			locked_at        TIMESTAMPTZ,
			created_by       UUID        REFERENCES users(id),
			created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_pr_biz ON payroll_runs(business_id, created_at DESC)`,

		`CREATE TABLE IF NOT EXISTS payroll_run_lines (
			id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			run_id           UUID        NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
			user_id          UUID        NOT NULL REFERENCES users(id),
			user_name        TEXT        NOT NULL DEFAULT '',
			compensation_id  UUID        REFERENCES employee_compensation(id),
			base_gross       NUMERIC(14,2) NOT NULL DEFAULT 0,
			overtime_hours   NUMERIC(8,2)  NOT NULL DEFAULT 0,
			overtime_pay     NUMERIC(14,2) NOT NULL DEFAULT 0,
			bonus            NUMERIC(14,2) NOT NULL DEFAULT 0,
			other_earnings   NUMERIC(14,2) NOT NULL DEFAULT 0,
			total_gross      NUMERIC(14,2) NOT NULL DEFAULT 0,
			nis_employee     NUMERIC(14,2) NOT NULL DEFAULT 0,
			nht_employee     NUMERIC(14,2) NOT NULL DEFAULT 0,
			edtax_employee   NUMERIC(14,2) NOT NULL DEFAULT 0,
			paye             NUMERIC(14,2) NOT NULL DEFAULT 0,
			nis_employer     NUMERIC(14,2) NOT NULL DEFAULT 0,
			nht_employer     NUMERIC(14,2) NOT NULL DEFAULT 0,
			edtax_employer   NUMERIC(14,2) NOT NULL DEFAULT 0,
			other_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
			total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
			net_pay          NUMERIC(14,2) NOT NULL DEFAULT 0,
			employer_cost    NUMERIC(14,2) NOT NULL DEFAULT 0,
			is_overridden    BOOLEAN     NOT NULL DEFAULT false,
			override_reason  TEXT,
			created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(run_id, user_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_prl_run  ON payroll_run_lines(run_id)`,
		`CREATE INDEX IF NOT EXISTS idx_prl_user ON payroll_run_lines(user_id)`,

		`CREATE TABLE IF NOT EXISTS payroll_audit_log (
			id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			entity_type TEXT        NOT NULL,
			entity_id   TEXT        NOT NULL,
			action      TEXT        NOT NULL,
			actor_id    UUID        REFERENCES users(id),
			actor_name  TEXT        NOT NULL DEFAULT '',
			before_val  JSONB,
			after_val   JSONB,
			reason      TEXT,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_pal_biz    ON payroll_audit_log(business_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_pal_entity ON payroll_audit_log(entity_type, entity_id)`,

		// 025_payroll_overtime — configurable overtime multipliers
		`ALTER TABLE payroll_config ADD COLUMN IF NOT EXISTS overtime_multiplier     NUMERIC(5,2) NOT NULL DEFAULT 1.50`,
		`ALTER TABLE payroll_config ADD COLUMN IF NOT EXISTS double_time_multiplier  NUMERIC(5,2) NOT NULL DEFAULT 2.00`,

		// 026_cps_aps — Cashier Performance Score + Attendant Performance Score
		//
		// CPS categories (100 pts): Cash Accuracy 25 | Transaction Quality 20 |
		//   Sales Effectiveness 20 | Attendance 15 | Customer Service 10 |
		//   Compliance 5 | Team 5
		//
		// APS categories (100 pts): Fuel Accountability 25 | Forecourt Ops 20 |
		//   Productivity 20 | Attendance 15 | Customer Service 10 |
		//   Safety 7 | Team 3

		`CREATE TABLE IF NOT EXISTS cashier_shift_scores (
			id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			shift_id                  UUID         NOT NULL UNIQUE REFERENCES shifts(id) ON DELETE CASCADE,
			cashier_id                UUID         NOT NULL REFERENCES users(id),
			business_id               UUID         NOT NULL REFERENCES businesses(id),
			branch_id                 UUID         REFERENCES branches(id),

			-- Component scores
			score_cash_accuracy       NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 25 pts max
			score_transaction_quality NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 20 pts max
			score_sales_effectiveness NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 20 pts max
			score_attendance          NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 15 pts max
			score_customer_service    NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 10 pts max
			score_compliance          NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 5 pts max
			score_team                NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 5 pts max

			total_bonuses             NUMERIC(5,2) NOT NULL DEFAULT 0,
			total_penalties           NUMERIC(5,2) NOT NULL DEFAULT 0,
			bonus_breakdown           JSONB        NOT NULL DEFAULT '[]',
			penalty_breakdown         JSONB        NOT NULL DEFAULT '[]',
			cps_shift_raw             NUMERIC(5,2) NOT NULL DEFAULT 0,
			cps_shift_final           NUMERIC(5,2) NOT NULL DEFAULT 0,

			-- Supporting metrics (for analytics & audit)
			cash_variance_amt         NUMERIC(14,2),
			cash_variance_pct         NUMERIC(8,4),
			total_transactions        INT          NOT NULL DEFAULT 0,
			void_count                INT          NOT NULL DEFAULT 0,
			refund_count              INT          NOT NULL DEFAULT 0,
			override_count            INT          NOT NULL DEFAULT 0,
			total_sales               NUMERIC(14,2) NOT NULL DEFAULT 0,
			sales_efficiency_ratio    NUMERIC(8,4),
			upsell_count              INT          NOT NULL DEFAULT 0,
			loyalty_signups           INT          NOT NULL DEFAULT 0,

			scored_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_css_cashier  ON cashier_shift_scores(cashier_id, scored_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_css_business ON cashier_shift_scores(business_id, scored_at DESC)`,

		`CREATE TABLE IF NOT EXISTS cashier_lifetime_stats (
			cashier_id                UUID         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			business_id               UUID         NOT NULL REFERENCES businesses(id),
			total_shifts              INT          NOT NULL DEFAULT 0,
			confidence_weight         NUMERIC(5,4) NOT NULL DEFAULT 0,
			cps_raw_ewma              NUMERIC(5,2) NOT NULL DEFAULT 0,
			cps_lifetime_final        NUMERIC(5,2) NOT NULL DEFAULT 0,
			cps_peak                  NUMERIC(5,2) NOT NULL DEFAULT 0,
			current_tier              TEXT         NOT NULL DEFAULT 'Bronze',
			current_perfect_streak    INT          NOT NULL DEFAULT 0,
			best_perfect_streak       INT          NOT NULL DEFAULT 0,
			total_revenue_processed   NUMERIC(14,2) NOT NULL DEFAULT 0,
			last_computed_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_cls_business ON cashier_lifetime_stats(business_id, cps_lifetime_final DESC)`,

		`CREATE TABLE IF NOT EXISTS attendant_shift_scores (
			id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			shift_id                    UUID         NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
			attendant_id                UUID         NOT NULL REFERENCES users(id),
			business_id                 UUID         NOT NULL REFERENCES businesses(id),
			branch_id                   UUID         REFERENCES branches(id),

			-- Component scores
			score_fuel_accountability   NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 25 pts max
			score_forecourt_ops         NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 20 pts max
			score_productivity          NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 20 pts max
			score_attendance            NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 15 pts max
			score_customer_service      NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 10 pts max
			score_safety                NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 7 pts max
			score_team                  NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 3 pts max

			total_bonuses               NUMERIC(5,2) NOT NULL DEFAULT 0,
			total_penalties             NUMERIC(5,2) NOT NULL DEFAULT 0,
			bonus_breakdown             JSONB        NOT NULL DEFAULT '[]',
			penalty_breakdown           JSONB        NOT NULL DEFAULT '[]',
			aps_shift_raw               NUMERIC(5,2) NOT NULL DEFAULT 0,
			aps_shift_final             NUMERIC(5,2) NOT NULL DEFAULT 0,

			-- Supporting metrics
			fuel_variance_pct           NUMERIC(8,4),
			vehicles_served             INT          NOT NULL DEFAULT 0,
			fuel_volume_litres          NUMERIC(14,2) NOT NULL DEFAULT 0,
			productivity_ratio          NUMERIC(8,4),
			safety_checks_completed     INT          NOT NULL DEFAULT 0,
			safety_checks_required      INT          NOT NULL DEFAULT 0,
			hazard_reports              INT          NOT NULL DEFAULT 0,
			incident_count              INT          NOT NULL DEFAULT 0,

			scored_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			UNIQUE(shift_id, attendant_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_ass_attendant ON attendant_shift_scores(attendant_id, scored_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_ass_business  ON attendant_shift_scores(business_id, scored_at DESC)`,

		`CREATE TABLE IF NOT EXISTS attendant_lifetime_stats (
			attendant_id                UUID         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			business_id                 UUID         NOT NULL REFERENCES businesses(id),
			total_shifts                INT          NOT NULL DEFAULT 0,
			confidence_weight           NUMERIC(5,4) NOT NULL DEFAULT 0,
			aps_raw_ewma                NUMERIC(5,2) NOT NULL DEFAULT 0,
			aps_lifetime_final          NUMERIC(5,2) NOT NULL DEFAULT 0,
			aps_peak                    NUMERIC(5,2) NOT NULL DEFAULT 0,
			current_tier                TEXT         NOT NULL DEFAULT 'Bronze',
			current_perfect_streak      INT          NOT NULL DEFAULT 0,
			best_perfect_streak         INT          NOT NULL DEFAULT 0,
			total_fuel_dispensed_litres NUMERIC(14,2) NOT NULL DEFAULT 0,
			total_vehicles_served       INT          NOT NULL DEFAULT 0,
			last_computed_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_als_business ON attendant_lifetime_stats(business_id, aps_lifetime_final DESC)`,

		// Employee feedback — used by both CPS and Customer Service categories
		`CREATE TABLE IF NOT EXISTS employee_feedback (
			id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id   UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			shift_id      UUID        REFERENCES shifts(id) ON DELETE SET NULL,
			employee_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			submitted_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
			feedback_type TEXT        NOT NULL CHECK (feedback_type IN ('positive','negative','neutral','complaint','commendation')),
			source        TEXT        NOT NULL DEFAULT 'customer' CHECK (source IN ('customer','peer','supervisor','mystery_shopper')),
			score         INT         NOT NULL DEFAULT 3 CHECK (score BETWEEN 1 AND 5),
			notes         TEXT,
			resolved      BOOLEAN     NOT NULL DEFAULT false,
			created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_ef_employee ON employee_feedback(employee_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_ef_shift    ON employee_feedback(shift_id)`,

		// Seed default JA FY 2025/26 tax rules for every business that has none yet
		`INSERT INTO tax_rule_sets (business_id, name, effective_from, is_active)
		 SELECT id, 'JA FY 2025/26', '2025-04-01', true FROM businesses
		 WHERE NOT EXISTS (SELECT 1 FROM tax_rule_sets t WHERE t.business_id = businesses.id)`,

		`INSERT INTO tax_rules (rule_set_id, tax_type, rate, annual_cap, basis, applies_to)
		 SELECT trs.id,'NIS',0.030000,5000000,'gross','employee' FROM tax_rule_sets trs
		 WHERE NOT EXISTS (SELECT 1 FROM tax_rules t WHERE t.rule_set_id=trs.id AND t.tax_type='NIS' AND t.applies_to='employee')`,

		`INSERT INTO tax_rules (rule_set_id, tax_type, rate, annual_cap, basis, applies_to)
		 SELECT trs.id,'NIS',0.030000,5000000,'gross','employer' FROM tax_rule_sets trs
		 WHERE NOT EXISTS (SELECT 1 FROM tax_rules t WHERE t.rule_set_id=trs.id AND t.tax_type='NIS' AND t.applies_to='employer')`,

		`INSERT INTO tax_rules (rule_set_id, tax_type, rate, basis, applies_to)
		 SELECT trs.id,'NHT',0.020000,'gross','employee' FROM tax_rule_sets trs
		 WHERE NOT EXISTS (SELECT 1 FROM tax_rules t WHERE t.rule_set_id=trs.id AND t.tax_type='NHT' AND t.applies_to='employee')`,

		`INSERT INTO tax_rules (rule_set_id, tax_type, rate, basis, applies_to)
		 SELECT trs.id,'NHT',0.030000,'gross','employer' FROM tax_rule_sets trs
		 WHERE NOT EXISTS (SELECT 1 FROM tax_rules t WHERE t.rule_set_id=trs.id AND t.tax_type='NHT' AND t.applies_to='employer')`,

		`INSERT INTO tax_rules (rule_set_id, tax_type, rate, basis, applies_to)
		 SELECT trs.id,'EDTAX',0.022500,'statutory','employee' FROM tax_rule_sets trs
		 WHERE NOT EXISTS (SELECT 1 FROM tax_rules t WHERE t.rule_set_id=trs.id AND t.tax_type='EDTAX' AND t.applies_to='employee')`,

		`INSERT INTO tax_rules (rule_set_id, tax_type, rate, basis, applies_to)
		 SELECT trs.id,'EDTAX',0.035000,'statutory','employer' FROM tax_rule_sets trs
		 WHERE NOT EXISTS (SELECT 1 FROM tax_rules t WHERE t.rule_set_id=trs.id AND t.tax_type='EDTAX' AND t.applies_to='employer')`,

		`INSERT INTO tax_rules (rule_set_id, tax_type, rate, threshold, upper_limit, basis, applies_to)
		 SELECT trs.id,'PAYE_L1',0.250000,1799376,6000000,'statutory','employee' FROM tax_rule_sets trs
		 WHERE NOT EXISTS (SELECT 1 FROM tax_rules t WHERE t.rule_set_id=trs.id AND t.tax_type='PAYE_L1')`,

		`INSERT INTO tax_rules (rule_set_id, tax_type, rate, threshold, basis, applies_to)
		 SELECT trs.id,'PAYE_L2',0.300000,6000000,'statutory','employee' FROM tax_rule_sets trs
		 WHERE NOT EXISTS (SELECT 1 FROM tax_rules t WHERE t.rule_set_id=trs.id AND t.tax_type='PAYE_L2')`,

		// ════════════════════════════════════════════════════════════════════════
		// 027_holidays — Jamaican Holiday Management & Premium Pay
		// ════════════════════════════════════════════════════════════════════════
		//
		// holidays:        master calendar (national + company + emergency)
		// holiday_pay_rules: per-business configurable premium multipliers
		// holiday_shift_signups: voluntary holiday shift volunteering / assignment
		//
		// Variable-date holidays (Ash Wednesday, Good Friday, Easter Monday) are
		// computed by the Go holiday engine via the Computus (Gregorian Easter)
		// algorithm — only their `rule_key` is stored, the engine resolves dates.

		`CREATE TABLE IF NOT EXISTS holidays (
			id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			-- NULL business_id = national holiday shared by all businesses
			business_id     UUID        REFERENCES businesses(id) ON DELETE CASCADE,
			name            TEXT        NOT NULL,
			holiday_date    DATE,                       -- resolved date (NULL for pure rule-based recurring)
			holiday_type    TEXT        NOT NULL DEFAULT 'public'
			                  CHECK (holiday_type IN ('public','observed','company','emergency')),
			category        TEXT        NOT NULL DEFAULT 'fixed'
			                  CHECK (category IN ('fixed','variable','declared')),
			rule_key        TEXT,                       -- e.g. 'new_year','good_friday','easter_monday','labour_day'
			month_of        INT,                        -- for fixed recurring (1-12)
			day_of          INT,                        -- for fixed recurring (1-31)
			government_source TEXT,
			is_recurring    BOOLEAN     NOT NULL DEFAULT true,
			observed_rule   TEXT        NOT NULL DEFAULT 'none'
			                  CHECK (observed_rule IN ('none','next_monday','nearest_weekday')),
			effective_date  DATE        NOT NULL DEFAULT '2000-01-01',
			expiry_date     DATE,
			active          BOOLEAN     NOT NULL DEFAULT true,
			created_by      UUID        REFERENCES users(id),
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_holidays_biz  ON holidays(business_id, holiday_date)`,
		`CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date)`,
		`CREATE INDEX IF NOT EXISTS idx_holidays_rule ON holidays(rule_key)`,

		`CREATE TABLE IF NOT EXISTS holiday_pay_rules (
			id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id         UUID        NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
			-- Premium multipliers (configurable, no code changes needed)
			regular_multiplier  NUMERIC(5,2) NOT NULL DEFAULT 2.00,  -- worked-holiday base rate
			overtime_multiplier NUMERIC(5,2) NOT NULL DEFAULT 2.50,  -- OT on a holiday
			rest_day_multiplier NUMERIC(5,2) NOT NULL DEFAULT 2.50,  -- holiday on contractual rest day
			night_shift_multiplier NUMERIC(5,2) NOT NULL DEFAULT 2.25, -- holiday night shift
			-- Policy for employees who DON'T work the holiday
			absent_policy       TEXT        NOT NULL DEFAULT 'paid'
			                      CHECK (absent_policy IN ('paid','unpaid','partial')),
			absent_partial_pct  NUMERIC(5,2) NOT NULL DEFAULT 50.00, -- when absent_policy='partial'
			night_shift_start   INT         NOT NULL DEFAULT 22,     -- hour (24h) night premium begins
			night_shift_end     INT         NOT NULL DEFAULT 5,      -- hour night premium ends
			created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS holiday_shift_signups (
			id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id  UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			branch_id    UUID        REFERENCES branches(id) ON DELETE CASCADE,
			holiday_id   UUID        REFERENCES holidays(id) ON DELETE CASCADE,
			holiday_date DATE        NOT NULL,
			user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			user_name    TEXT        NOT NULL DEFAULT '',
			assignment   TEXT        NOT NULL DEFAULT 'voluntary'
			               CHECK (assignment IN ('voluntary','mandatory','swap')),
			status       TEXT        NOT NULL DEFAULT 'requested'
			               CHECK (status IN ('requested','approved','rejected','cancelled')),
			swap_with    UUID        REFERENCES users(id) ON DELETE SET NULL,
			reviewed_by  UUID        REFERENCES users(id),
			reviewed_at  TIMESTAMPTZ,
			created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(holiday_date, user_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_hss_biz   ON holiday_shift_signups(business_id, holiday_date)`,
		`CREATE INDEX IF NOT EXISTS idx_hss_user  ON holiday_shift_signups(user_id, holiday_date DESC)`,

		// Seed the 10 standard Jamaican public holidays as shared national rows
		// (business_id NULL). Fixed-date ones carry month_of/day_of; variable ones
		// carry a rule_key resolved at runtime by the Computus engine.
		`INSERT INTO holidays (business_id, name, holiday_type, category, rule_key, month_of, day_of, government_source, observed_rule)
		 SELECT NULL, v.name, 'public', v.category, v.rule_key, v.month_of, v.day_of, 'Holidays (Public General) Act', v.observed
		 FROM (VALUES
		   ('New Year''s Day',    'fixed',    'new_year',       1,  1,  'next_monday'),
		   ('Ash Wednesday',      'variable', 'ash_wednesday',  NULL, NULL, 'none'),
		   ('Good Friday',        'variable', 'good_friday',    NULL, NULL, 'none'),
		   ('Easter Monday',      'variable', 'easter_monday',  NULL, NULL, 'none'),
		   ('Labour Day',         'fixed',    'labour_day',     5,  23, 'none'),
		   ('Emancipation Day',   'fixed',    'emancipation',   8,  1,  'next_monday'),
		   ('Independence Day',   'fixed',    'independence',   8,  6,  'next_monday'),
		   ('National Heroes Day','variable', 'heroes_day',     NULL, NULL, 'none'),
		   ('Christmas Day',      'fixed',    'christmas',      12, 25, 'next_monday'),
		   ('Boxing Day',         'fixed',    'boxing_day',     12, 26, 'next_monday')
		 ) AS v(name, category, rule_key, month_of, day_of, observed)
		 WHERE NOT EXISTS (SELECT 1 FROM holidays h WHERE h.business_id IS NULL AND h.rule_key = v.rule_key)`,

		// Seed default holiday pay rules for every business
		`INSERT INTO holiday_pay_rules (business_id)
		 SELECT id FROM businesses
		 WHERE NOT EXISTS (SELECT 1 FROM holiday_pay_rules hpr WHERE hpr.business_id = businesses.id)`,

		// Add holiday columns to payroll run lines for premium tracking
		`ALTER TABLE payroll_run_lines ADD COLUMN IF NOT EXISTS holiday_hours    NUMERIC(8,2)  NOT NULL DEFAULT 0`,
		`ALTER TABLE payroll_run_lines ADD COLUMN IF NOT EXISTS holiday_premium  NUMERIC(14,2) NOT NULL DEFAULT 0`,
		`ALTER TABLE payroll_run_lines ADD COLUMN IF NOT EXISTS holiday_ot_pay   NUMERIC(14,2) NOT NULL DEFAULT 0`,

		// ════════════════════════════════════════════════════════════════════════
		// 028_offline_sync — Offline-First foundation
		// ════════════════════════════════════════════════════════════════════════
		//
		// change_log     : Change-Data-Capture feed consumed by the sync engine.
		// event_store    : append-only domain event log (event sourcing).
		// sync_outbox     : durable transactional outbox (never lose a record).
		// conflict_log   : conflicts requiring default resolution / human review.
		// sync_cursors   : per-station upload/download cursors.
		// sync_idempotency: dedupe table for idempotent /sync/upload batches.

		`CREATE TABLE IF NOT EXISTS change_log (
			seq         BIGSERIAL    PRIMARY KEY,
			business_id UUID,
			station_id  UUID,                        -- branch acting as station (nullable)
			entity      TEXT         NOT NULL,
			entity_id   UUID         NOT NULL,
			op          TEXT         NOT NULL CHECK (op IN ('insert','update','delete')),
			payload     JSONB        NOT NULL,
			lamport     BIGINT       NOT NULL DEFAULT 0,
			hlc         TEXT         NOT NULL DEFAULT '',
			created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			synced_at   TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_change_log_pending ON change_log(seq) WHERE synced_at IS NULL`,
		`CREATE INDEX IF NOT EXISTS idx_change_log_entity  ON change_log(entity, entity_id)`,

		`CREATE TABLE IF NOT EXISTS event_store (
			event_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			stream_id     UUID         NOT NULL,
			stream_type   TEXT         NOT NULL,
			seq_in_stream INT          NOT NULL,
			event_type    TEXT         NOT NULL,
			event_version INT          NOT NULL DEFAULT 1,
			payload       JSONB        NOT NULL,
			metadata      JSONB        NOT NULL DEFAULT '{}',
			business_id   UUID         NOT NULL,
			station_id    UUID,
			actor_id      UUID,
			occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			hlc           TEXT         NOT NULL DEFAULT '',
			recorded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			synced_at     TIMESTAMPTZ,
			UNIQUE (stream_id, seq_in_stream)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_event_store_biz     ON event_store(business_id, recorded_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_event_store_type    ON event_store(stream_type, occurred_at)`,
		`CREATE INDEX IF NOT EXISTS idx_event_store_pending ON event_store(recorded_at) WHERE synced_at IS NULL`,

		`CREATE TABLE IF NOT EXISTS sync_outbox (
			id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id   UUID,
			station_id    UUID,
			type          TEXT         NOT NULL,
			priority      SMALLINT     NOT NULL DEFAULT 2,    -- 1 highest (financial)
			payload       JSONB        NOT NULL,
			attempts      INT          NOT NULL DEFAULT 0,
			max_attempts  INT          NOT NULL DEFAULT 25,
			next_retry_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			status        TEXT         NOT NULL DEFAULT 'queued'
			               CHECK (status IN ('queued','inflight','failed','dead','done')),
			last_error    TEXT,
			created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_outbox_drain ON sync_outbox(status, priority, next_retry_at)
			WHERE status IN ('queued','failed')`,

		`CREATE TABLE IF NOT EXISTS conflict_log (
			id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id   UUID,
			entity        TEXT         NOT NULL,
			entity_id     UUID         NOT NULL,
			local_version BIGINT,
			cloud_version BIGINT,
			local_payload JSONB,
			cloud_payload JSONB,
			resolution    TEXT         NOT NULL DEFAULT 'needs_review'
			               CHECK (resolution IN ('lww','merged','needs_review','resolved')),
			resolved_by   UUID,
			resolved_at   TIMESTAMPTZ,
			created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_conflict_open ON conflict_log(business_id, created_at DESC)
			WHERE resolution = 'needs_review'`,

		`CREATE TABLE IF NOT EXISTS sync_cursors (
			station_id     UUID        PRIMARY KEY,
			business_id    UUID,
			upload_seq     BIGINT      NOT NULL DEFAULT 0,   -- last change_log.seq acked by cloud
			download_cursor TEXT       NOT NULL DEFAULT '',  -- last cloud cursor applied
			last_sync_at   TIMESTAMPTZ,
			last_handshake_at TIMESTAMPTZ,
			schema_version INT         NOT NULL DEFAULT 1,
			created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS sync_idempotency (
			idempotency_key TEXT       PRIMARY KEY,
			station_id      UUID,
			result          JSONB      NOT NULL,
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_idem_created ON sync_idempotency(created_at)`,

		// Generic cloud-side current-state store for synced entities. Decoupled
		// from OLTP tables so the sync engine is fully generic (no per-table code).
		// row_seq provides a monotonic download cursor.
		`CREATE SEQUENCE IF NOT EXISTS sync_state_seq`,
		`CREATE TABLE IF NOT EXISTS sync_entity_state (
			entity      TEXT         NOT NULL,
			entity_id   UUID         NOT NULL,
			business_id UUID,
			station_id  UUID,
			version     BIGINT       NOT NULL DEFAULT 1,
			hlc         TEXT         NOT NULL DEFAULT '',
			payload     JSONB        NOT NULL,
			deleted     BOOLEAN      NOT NULL DEFAULT false,
			row_seq     BIGINT       NOT NULL DEFAULT nextval('sync_state_seq'),
			updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			PRIMARY KEY (entity, entity_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_ses_cursor ON sync_entity_state(business_id, row_seq)`,

		// Generic CDC trigger — snapshots the row into change_log on write.
		// Attached only to tables that carry an `id UUID` primary key.
		`CREATE OR REPLACE FUNCTION sync_capture_change() RETURNS trigger AS $$
		DECLARE
			row_data JSONB;
			row_id   UUID;
			biz      UUID;
		BEGIN
			IF (TG_OP = 'DELETE') THEN
				row_data := to_jsonb(OLD); row_id := (OLD).id;
			ELSE
				row_data := to_jsonb(NEW); row_id := (NEW).id;
			END IF;
			BEGIN biz := (row_data->>'business_id')::uuid; EXCEPTION WHEN others THEN biz := NULL; END;
			INSERT INTO change_log (business_id, entity, entity_id, op, payload)
			VALUES (biz, TG_TABLE_NAME, row_id, lower(TG_OP), row_data);
			RETURN COALESCE(NEW, OLD);
		END; $$ LANGUAGE plpgsql`,

		// Attach the trigger to high-value transactional + reference tables.
		`DO $$
		DECLARE t TEXT;
		BEGIN
			FOREACH t IN ARRAY ARRAY[
				'shifts','deposits','orders','order_items','products',
				'tank_logs','nozzle_logs','fuel_receivals','employee_compensation',
				'payroll_run_lines','employee_feedback','holiday_shift_signups'
			] LOOP
				IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
					EXECUTE format('DROP TRIGGER IF EXISTS trg_cdc_%s ON %I', t, t);
					EXECUTE format(
						'CREATE TRIGGER trg_cdc_%s AFTER INSERT OR UPDATE OR DELETE ON %I
						 FOR EACH ROW EXECUTE FUNCTION sync_capture_change()', t, t);
				END IF;
			END LOOP;
		END $$`,

		// ════════════════════════════════════════════════════════════════════════
		// 029_loyalty — Customer Rewards & Loyalty Management
		// ════════════════════════════════════════════════════════════════════════
		//
		// Replaces the derived-points model with a persisted, auditable ledger.
		// loyalty_transactions is the source of truth; customers.loyalty_points is
		// a materialized balance kept in sync inside the same transaction.

		`ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points    INT  NOT NULL DEFAULT 0`,
		`ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_earned   INT  NOT NULL DEFAULT 0`,
		`ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_redeemed INT  NOT NULL DEFAULT 0`,
		`ALTER TABLE customers ADD COLUMN IF NOT EXISTS tier              TEXT NOT NULL DEFAULT 'Bronze'`,
		`ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth     DATE`,

		`CREATE TABLE IF NOT EXISTS loyalty_tiers (
			id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id UUID         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			name        TEXT         NOT NULL,
			min_points  INT          NOT NULL DEFAULT 0,
			multiplier  NUMERIC(5,2) NOT NULL DEFAULT 1.0,
			benefits    TEXT,
			sort_order  INT          NOT NULL DEFAULT 0,
			created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			UNIQUE(business_id, name)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_biz ON loyalty_tiers(business_id, min_points DESC)`,

		`CREATE TABLE IF NOT EXISTS loyalty_config (
			business_id            UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
			fuel_points_per_100    NUMERIC(8,4) NOT NULL DEFAULT 1,
			store_points_per_100   NUMERIC(8,4) NOT NULL DEFAULT 2,
			auto_approve_max       INT NOT NULL DEFAULT 1000,
			supervisor_approve_max INT NOT NULL DEFAULT 5000,
			daily_redeem_limit     INT NOT NULL DEFAULT 5,
			monthly_redeem_limit   INT NOT NULL DEFAULT 30,
			points_expiry_days     INT NOT NULL DEFAULT 0,
			updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS loyalty_rewards (
			id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id     UUID         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			name            TEXT         NOT NULL,
			description     TEXT         NOT NULL DEFAULT '',
			reward_type     TEXT         NOT NULL
			                  CHECK (reward_type IN ('fuel_discount','store_discount','free_product','car_wash','membership')),
			points_required INT          NOT NULL,
			discount_type   TEXT         CHECK (discount_type IN ('fixed_amount','percentage','free_fuel','free_item')),
			discount_value  NUMERIC(12,2),
			is_active       BOOLEAN      NOT NULL DEFAULT true,
			visible         BOOLEAN      NOT NULL DEFAULT true,
			start_date      DATE,
			end_date        DATE,
			max_redemptions INT,
			per_customer_limit INT,
			applicable_fuel_grades JSONB NOT NULL DEFAULT '[]',
			applicable_products    JSONB NOT NULL DEFAULT '[]',
			cost_estimate   NUMERIC(12,2) NOT NULL DEFAULT 0,
			redemption_count INT         NOT NULL DEFAULT 0,
			scope           TEXT         NOT NULL DEFAULT 'organization'
			                  CHECK (scope IN ('organization','station')),
			branch_id       UUID         REFERENCES branches(id) ON DELETE CASCADE,
			created_by      UUID         REFERENCES users(id),
			created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_biz ON loyalty_rewards(business_id, is_active)`,

		`CREATE TABLE IF NOT EXISTS loyalty_redemptions (
			id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id   UUID         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			branch_id     UUID         REFERENCES branches(id) ON DELETE SET NULL,
			customer_id   UUID         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
			reward_id     UUID         REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
			reward_name   TEXT         NOT NULL DEFAULT '',
			points_spent  INT          NOT NULL,
			status        TEXT         NOT NULL DEFAULT 'applied'
			                CHECK (status IN ('pending','approved','rejected','applied','cancelled')),
			approval_level TEXT        NOT NULL DEFAULT 'auto'
			                CHECK (approval_level IN ('auto','supervisor','manager')),
			idempotency_key TEXT       UNIQUE,
			requested_by  UUID         REFERENCES users(id),
			reviewed_by   UUID         REFERENCES users(id),
			reviewed_at   TIMESTAMPTZ,
			created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_cust ON loyalty_redemptions(customer_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_pending ON loyalty_redemptions(business_id, status) WHERE status='pending'`,

		`CREATE TABLE IF NOT EXISTS loyalty_transactions (
			id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id   UUID         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			branch_id     UUID         REFERENCES branches(id) ON DELETE SET NULL,
			customer_id   UUID         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
			tx_type       TEXT         NOT NULL
			                CHECK (tx_type IN ('earn','redeem','adjust','bonus','expire')),
			points_delta  INT          NOT NULL,
			balance_after INT          NOT NULL,
			source        TEXT,
			reference_id  UUID,
			reason        TEXT,
			actor_id      UUID         REFERENCES users(id),
			idempotency_key TEXT       UNIQUE,
			created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_loyalty_tx_cust ON loyalty_transactions(customer_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_loyalty_tx_biz  ON loyalty_transactions(business_id, created_at DESC)`,

		`CREATE TABLE IF NOT EXISTS loyalty_campaigns (
			id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id   UUID         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			name          TEXT         NOT NULL,
			description   TEXT         NOT NULL DEFAULT '',
			campaign_type TEXT         NOT NULL DEFAULT 'multiplier'
			                CHECK (campaign_type IN ('multiplier','bonus_threshold','double_points')),
			multiplier    NUMERIC(5,2) NOT NULL DEFAULT 2.0,
			bonus_points  INT          NOT NULL DEFAULT 0,
			threshold_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
			applies_to    TEXT         NOT NULL DEFAULT 'all'
			                CHECK (applies_to IN ('all','fuel','store','premium_fuel')),
			start_date    DATE         NOT NULL,
			end_date      DATE         NOT NULL,
			is_active     BOOLEAN      NOT NULL DEFAULT true,
			participation INT          NOT NULL DEFAULT 0,
			points_issued INT          NOT NULL DEFAULT 0,
			created_by    UUID         REFERENCES users(id),
			created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_loyalty_campaigns_biz ON loyalty_campaigns(business_id, is_active)`,

		`INSERT INTO loyalty_config (business_id)
		 SELECT id FROM businesses
		 WHERE NOT EXISTS (SELECT 1 FROM loyalty_config lc WHERE lc.business_id = businesses.id)`,

		`INSERT INTO loyalty_tiers (business_id, name, min_points, multiplier, benefits, sort_order)
		 SELECT b.id, t.name, t.min_points, t.mult, t.benefits, t.sort
		 FROM businesses b
		 CROSS JOIN (VALUES
		   ('Bronze',   0,     1.0, 'Standard earning rate',          0),
		   ('Silver',   5000,  1.0, 'Priority service',               1),
		   ('Gold',     20000, 1.5, '1.5x points, exclusive rewards', 2),
		   ('Platinum', 50000, 2.0, '2x points, member fuel pricing', 3)
		 ) AS t(name, min_points, mult, benefits, sort)
		 WHERE NOT EXISTS (SELECT 1 FROM loyalty_tiers lt WHERE lt.business_id = b.id AND lt.name = t.name)`,

		// ════════════════════════════════════════════════════════════════════════
		// 030_user_deactivation — persist deactivation reason / reactivate date /
		// free-text note (e.g. Special Leave). No CHECK so reasons stay flexible.
		// ════════════════════════════════════════════════════════════════════════
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS reactivate_on       DATE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_note   TEXT`,
	}

	for _, s := range stmts {
		if _, err := pool.Exec(ctx, s); err != nil {
			return fmt.Errorf("schema migration failed: %w\nstatement: %s", err, s)
		}
	}
	return nil
}
