
# Separar guardado de sincronizacion en entregas

## Problema actual
Al guardar la ultima variante, el sistema automaticamente sincroniza TODAS las variantes con Shopify dentro del mismo flujo, bloqueando la UI por 5-15 segundos. El usuario no puede controlar cuando sincronizar.

## Solucion

### Cambios en `src/components/DeliveryDetails.tsx`

### 1. Simplificar `saveVariantQuality` (lineas 293-541)
- Eliminar el parametro `isLastVariant` y toda la logica de "ultima variante" (lineas 354-523)
- El guardado SOLO hace:
  1. Validar datos
  2. `supabase.update()` en `delivery_items` (rapido)
  3. Actualizar estado local optimistamente (sin esperar `loadDelivery`)
  4. Mostrar toast de exito inmediato
  5. Llamar `loadDelivery()` sin `await` para refrescar en segundo plano
- Mover la logica de subir evidencia y notas generales a funciones separadas que se llaman independientemente

### 2. Agregar funcion `syncAllPendingToShopify`
Nueva funcion que:
- Obtiene todas las variantes con `quantity_approved > 0` y `synced_to_shopify = false`
- Si no hay ninguna pendiente, muestra toast "Todo ya esta sincronizado"
- Si hay pendientes, las sincroniza todas en una sola llamada a la edge function
- NO resincroniza las que ya estan marcadas como `synced_to_shopify = true`

### 3. Simplificar botones por variante (lineas 1479-1517)
- El boton "Guardar" siempre llama `saveVariantQuality(item.id)` sin parametro `isLast`
- Todos los botones muestran solo "Guardar" (sin "Guardar y Finalizar Revision")
- Se mantiene el boton individual "Sincronizar" por variante para quien quiera sincronizar una sola

### 4. Agregar boton "Sincronizar Todo" al final de la seccion de calidad
Despues de la tabla de variantes, agregar un boton prominente:
- Texto: "Sincronizar Pendientes con Shopify (X)"
- Solo visible cuando hay variantes pendientes de sincronizacion (`quantity_approved > 0` y `synced_to_shopify = false`)
- Muestra el contador de variantes pendientes
- Al hacer clic, llama `syncAllPendingToShopify`
- Se deshabilita si ya esta sincronizando

### 5. Eliminar funcion `isLastUnsavedVariant` (lineas 276-284)
Ya no es necesaria porque no hay logica especial para la "ultima variante".

## Flujo resultante

```text
Usuario guarda variante 1 --> Solo update DB (~200ms) --> Toast "Guardado"
Usuario guarda variante 2 --> Solo update DB (~200ms) --> Toast "Guardado"
Usuario guarda variante N --> Solo update DB (~200ms) --> Toast "Guardado"

Opcion A: Clic "Sincronizar Todo (N)" --> Sincroniza solo las NO sincronizadas
Opcion B: Clic "Sincronizar" en variante individual --> Sincroniza esa sola
```

## Resultado
- Guardar tarda menos de 1 segundo
- El usuario decide cuando sincronizar
- "Sincronizar Todo" omite las ya sincronizadas
- Se mantiene la opcion de sincronizar individualmente
