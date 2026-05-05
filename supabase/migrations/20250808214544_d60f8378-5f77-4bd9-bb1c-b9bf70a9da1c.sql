-- Fix orphan delivery_payments by setting correct organization_id from deliveries
UPDATE public.delivery_payments 
SET organization_id = d.organization_id
FROM public.deliveries d
WHERE delivery_payments.delivery_id = d.id 
AND delivery_payments.organization_id IS NULL;

-- Fix orphan order_advances by setting correct organization_id from orders  
UPDATE public.order_advances
SET organization_id = o.organization_id
FROM public.orders o
WHERE order_advances.order_id = o.id
AND order_advances.organization_id IS NULL;