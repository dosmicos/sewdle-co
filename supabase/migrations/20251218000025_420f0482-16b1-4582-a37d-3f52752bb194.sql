-- Drop the existing unique index that prevents multiple labels per order
DROP INDEX IF EXISTS idx_shipping_labels_unique_order;

-- Create a new partial unique index that only enforces uniqueness for ACTIVE labels
-- This allows multiple cancelled/error labels for the same order, but only ONE active label
CREATE UNIQUE INDEX idx_shipping_labels_unique_active_order 
ON shipping_labels (organization_id, shopify_order_id) 
WHERE status NOT IN ('cancelled', 'error');