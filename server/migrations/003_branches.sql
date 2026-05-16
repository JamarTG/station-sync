CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, name)
);

ALTER TABLE users    ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE sessions ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE pumps    ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE shifts   ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;
