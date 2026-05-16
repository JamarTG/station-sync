DROP TABLE IF EXISTS
  tank_logs, nozzle_logs, deposits, shift_attendance, shift_fuel_prices,
  nozzles, tanks, shifts, shift_schedule_days, shift_schedules, pumps,
  sessions, users, fuels, businesses, days
  CASCADE;

CREATE TABLE businesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL DEFAULT 'Attendant'
                  CHECK (role IN ('Owner', 'Supervisor', 'Attendant', 'Manager')),
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  phone         TEXT,
  nis           TEXT,
  trn           TEXT,
  employed_on   DATE,
  date_of_birth DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE fuels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  UNIQUE (business_id, name)
);

CREATE TABLE pumps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  UNIQUE (business_id, name)
);

CREATE TABLE nozzles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pump_id UUID NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
  fuel_id UUID NOT NULL REFERENCES fuels(id) ON DELETE CASCADE,
  UNIQUE (pump_id, fuel_id)
);

CREATE TABLE tanks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  fuel_id          UUID REFERENCES fuels(id) ON DELETE SET NULL,
  capacity_litres  NUMERIC(12,2),
  UNIQUE (business_id, name)
);

CREATE TABLE shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES users(id),
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time    TIME NOT NULL DEFAULT '06:00:00',
  end_time      TIME,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shift_fuel_prices (
  fuel_id  UUID NOT NULL REFERENCES fuels(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  price    NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (fuel_id, shift_id)
);

CREATE TABLE shift_attendance (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id  UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id),
  pump_id   UUID REFERENCES pumps(id) ON DELETE SET NULL,
  clock_in  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ
);

CREATE TABLE deposits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id     UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  attendant_id UUID NOT NULL REFERENCES users(id),
  type         TEXT NOT NULL
                 CHECK (type IN ('Cash','Card','Charge','FX','Advance','Expenditure','CashDeposit','CardDeposit','FXDeposit','Cheque')),
  amount       NUMERIC(12,2) NOT NULL,
  metadata     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nozzle_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nozzle_id        UUID NOT NULL REFERENCES nozzles(id) ON DELETE CASCADE,
  shift_id         UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  starting_reading NUMERIC(12,2),
  ending_reading   NUMERIC(12,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (nozzle_id, shift_id)
);

CREATE TABLE tank_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id         UUID NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
  shift_id        UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  opening_level   NUMERIC(12,2),
  closing_level   NUMERIC(12,2),
  delivery_litres NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tank_id, shift_id)
);
