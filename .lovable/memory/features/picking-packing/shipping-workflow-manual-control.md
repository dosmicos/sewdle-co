# Memory: features/picking-packing/shipping-workflow-manual-control
Updated: 2026-02-10

The shipping section in the Picking & Packing module provides manual control over logistics. It features two primary actions: 'Guía Manual' (for manual tracking registration) and 'Cotizar Envío' (carrier rates via Envia.com). Manual labels are hardcoded with carrier 'manual', record the 'created_by' user ID, and display tracking numbers as clickable links to 'https://envia.com/tracking?label={tracking_number}'. Successfully saving a manual label automatically invokes the 'fulfill-express-order' Edge Function to mark the order as 'Fulfilled' in Shopify if it is not already in that state. Each manual API call to Envia.com is protected by a request lock, AbortController, and a 10s timeout with exponential backoff.

## Auto-fetch on mount
The component now auto-fetches the existing label when the order changes (on mount/reopen), so manual labels persist across page reloads. Previously, the label was only fetched when the user clicked "Verificar Guía" which was removed.

## Creator display
Manual labels show "Registrada por: {nombre}" by fetching the profile name from `created_by`. History labels also show the creator name.
