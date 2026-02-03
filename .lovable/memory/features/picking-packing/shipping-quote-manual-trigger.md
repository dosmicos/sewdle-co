# Memory: features/picking-packing/shipping-quote-manual-trigger
Updated: 2026-02-03

Shipping quote requests in the Picking & Packing module are now **completely manual**. No automatic quote loading occurs when an order is opened. Instead:

1. **Idle State**: Shows a "Cotizar Envío" button + a compact carrier dropdown with basic options (Auto, Coordinadora, Inter Rápido, Deprisa)
2. **User Action Required**: User must click "Cotizar Envío" to fetch quotes from Envia.com API
3. **Single Attempt**: Each click triggers a single API call with 8-second timeout, no automatic retries
4. **Error State**: If the API fails, a prominent Alert shows with "Reintentar" button
5. **Success State**: Shows full carrier selector with prices and delivery types

This change prevents resource exhaustion and "buggy" behavior from excessive API calls when rapidly switching between orders. Users can still create labels without quotes by selecting a carrier from the basic dropdown and clicking "Crear Guía".
