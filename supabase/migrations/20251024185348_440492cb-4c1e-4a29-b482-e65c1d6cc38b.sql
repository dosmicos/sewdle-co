-- Increase max rows limit for pagination to handle more than 1000 orders
-- This allows the picking-packing module to fetch up to 10,000 orders
ALTER ROLE authenticator SET pgrst.max_rows = 10000;

-- Notify PostgREST to reload configuration
NOTIFY pgrst, 'reload config';