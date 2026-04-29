-- Grocery Spend Schema
-- Apply in Supabase SQL editor before testing auth flows

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Households
CREATE TABLE households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Household members (max 2 per household, enforced by trigger)
CREATE TABLE household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  email text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, user_id)
);

CREATE INDEX ON household_members(user_id);
CREATE INDEX ON household_members(household_id);

-- Trigger: enforce max 2 members per household (atomic, not just policy)
CREATE OR REPLACE FUNCTION enforce_household_member_limit()
RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM household_members WHERE household_id = NEW.household_id) >= 2 THEN
    RAISE EXCEPTION 'Household already has 2 members';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_household_limit
  BEFORE INSERT ON household_members
  FOR EACH ROW EXECUTE FUNCTION enforce_household_member_limit();

-- Stores
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, name)
);

CREATE INDEX ON stores(household_id);

-- Receipts
CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  receipt_date date NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  UNIQUE(household_id, store_id, receipt_date, total_amount)
);

CREATE INDEX ON receipts(household_id, receipt_date DESC);
CREATE INDEX ON receipts(store_id);

-- Items (canonical product catalog per household)
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, name)
);

CREATE INDEX ON items(household_id);

-- Receipt line items
CREATE TABLE receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ea',
  unit_price numeric(10,2),
  total_price numeric(10,2),
  category text NOT NULL DEFAULT 'Other',
  matched_item_id uuid REFERENCES items(id) ON DELETE SET NULL
);

CREATE INDEX ON receipt_items(receipt_id);
CREATE INDEX ON receipt_items(matched_item_id);

-- Item price history (capped at 50 per item in application layer)
CREATE TABLE item_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  unit_price numeric(10,2) NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  receipt_id uuid REFERENCES receipts(id) ON DELETE SET NULL
);

CREATE INDEX ON item_prices(item_id);
CREATE INDEX ON item_prices(item_id, purchased_at DESC);

-- ============================================================
-- RLS Security Definer Helper
-- ============================================================

-- Returns the household_id for the current authenticated user.
-- STABLE: cached per statement (not per row), so safe for RLS.
-- Called in every RLS policy — the index on household_members(user_id) is critical.
CREATE OR REPLACE FUNCTION current_household_id()
RETURNS uuid AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Enable RLS
-- ============================================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_prices ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Households policies
-- ============================================================

CREATE POLICY "select_own_household" ON households
  FOR SELECT USING (id = current_household_id());

CREATE POLICY "insert_household" ON households
  FOR INSERT WITH CHECK (true);

CREATE POLICY "update_own_household" ON households
  FOR UPDATE USING (id = current_household_id());

-- ============================================================
-- Household members policies
-- ============================================================

CREATE POLICY "select_own_membership" ON household_members
  FOR SELECT USING (household_id = current_household_id());

-- NOTE: NEW.household_id is NOT valid in WITH CHECK — use bare column name.
-- The bare `household_id` in WITH CHECK refers to the new row being inserted.
CREATE POLICY "insert_own_membership" ON household_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (SELECT COUNT(*) FROM household_members hm WHERE hm.household_id = household_id) < 2
  );

CREATE POLICY "delete_own_membership" ON household_members
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- Stores policies
-- ============================================================

CREATE POLICY "select_household_stores" ON stores
  FOR SELECT USING (household_id = current_household_id());

CREATE POLICY "insert_household_stores" ON stores
  FOR INSERT WITH CHECK (household_id = current_household_id());

CREATE POLICY "update_household_stores" ON stores
  FOR UPDATE USING (household_id = current_household_id());

CREATE POLICY "delete_household_stores" ON stores
  FOR DELETE USING (household_id = current_household_id());

-- ============================================================
-- Receipts policies
-- ============================================================

CREATE POLICY "select_household_receipts" ON receipts
  FOR SELECT USING (household_id = current_household_id());

CREATE POLICY "insert_household_receipts" ON receipts
  FOR INSERT WITH CHECK (household_id = current_household_id());

CREATE POLICY "update_household_receipts" ON receipts
  FOR UPDATE USING (household_id = current_household_id());

CREATE POLICY "delete_household_receipts" ON receipts
  FOR DELETE USING (household_id = current_household_id());

-- ============================================================
-- Items policies
-- ============================================================

CREATE POLICY "select_household_items" ON items
  FOR SELECT USING (household_id = current_household_id());

CREATE POLICY "insert_household_items" ON items
  FOR INSERT WITH CHECK (household_id = current_household_id());

CREATE POLICY "update_household_items" ON items
  FOR UPDATE USING (household_id = current_household_id());

CREATE POLICY "delete_household_items" ON items
  FOR DELETE USING (household_id = current_household_id());

-- ============================================================
-- Receipt items policies (scoped via receipt → household)
-- ============================================================

CREATE POLICY "select_receipt_items" ON receipt_items
  FOR SELECT USING (
    receipt_id IN (SELECT id FROM receipts WHERE household_id = current_household_id())
  );

CREATE POLICY "insert_receipt_items" ON receipt_items
  FOR INSERT WITH CHECK (
    receipt_id IN (SELECT id FROM receipts WHERE household_id = current_household_id())
  );

CREATE POLICY "update_receipt_items" ON receipt_items
  FOR UPDATE USING (
    receipt_id IN (SELECT id FROM receipts WHERE household_id = current_household_id())
  );

CREATE POLICY "delete_receipt_items" ON receipt_items
  FOR DELETE USING (
    receipt_id IN (SELECT id FROM receipts WHERE household_id = current_household_id())
  );

-- ============================================================
-- Item prices policies (scoped via item → household)
-- ============================================================

CREATE POLICY "select_item_prices" ON item_prices
  FOR SELECT USING (
    item_id IN (SELECT id FROM items WHERE household_id = current_household_id())
  );

CREATE POLICY "insert_item_prices" ON item_prices
  FOR INSERT WITH CHECK (
    item_id IN (SELECT id FROM items WHERE household_id = current_household_id())
  );

CREATE POLICY "delete_item_prices" ON item_prices
  FOR DELETE USING (
    item_id IN (SELECT id FROM items WHERE household_id = current_household_id())
  );
