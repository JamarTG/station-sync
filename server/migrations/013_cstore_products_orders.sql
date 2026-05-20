-- convenience store shifts: add shift_type to existing shifts table
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS shift_type TEXT NOT NULL DEFAULT 'service_station'
  CHECK (shift_type IN ('service_station', 'convenience_store'));

-- products
CREATE TABLE IF NOT EXISTS products (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id   UUID    REFERENCES branches(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  category    TEXT,
  sku         TEXT,
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost        NUMERIC(10,2),
  stock_qty   INT     NOT NULL DEFAULT 0,
  unit        TEXT    NOT NULL DEFAULT 'each',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, sku)
);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id      UUID REFERENCES branches(id) ON DELETE SET NULL,
  shift_id       UUID REFERENCES shifts(id) ON DELETE SET NULL,
  cashier_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  cashier_name   TEXT NOT NULL DEFAULT '',
  order_no       BIGSERIAL,
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'paid', 'voided')),
  payment_method TEXT,
  subtotal       NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax            NUMERIC(10,2) NOT NULL DEFAULT 0,
  total          NUMERIC(10,2) NOT NULL DEFAULT 0,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- order line items
CREATE TABLE IF NOT EXISTS order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name       TEXT    NOT NULL,
  sku        TEXT,
  quantity   INT     NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total      NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sample products for PTM Petroleum Ltd
INSERT INTO products (business_id, name, category, sku, price, cost, stock_qty, unit)
SELECT b.id, p.name, p.category, p.sku, p.price, p.cost, p.stock_qty, p.unit
FROM businesses b
CROSS JOIN (VALUES
  ('Coca-Cola 355ml',       'Beverages',  'BEV-001',  180.00,  120.00,  50, 'each'),
  ('Pepsi 355ml',           'Beverages',  'BEV-002',  180.00,  120.00,  50, 'each'),
  ('Water 500ml',           'Beverages',  'BEV-003',  120.00,   80.00,  80, 'each'),
  ('Red Bull 250ml',        'Beverages',  'BEV-004',  450.00,  300.00,  30, 'each'),
  ('Ting 355ml',            'Beverages',  'BEV-005',  160.00,  100.00,  40, 'each'),
  ('Cheese & Crackers',     'Snacks',     'SNK-001',  250.00,  150.00,  40, 'each'),
  ('Peanuts 100g',          'Snacks',     'SNK-002',  200.00,  120.00,  30, 'each'),
  ('Chips 60g',             'Snacks',     'SNK-003',  220.00,  140.00,  35, 'each'),
  ('Chocolate Bar',         'Snacks',     'SNK-004',  280.00,  180.00,  25, 'each'),
  ('Gum Pack',              'Snacks',     'SNK-005',  150.00,   90.00,  50, 'each'),
  ('Motor Oil 1L',          'Automotive', 'AUT-001', 1200.00,  800.00,  20, 'each'),
  ('Windscreen Wash 1L',    'Automotive', 'AUT-002',  650.00,  400.00,  15, 'each'),
  ('Air Freshener',         'Automotive', 'AUT-003',  550.00,  350.00,  20, 'each'),
  ('Ice',                   'Other',      'OTH-001',  200.00,  100.00,  10, 'bag'),
  ('Cigarettes (pack)',     'Tobacco',    'TOB-001',  900.00,  650.00,  30, 'each')
) AS p(name, category, sku, price, cost, stock_qty, unit)
WHERE b.name = 'PTM Petroleum Ltd'
ON CONFLICT (business_id, sku) DO NOTHING;
