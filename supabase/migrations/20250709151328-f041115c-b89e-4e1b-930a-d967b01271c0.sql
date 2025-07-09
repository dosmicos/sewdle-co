-- Corregir el estado de la variante 46312745304299 para que se sincronice correctamente
UPDATE delivery_items 
SET synced_to_shopify = false,
    last_sync_attempt = NULL,
    sync_attempt_count = 0,
    sync_error_message = NULL
WHERE id = '981a997e-e63b-4214-87d3-fe211bd21664';