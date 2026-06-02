CREATE TABLE IF NOT EXISTS issues (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        NOT NULL REFERENCES businesses(id),
  branch_id   UUID        REFERENCES branches(id),
  reporter_id UUID        REFERENCES users(id),
  reporter_name TEXT      NOT NULL,
  category    TEXT        NOT NULL,
  description TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
