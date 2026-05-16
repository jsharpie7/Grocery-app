-- Fix: re-apply all RLS policies and helper function.
-- Safe to re-run: DROP IF EXISTS before every CREATE.

CREATE OR REPLACE FUNCTION current_household_id()
RETURNS uuid AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Households
DROP POLICY IF EXISTS "select_own_household" ON households;
DROP POLICY IF EXISTS "insert_household" ON households;
DROP POLICY IF EXISTS "update_own_household" ON households;
CREATE POLICY "select_own_household" ON households FOR SELECT USING (id = current_household_id());
CREATE POLICY "insert_household" ON households FOR INSERT WITH CHECK (true);
CREATE POLICY "update_own_household" ON households FOR UPDATE USING (id = current_household_id());

-- Household members
DROP POLICY IF EXISTS "select_own_membership" ON household_members;
DROP POLICY IF EXISTS "insert_own_membership" ON household_members;
DROP POLICY IF EXISTS "delete_own_membership" ON household_members;
CREATE POLICY "select_own_membership" ON household_members FOR SELECT USING (household_id = current_household_id());
CREATE POLICY "insert_own_membership" ON household_members FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (SELECT COUNT(*) FROM household_members hm WHERE hm.household_id = household_id) < 2
);
CREATE POLICY "delete_own_membership" ON household_members FOR DELETE USING (user_id = auth.uid());

-- Stores
DROP POLICY IF EXISTS "select_household_stores" ON stores;
DROP POLICY IF EXISTS "insert_household_stores" ON stores;
DROP POLICY IF EXISTS "update_household_stores" ON stores;
DROP POLICY IF EXISTS "delete_household_stores" ON stores;
CREATE POLICY "select_household_stores" ON stores FOR SELECT USING (household_id = current_household_id());
CREATE POLICY "insert_household_stores" ON stores FOR INSERT WITH CHECK (household_id = current_household_id());
CREATE POLICY "update_household_stores" ON stores FOR UPDATE USING (household_id = current_household_id());
CREATE POLICY "delete_household_stores" ON stores FOR DELETE USING (household_id = current_household_id());

-- Receipts
DROP POLICY IF EXISTS "select_household_receipts" ON receipts;
DROP POLICY IF EXISTS "insert_household_receipts" ON receipts;
DROP POLICY IF EXISTS "update_household_receipts" ON receipts;
DROP POLICY IF EXISTS "delete_household_receipts" ON receipts;
CREATE POLICY "select_household_receipts" ON receipts FOR SELECT USING (household_id = current_household_id());
CREATE POLICY "insert_household_receipts" ON receipts FOR INSERT WITH CHECK (household_id = current_household_id());
CREATE POLICY "update_household_receipts" ON receipts FOR UPDATE USING (household_id = current_household_id());
CREATE POLICY "delete_household_receipts" ON receipts FOR DELETE USING (household_id = current_household_id());

-- Items
DROP POLICY IF EXISTS "select_household_items" ON items;
DROP POLICY IF EXISTS "insert_household_items" ON items;
DROP POLICY IF EXISTS "update_household_items" ON items;
DROP POLICY IF EXISTS "delete_household_items" ON items;
CREATE POLICY "select_household_items" ON items FOR SELECT USING (household_id = current_household_id());
CREATE POLICY "insert_household_items" ON items FOR INSERT WITH CHECK (household_id = current_household_id());
CREATE POLICY "update_household_items" ON items FOR UPDATE USING (household_id = current_household_id());
CREATE POLICY "delete_household_items" ON items FOR DELETE USING (household_id = current_household_id());

-- Receipt items
DROP POLICY IF EXISTS "select_receipt_items" ON receipt_items;
DROP POLICY IF EXISTS "insert_receipt_items" ON receipt_items;
DROP POLICY IF EXISTS "update_receipt_items" ON receipt_items;
DROP POLICY IF EXISTS "delete_receipt_items" ON receipt_items;
CREATE POLICY "select_receipt_items" ON receipt_items FOR SELECT USING (receipt_id IN (SELECT id FROM receipts WHERE household_id = current_household_id()));
CREATE POLICY "insert_receipt_items" ON receipt_items FOR INSERT WITH CHECK (receipt_id IN (SELECT id FROM receipts WHERE household_id = current_household_id()));
CREATE POLICY "update_receipt_items" ON receipt_items FOR UPDATE USING (receipt_id IN (SELECT id FROM receipts WHERE household_id = current_household_id()));
CREATE POLICY "delete_receipt_items" ON receipt_items FOR DELETE USING (receipt_id IN (SELECT id FROM receipts WHERE household_id = current_household_id()));

-- Item prices
DROP POLICY IF EXISTS "select_item_prices" ON item_prices;
DROP POLICY IF EXISTS "insert_item_prices" ON item_prices;
DROP POLICY IF EXISTS "delete_item_prices" ON item_prices;
CREATE POLICY "select_item_prices" ON item_prices FOR SELECT USING (item_id IN (SELECT id FROM items WHERE household_id = current_household_id()));
CREATE POLICY "insert_item_prices" ON item_prices FOR INSERT WITH CHECK (item_id IN (SELECT id FROM items WHERE household_id = current_household_id()));
CREATE POLICY "delete_item_prices" ON item_prices FOR DELETE USING (item_id IN (SELECT id FROM items WHERE household_id = current_household_id()));
