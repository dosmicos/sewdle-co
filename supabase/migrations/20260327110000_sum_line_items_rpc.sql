-- RPC to sum line item quantities for a set of order IDs
-- Replaces 50+ individual batch queries with 1 server-side aggregation
CREATE OR REPLACE FUNCTION sum_order_line_items(
  p_org_id UUID,
  p_order_ids BIGINT[]
) RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(quantity), 0)::BIGINT
  FROM shopify_order_line_items
  WHERE organization_id = p_org_id
    AND shopify_order_id = ANY(p_order_ids);
$$ LANGUAGE sql STABLE SECURITY DEFINER;
