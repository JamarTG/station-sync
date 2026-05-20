-- Allow null business_id in sessions for platform admin users
ALTER TABLE sessions ALTER COLUMN business_id DROP NOT NULL;

-- Allow platform admin users to have no business_id
ALTER TABLE users ALTER COLUMN business_id DROP NOT NULL;

-- Add Super Duper Admin to the role check constraint
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['Super Duper Admin'::text, 'Super Admin'::text, 'Branch Admin'::text, 'Supervisor'::text, 'Manager'::text, 'Cashier'::text, 'Attendant'::text]));
