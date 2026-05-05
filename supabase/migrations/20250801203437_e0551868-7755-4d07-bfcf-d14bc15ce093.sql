-- Actualizar organización con configuración temporal para testing
UPDATE organizations 
SET 
  shopify_store_url = 'https://dosmicos.myshopify.com',
  shopify_credentials = jsonb_build_object(
    'store_domain', 'dosmicos.myshopify.com',
    'access_token', 'PLACEHOLDER_TOKEN'
  ),
  updated_at = now()
WHERE name = 'Dosmicos';