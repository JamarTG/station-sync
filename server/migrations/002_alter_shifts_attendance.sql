ALTER TABLE shifts ALTER COLUMN end_time DROP NOT NULL;

ALTER TABLE shift_attendance ADD COLUMN IF NOT EXISTS pump_id UUID REFERENCES pumps(id);

ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_type_check;
ALTER TABLE deposits ADD CONSTRAINT deposits_type_check
  CHECK (type IN ('Cash', 'Card', 'Charge', 'FX', 'Advance', 'Expenditure'));
