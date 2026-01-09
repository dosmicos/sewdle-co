-- Insert default WhatsApp channel for Dosmicos organization
INSERT INTO messaging_channels (
  organization_id,
  channel_type,
  channel_name,
  meta_phone_number_id,
  meta_account_id,
  is_active
) VALUES (
  'cb497af2-3f29-4bb4-be53-91b7f19e5ffb',
  'whatsapp',
  'Dosmicos WhatsApp',
  '883084988230419',
  '895116936356270',
  true
) ON CONFLICT DO NOTHING;