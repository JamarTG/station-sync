-- additional fields for convenience store orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name  TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount       NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_given   NUMERIC(10,2);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) NOT NULL DEFAULT 0;
