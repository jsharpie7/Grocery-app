-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Households (shared via join code, no individual accounts)
CREATE TABLE households (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL DEFAULT 'My Household',
  join_code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Stores
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text,
  color text NOT NULL DEFAULT '#6366f1',
  display_order int NOT NULL DEFAULT 0,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pre-defined + custom categories
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🛒',
  is_default bool NOT NULL DEFAULT false
);

-- Seed default categories
INSERT INTO categories (name, icon, is_default) VALUES
  ('Produce', '🥦', true),
  ('Meat & Seafood', '🥩', true),
  ('Dairy & Eggs', '🥛', true),
  ('Bakery', '🍞', true),
  ('Frozen', '🧊', true),
  ('Pantry', '🥫', true),
  ('Beverages', '🥤', true),
  ('Snacks', '🍿', true),
  ('Household', '🧹', true),
  ('Personal Care', '🧴', true),
  ('Baby', '👶', true),
  ('Pet', '🐾', true),
  ('Other', '🛒', true);

-- Items (master catalog per household)
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  category_id uuid REFERENCES categories(id),
  photo_url text,
  barcode text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Per-store item config (price history + typical quantity)
CREATE TABLE store_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  typical_price decimal(10,2),
  typical_quantity decimal(10,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ea',
  purchase_count int NOT NULL DEFAULT 0,
  last_purchased_at timestamptz,
  UNIQUE(store_id, item_id)
);

-- Active grocery list (one per store per household)
CREATE TABLE list_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity decimal(10,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ea',
  is_checked bool NOT NULL DEFAULT false,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by text,
  UNIQUE(household_id, store_id, item_id)
);

-- Completed shopping trips
CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  total_spent decimal(10,2),
  receipt_photo_url text
);

-- Items purchased on each trip
CREATE TABLE trip_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity decimal(10,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ea',
  price_paid decimal(10,2)
);

-- Learned shopping path (position per item per store)
CREATE TABLE shopping_order (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  average_position float NOT NULL DEFAULT 0,
  sample_count int NOT NULL DEFAULT 0,
  UNIQUE(store_id, item_id)
);

-- Row Level Security Policies

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_order ENABLE ROW LEVEL SECURITY;

-- Households: anyone can read/write (no auth, just household_id gating)
CREATE POLICY "Allow all on households" ON households FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on stores" ON stores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on items" ON items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on store_items" ON store_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on list_items" ON list_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on trips" ON trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on trip_items" ON trip_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on shopping_order" ON shopping_order FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime on list_items
ALTER PUBLICATION supabase_realtime ADD TABLE list_items;

-- Indexes for common queries
CREATE INDEX idx_stores_household ON stores(household_id);
CREATE INDEX idx_items_household ON items(household_id);
CREATE INDEX idx_store_items_store ON store_items(store_id);
CREATE INDEX idx_store_items_purchase_count ON store_items(store_id, purchase_count DESC);
CREATE INDEX idx_list_items_household ON list_items(household_id);
CREATE INDEX idx_list_items_store ON list_items(household_id, store_id);
CREATE INDEX idx_trips_household ON trips(household_id);
CREATE INDEX idx_trip_items_trip ON trip_items(trip_id);
CREATE INDEX idx_shopping_order_store ON shopping_order(store_id, average_position ASC);
