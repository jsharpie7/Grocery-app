-- T2: top-items-by-spend RPC + case-insensitive store name uniqueness.
-- Apply after 006_item_aliases.sql. Additive and safe to re-run.

-- ---------------------------------------------------------------------------
-- Top items by total dollars spent, for the Insights "Top Items" tab.
--
-- Replaces a client-side aggregate that ranked by PURCHASE COUNT while being
-- labelled as spend, and which read from item_prices -- a table that stores no
-- quantity, so it could not express dollars spent even in principle.
--
-- NO household_id param: derived from current_household_id(), matching
-- get_monthly_spend/get_store_monthly_spend. SECURITY DEFINER *bypasses* RLS
-- rather than inheriting it, so household scoping is an explicit WHERE clause
-- on receipts (receipt_items itself carries no household_id).
--
-- Grouping: matched line items collapse on matched_item_id so every purchase of
-- a catalog item sums together. Unmatched items (matched_item_id is nullable and
-- is SET NULL when a catalog item is deleted) fall back to their normalized
-- receipt name so their spend still appears instead of silently vanishing from
-- a list titled "top spend".
--
-- Money: total_price and unit_price are both nullable, so the sum coalesces
-- through total_price -> unit_price*quantity -> 0. Without the terminal 0 a row
-- with both prices null would drop out of SUM entirely.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_top_items_by_spend(
  p_months int DEFAULT 12,
  p_limit  int DEFAULT 10
)
RETURNS TABLE(
  group_key      text,
  item_id        uuid,
  display_name   text,
  category       text,
  total_spend    numeric,
  purchase_count bigint,
  recent_prices  numeric[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(ri.matched_item_id::text, lower(trim(ri.item_name))) AS group_key,
    -- All rows in a matched group share one matched_item_id; NULL when unmatched.
    -- (max() has no uuid overload in Postgres, hence array_agg.)
    (array_agg(ri.matched_item_id))[1] AS item_id,
    -- Prefer the canonical catalog name/category; fall back to what the receipt
    -- itself recorded. receipt_items.category is NOT NULL, so unmatched rows
    -- still carry a real category rather than a placeholder.
    COALESCE(
      max(i.name),
      (array_agg(ri.item_name ORDER BY r.receipt_date DESC))[1]
    ) AS display_name,
    COALESCE(
      max(i.category),
      (array_agg(ri.category ORDER BY r.receipt_date DESC))[1]
    ) AS category,
    SUM(COALESCE(ri.total_price, ri.unit_price * ri.quantity, 0)) AS total_spend,
    COUNT(*) AS purchase_count,
    -- Most recent 8 unit prices, newest first, for the price-history strip.
    (array_agg(ri.unit_price ORDER BY r.receipt_date DESC)
       FILTER (WHERE ri.unit_price IS NOT NULL))[1:8] AS recent_prices
  FROM receipt_items ri
  JOIN receipts r ON r.id = ri.receipt_id
  LEFT JOIN items i ON i.id = ri.matched_item_id
  WHERE
    r.household_id = current_household_id()
    AND r.receipt_date >= (CURRENT_DATE - (p_months || ' months')::interval)::date
  GROUP BY COALESCE(ri.matched_item_id::text, lower(trim(ri.item_name)))
  ORDER BY SUM(COALESCE(ri.total_price, ri.unit_price * ri.quantity, 0)) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- Case-insensitive store name uniqueness.
--
-- The table's original UNIQUE(household_id, name) is case-sensitive, so
-- "Costco" and "costco" could both exist as separate stores. Enforcing this in
-- the client alone would still let a stale local store list slip a duplicate
-- past, so the constraint lives in the database.
--
-- PRECONDITION: fails if a household already holds case-only duplicates. Check
-- before applying:
--   SELECT household_id, lower(trim(name)), count(*)
--   FROM stores GROUP BY 1, 2 HAVING count(*) > 1;
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS stores_household_name_ci_idx
  ON stores (household_id, lower(trim(name)));
