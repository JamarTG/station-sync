-- allow refunding individual order line items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refunded BOOLEAN NOT NULL DEFAULT false;
