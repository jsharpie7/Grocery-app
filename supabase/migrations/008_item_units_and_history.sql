-- ---------------------------------------------------------------------------
-- 008: count what was bought, and expose one item's purchase history.
--
-- Two problems, both found by comparing the Items screen against real
-- receipts.
--
-- 1. "buys" counted receipt LINES, not units. Gemini consolidates repeats, so
--    two rotisserie chickens on one receipt is a single row with quantity 2.
--    Thirteen shopping trips carrying twenty-two chickens reported "13 buys".
--    Trips and units are different questions, so the function now returns
--    both and the screen says which is which.
--
--    quantity is numeric and 'lb' rows carry fractional values, so unit_count
--    is numeric rather than an integer count.
--
-- 2. Nothing could answer "when did I last buy this, and what did I pay?"
--    get_item_purchase_history returns exactly that, keyed on the same
--    group_key the items list is grouped by so the two cannot disagree about
--    what counts as the same item.
--
-- Both are SECURITY DEFINER, which BYPASSES RLS rather than inheriting it, so
-- household scoping is an explicit WHERE on receipts — receipt_items carries
-- no household_id of its own.
-- ---------------------------------------------------------------------------

-- The return type changes, and CREATE OR REPLACE cannot do that.
DROP FUNCTION IF EXISTS get_top_items_by_spend(int, int);

CREATE OR REPLACE FUNCTION get_top_items_by_spend(
  p_months int DEFAULT 12,
  p_limit  int DEFAULT 10,
  -- Optional name filter, so the search field and the list share one query
  -- and therefore one definition of a group.
  p_query  text DEFAULT NULL
)
RETURNS TABLE(
  group_key      text,
  item_id        uuid,
  display_name   text,
  category       text,
  total_spend    numeric,
  purchase_count bigint,
  unit_count     numeric,
  last_bought    date,
  recent_prices  numeric[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(ri.matched_item_id::text, lower(trim(ri.item_name))) AS group_key,
    (array_agg(ri.matched_item_id))[1] AS item_id,
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
    SUM(ri.quantity) AS unit_count,
    MAX(r.receipt_date) AS last_bought,
    (array_agg(ri.unit_price ORDER BY r.receipt_date DESC)
       FILTER (WHERE ri.unit_price IS NOT NULL))[1:8] AS recent_prices
  FROM receipt_items ri
  JOIN receipts r ON r.id = ri.receipt_id
  LEFT JOIN items i ON i.id = ri.matched_item_id
  WHERE
    r.household_id = current_household_id()
    AND r.receipt_date >= (CURRENT_DATE - (p_months || ' months')::interval)::date
    AND (
      p_query IS NULL
      OR trim(p_query) = ''
      -- Matched rows are searched by their catalog name as well, since that is
      -- the name the list displays.
      OR ri.item_name ILIKE '%' || trim(p_query) || '%'
      OR i.name ILIKE '%' || trim(p_query) || '%'
    )
  GROUP BY COALESCE(ri.matched_item_id::text, lower(trim(ri.item_name)))
  ORDER BY SUM(COALESCE(ri.total_price, ri.unit_price * ri.quantity, 0)) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- Every purchase of one item: date, store, price.
--
-- p_group_key is the same value get_top_items_by_spend returns, so tapping a
-- row cannot land on a different grouping than the row was computed from.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_item_purchase_history(
  p_group_key text,
  p_months    int DEFAULT 12
)
RETURNS TABLE(
  receipt_id   uuid,
  receipt_date date,
  store_name   text,
  item_name    text,
  quantity     numeric,
  unit_price   numeric,
  total_price  numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.receipt_date,
    s.name,
    ri.item_name,
    ri.quantity,
    ri.unit_price,
    COALESCE(ri.total_price, ri.unit_price * ri.quantity) AS total_price
  FROM receipt_items ri
  JOIN receipts r ON r.id = ri.receipt_id
  LEFT JOIN stores s ON s.id = r.store_id
  WHERE
    r.household_id = current_household_id()
    AND r.receipt_date >= (CURRENT_DATE - (p_months || ' months')::interval)::date
    AND COALESCE(ri.matched_item_id::text, lower(trim(ri.item_name))) = p_group_key
  ORDER BY r.receipt_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
