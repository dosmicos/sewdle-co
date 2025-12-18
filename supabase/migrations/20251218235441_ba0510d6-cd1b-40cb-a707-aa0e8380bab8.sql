UPDATE organizations 
SET shopify_credentials = jsonb_set(
  COALESCE(shopify_credentials, '{}'::jsonb), 
  '{access_token}', 
  '"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"'
),
updated_at = now()
WHERE id = 'cb497af2-3f29-4bb4-be53-91b7f19e5ffb';