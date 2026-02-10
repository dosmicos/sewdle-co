
# Auto-sincronizar al guardar la ultima variante pendiente

## Que se hara
Despues de guardar exitosamente una variante, el sistema verificara si **todas** las variantes de la entrega ya tienen datos de calidad guardados (approved + defective > 0). Si es asi, automaticamente ejecutara la sincronizacion de las variantes pendientes (las que no tengan `synced_to_shopify = true`).

## Cambio en `src/components/DeliveryDetails.tsx`

### En la funcion `saveVariantQuality` (despues del guardado exitoso, ~linea 356)
Agregar logica que:
1. Despues de la actualizacion optimista, revisar si **todas** las variantes ya tienen `quantity_approved > 0` o `quantity_defective > 0` (es decir, ya fueron revisadas)
2. Si todas estan revisadas, llamar automaticamente `syncAllPendingToShopify()` — que ya existe y solo sincroniza las que tienen `synced_to_shopify = false`
3. Si aun quedan variantes sin revisar, no hace nada (el usuario sigue guardando)

### Logica clave
```text
Guardar variante --> update DB --> optimistic UI --> toast "Guardado"
  --> Verificar: todas las variantes tienen quality data?
      SI --> syncAllPendingToShopify() (solo las no sincronizadas)
      NO --> continuar normalmente
```

## Resultado
- Guardar sigue siendo rapido (update DB + optimistic UI)
- Al terminar la ultima variante, la sincronizacion se dispara sola
- Si el usuario sincronizo algunas manualmente antes, esas se omiten
- El boton manual "Sincronizar Pendientes" sigue disponible como respaldo
