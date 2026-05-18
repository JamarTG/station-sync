ALTER TABLE users ADD COLUMN pay_rate NUMERIC(10, 2);
ALTER TABLE users ADD COLUMN pay_type TEXT CHECK (pay_type IN ('Hourly', 'Salary'));

CREATE TABLE payroll_periods (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    status     TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payroll_records (
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
);
