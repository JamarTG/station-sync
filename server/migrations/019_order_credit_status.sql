-- allow crediting orders (a fulfilled sale charged to a customer's account)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('open', 'paid', 'voided', 'held', 'credit'));
