CREATE TABLE IF NOT EXISTS fuel_receivals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id       UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  tank_id        UUID REFERENCES tanks(id) ON DELETE SET NULL,
  fuel_name      TEXT NOT NULL,
  litres_ordered NUMERIC(12,4) NOT NULL,
  opening_level  NUMERIC(12,4),
  closing_level  NUMERIC(12,4),
  rate           NUMERIC(12,4),
  haulage        NUMERIC(12,2),
  gct            NUMERIC(12,2),
  invoice_no     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
