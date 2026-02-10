

# Cambiar notificacion "contactar creador" a 5 dias despues de entrega

## Cambio
Actualmente la notificacion "contactar creador" se genera cuando una campana lleva mas de 1 dia en estado `producto_enviado`. El nuevo comportamiento sera:

- Se genera cuando la campana lleva mas de **5 dias** en estado `producto_recibido` (es decir, el producto ya fue entregado y han pasado 5 dias sin avance)
- Ya no se revisa el estado `producto_enviado` para esta notificacion

## Archivo a modificar
`src/hooks/useUgcCampaignSync.ts`

## Cambio especifico (seccion 3, lineas 92-121)

**Antes:**
- Filtra campanas en `producto_enviado`
- Revisa si `updated_at` es mayor a 1 dia
- Mensaje: "lleva mas de 1 dia en Producto Enviado"

**Despues:**
- Filtra campanas en `producto_recibido`
- Revisa si `updated_at` es mayor a 5 dias (5 * 24 * 60 * 60 * 1000 ms)
- Mensaje: "El producto fue entregado hace mas de 5 dias. Contacta al creador para dar seguimiento a la campana"

No se modifica ninguna otra logica ni archivo.

