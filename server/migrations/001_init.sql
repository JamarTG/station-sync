CREATE TABLE days (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE fuels (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('Supervisor', 'Admin', 'Attendant', 'Manager')),
    password_hash TEXT NOT NULL,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    employed_on   DATE,
    date_of_birth DATE,
    phone         TEXT NOT NULL DEFAULT '',
    nis           TEXT NOT NULL DEFAULT '',
    trn           TEXT NOT NULL DEFAULT '',
    email         TEXT NOT NULL UNIQUE
);

CREATE TABLE shift_schedules (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    start_time     TIME NOT NULL,
    end_time       TIME NOT NULL,
    effective_date DATE NOT NULL
);

CREATE TABLE shift_schedule_days (
    shift_schedule_id UUID NOT NULL REFERENCES shift_schedules(id) ON DELETE CASCADE,
    day_id            UUID NOT NULL REFERENCES days(id),
    PRIMARY KEY (shift_schedule_id, day_id)
);

CREATE TABLE shifts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supervisor_id UUID NOT NULL REFERENCES users(id),
    date          DATE NOT NULL,
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shift_fuel_prices (
    fuel_id  UUID NOT NULL REFERENCES fuels(id),
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    price    NUMERIC(10, 4) NOT NULL,
    PRIMARY KEY (fuel_id, shift_id)
);

CREATE TABLE shift_attendance (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id  UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id),
    clock_in  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clock_out TIMESTAMPTZ
);

CREATE TABLE pumps (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE nozzles (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pump_id UUID NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
    fuel_id UUID NOT NULL REFERENCES fuels(id)
);

CREATE TABLE nozzle_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nozzle_id        UUID NOT NULL REFERENCES nozzles(id),
    shift_id         UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    starting_reading NUMERIC(12, 2) NOT NULL,
    ending_reading   NUMERIC(12, 2) NOT NULL
);

CREATE TABLE tanks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fuel_id          UUID NOT NULL REFERENCES fuels(id),
    maximum_capacity NUMERIC(12, 2) NOT NULL
);

CREATE TABLE tank_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id          UUID NOT NULL REFERENCES tanks(id),
    shift_id         UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    before_volume    NUMERIC(12, 2) NOT NULL,
    after_volume     NUMERIC(12, 2) NOT NULL,
    dispensed_volume NUMERIC(12, 2) NOT NULL,
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deposits (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id     UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    attendant_id UUID NOT NULL REFERENCES users(id),
    type         TEXT NOT NULL CHECK (type IN ('Cash', 'Card', 'Charge', 'FX', 'Advance')),
    amount       NUMERIC(10, 2) NOT NULL,
    fx_currency  TEXT,
    fx_amount    NUMERIC(10, 2),
    fx_rate      NUMERIC(10, 4),
    metadata     TEXT
);

CREATE TABLE drops (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deposited_by  UUID NOT NULL REFERENCES users(id),
    received_by   UUID REFERENCES users(id),
    amount        NUMERIC(10, 2) NOT NULL,
    reference     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
