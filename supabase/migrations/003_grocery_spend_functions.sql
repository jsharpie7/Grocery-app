-- RPC functions for analytics queries
-- Apply after 001_grocery_spend_schema.sql

-- Monthly spend for the current user's household.
-- NO household_id param — derives from current_household_id() to prevent privilege escalation.
-- Returns rows sorted by month ASC for chart rendering.
CREATE OR REPLACE FUNCTION get_monthly_spend(p_months int DEFAULT 12)
RETURNS TABLE(month text, total numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(date_trunc('month', receipt_date), 'YYYY-MM') AS month,
    SUM(total_amount) AS total
  FROM receipts
  WHERE
    household_id = current_household_id()
    AND receipt_date >= (CURRENT_DATE - (p_months || ' months')::interval)::date
  GROUP BY date_trunc('month', receipt_date)
  ORDER BY date_trunc('month', receipt_date) ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Per-store monthly spend for Insights page.
-- Also derives household from current_household_id().
CREATE OR REPLACE FUNCTION get_store_monthly_spend(p_months int DEFAULT 12)
RETURNS TABLE(store_id uuid, store_name text, month text, total numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS store_id,
    s.name AS store_name,
    to_char(date_trunc('month', r.receipt_date), 'YYYY-MM') AS month,
    SUM(r.total_amount) AS total
  FROM receipts r
  JOIN stores s ON s.id = r.store_id
  WHERE
    r.household_id = current_household_id()
    AND r.receipt_date >= (CURRENT_DATE - (p_months || ' months')::interval)::date
  GROUP BY s.id, s.name, date_trunc('month', r.receipt_date)
  ORDER BY date_trunc('month', r.receipt_date) ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
