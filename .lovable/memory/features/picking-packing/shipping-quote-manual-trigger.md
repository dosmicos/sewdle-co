# Memory: features/picking-packing/shipping-quote-manual-trigger
Updated: 2026-02-04

The Picking & Packing module now has **completely separated and manual** shipping operations:

## Product Loading (Independent)
- Uses new `usePickingLineItems` hook with React Query
- 30-second staleTime for instant loading of visited orders
- 10-second timeout - shows "Error al cargar productos" with "Reintentar" button on failure
- Completely independent of Envia.com API calls

## Shipping Section (100% Manual)
- **Initial State**: Shows two buttons: "Verificar Guía" and "Cotizar Envío"
- User must click to trigger any shipping API calls - NO automatic loading
- "Puedes continuar preparando el pedido mientras tanto" message shown
- Each button triggers a single API call with 8-second timeout

## Error Handling
- Product errors show Alert with retry button, don't block rest of modal
- Shipping errors show orange Alert with "Reintentar" button
- Shipping failures don't affect product loading or order preparation

## Key Files
- `src/hooks/usePickingLineItems.ts` - New dedicated hook for line items
- `src/components/picking/PickingOrderDetailsModal.tsx` - Uses new hook
- `src/features/shipping/components/EnviaShippingButton.tsx` - Manual buttons
