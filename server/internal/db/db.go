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
	}

	for _, s := range stmts {
		if _, err := pool.Exec(ctx, s); err != nil {
			return fmt.Errorf("schema migration failed: %w\nstatement: %s", err, s)
		}
	}
	return nil
}
