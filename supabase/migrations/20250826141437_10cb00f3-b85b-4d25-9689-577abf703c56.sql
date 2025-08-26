-- Update the get_replenishment_suggestions_with_details function to include product_variant_id and order_id
CREATE OR REPLACE FUNCTION get_replenishment_suggestions_with_details(org_id UUID)
RETURNS TABLE (
    id UUID,
    product_variant_id UUID,
    order_id UUID,
    product_name TEXT,
    variant_name TEXT,
    sku TEXT,
    current_stock INTEGER,
    minimum_stock INTEGER,
    maximum_stock INTEGER,
    suggested_quantity INTEGER,
    urgency_level TEXT,
    reason TEXT,
    sales_last_30_days INTEGER,
    sales_last_7_days INTEGER,
    stock_days_remaining INTEGER,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rs.id,
        rs.product_variant_id,
        rs.order_id,
        p.name as product_name,
        pv.name as variant_name,
        pv.sku,
        rs.current_stock,
        rs.minimum_stock,
        rs.maximum_stock,
        rs.suggested_quantity,
        rs.urgency_level,
        rs.reason,
        rs.sales_last_30_days,
        rs.sales_last_7_days,
        rs.stock_days_remaining,
        rs.status,
        rs.created_at,
        rs.updated_at
    FROM replenishment_suggestions rs
    JOIN product_variants pv ON rs.product_variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
    WHERE rs.organization_id = org_id
    ORDER BY 
        CASE rs.urgency_level
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
        END,
        rs.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;