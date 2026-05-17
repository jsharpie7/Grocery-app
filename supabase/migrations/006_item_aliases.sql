-- Item aliases: ties (store + OCR receipt name + barcode) to a catalog item.
-- Enables store-aware matching: Publix "GW ORG MANDARINS" → "Mandarins" after first save.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS item_aliases (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  store_id     uuid REFERENCES stores(id) ON DELETE SET NULL,
  receipt_name text NOT NULL,
  item_number  text,
  UNIQUE(household_id, store_id, receipt_name)
);

CREATE INDEX IF NOT EXISTS item_aliases_barcode_idx
  ON item_aliases(household_id, item_number) WHERE item_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS item_aliases_store_name_idx
  ON item_aliases(household_id, store_id, receipt_name);

ALTER TABLE item_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_item_aliases" ON item_aliases;
DROP POLICY IF EXISTS "insert_item_aliases" ON item_aliases;
DROP POLICY IF EXISTS "delete_item_aliases" ON item_aliases;

CREATE POLICY "select_item_aliases" ON item_aliases
  FOR SELECT USING (household_id = current_household_id());
CREATE POLICY "insert_item_aliases" ON item_aliases
  FOR INSERT WITH CHECK (household_id = current_household_id());
CREATE POLICY "delete_item_aliases" ON item_aliases
  FOR DELETE USING (household_id = current_household_id());
