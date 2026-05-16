UPDATE users SET role = 'Super Admin' WHERE role = 'Owner';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Super Admin', 'Branch Admin', 'Supervisor', 'Manager', 'Cashier', 'Attendant'));
