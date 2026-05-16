-- Add item_number (store SKU/product code) to items and receipt_items.
-- Safe to re-run: uses IF NOT EXISTS guards.

ALTER TABLE items ADD COLUMN IF NOT EXISTS item_number text;
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS item_number text;

CREATE INDEX IF NOT EXISTS items_item_number_idx
  ON items(household_id, item_number)
  WHERE item_number IS NOT NULL;
