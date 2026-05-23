-- customer accounts; every staff member gets one automatically
CREATE TABLE IF NOT EXISTS customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id        UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  phone          TEXT,
  email          TEXT,
  credit_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- backfill: a customer account for every existing staff member
-- (skip platform admins, who have no business)
INSERT INTO customers (business_id, user_id, name, phone, email)
SELECT u.business_id, u.id, u.name, u.phone, u.email
FROM users u
WHERE u.business_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.user_id = u.id);
