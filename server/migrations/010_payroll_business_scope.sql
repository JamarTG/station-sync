ALTER TABLE payroll_periods ADD COLUMN business_id UUID REFERENCES businesses(id);

-- Backfill existing periods with the first business so the NOT NULL constraint can be applied
UPDATE payroll_periods SET business_id = (SELECT id FROM businesses LIMIT 1) WHERE business_id IS NULL;

ALTER TABLE payroll_periods ALTER COLUMN business_id SET NOT NULL;
