-- Ejecutar manualmente el recálculo de estado de sincronización para las entregas específicas
UPDATE deliveries 
SET synced_to_shopify = (
  SELECT CASE 
    WHEN COUNT(*) = 0 THEN false
    ELSE COUNT(*) = COUNT(*) FILTER (WHERE synced_to_shopify = true OR quantity_approved = 0)
  END
  FROM delivery_items 
  WHERE delivery_items.delivery_id = deliveries.id
),
sync_error_message = CASE 
  WHEN (
    SELECT CASE 
      WHEN COUNT(*) = 0 THEN false
      ELSE COUNT(*) = COUNT(*) FILTER (WHERE synced_to_shopify = true OR quantity_approved = 0)
    END
    FROM delivery_items 
    WHERE delivery_items.delivery_id = deliveries.id
  ) THEN NULL
  ELSE sync_error_message
END,
updated_at = now()
WHERE id IN ('3f3333d9-5d06-477b-9a38-d7505da3ba46', 'faed08a0-1dfb-43ea-a331-5d6dc6c9f0bf', 'c416c5e0-4e9d-4e3e-85d1-f9a6f02a0957');