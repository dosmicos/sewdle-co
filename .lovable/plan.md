

# Indicador visual de progreso para sincronizacion con Shopify

## Problema
Cuando se sincroniza (automatica o manualmente), el boton se queda "cargando" sin mostrar progreso real. No hay feedback visual de cuantas variantes se han procesado ni si el proceso funciono.

## Solucion

### 1. Nuevo estado de progreso de sincronizacion
Agregar estados en `DeliveryDetails.tsx`:
- `syncProgress`: objeto con `{ current: number, total: number, status: 'syncing' | 'done' | 'error' }` o `null` cuando no hay sync activo
- Este estado controla la barra de progreso y los mensajes

### 2. Modificar `syncAllPendingToShopify` para reportar progreso
Actualmente sincroniza todo en una sola llamada a la edge function. El progreso se mostrara en dos fases:
- Fase 1: "Enviando a Shopify..." (llamada a edge function)
- Fase 2: "Actualizando registros..." (marcando items como sincronizados en DB, uno por uno con progreso)

La funcion actualizara `syncProgress` en cada paso, mostrando el avance real.

### 3. Componente visual de progreso
Debajo del boton "Sincronizar Pendientes con Shopify", cuando `syncProgress` no es null, mostrar:
- Una barra de progreso (componente `Progress` de shadcn/ui que ya existe)
- Texto indicando fase actual: "Sincronizando con Shopify... (3/5 variantes)"
- Icono de spinner animado durante el proceso
- Icono de check verde al completarse exitosamente
- Icono de error rojo si falla

### 4. Deshabilitar botones durante sincronizacion
- El boton "Sincronizar Pendientes" se deshabilita mientras `syncProgress` no sea null
- Los botones individuales "Sincronizar" por variante tambien se deshabilitan
- El boton "Guardar" de cada variante sigue funcionando normalmente (no se bloquea)

## Cambios tecnicos en `src/components/DeliveryDetails.tsx`

**Nuevo estado (~linea 55):**
```
syncProgress: { current: number, total: number, phase: string } | null
```

**En `syncAllPendingToShopify` (~linea 391):**
- Al inicio: `setSyncProgress({ current: 0, total: pendingVariants.length, phase: 'Enviando a Shopify...' })`
- Despues del edge function call: actualizar fase a "Actualizando registros..."
- En el loop de `supabase.update()` por item: incrementar `current` en cada iteracion
- En `finally`: despues de 2 segundos, limpiar `setSyncProgress(null)`

**En el boton "Sincronizar Todo" (~linea 1465):**
- Agregar seccion debajo del boton que muestra la barra de progreso cuando `syncProgress !== null`
- Usar el componente `Progress` existente de `src/components/ui/progress.tsx`
- Mostrar texto descriptivo del progreso

**En el auto-sync (~linea 369):**
- La misma funcion `syncAllPendingToShopify` ya mostrara el progreso automaticamente

## Resultado visual
Al oprimir "Sincronizar Pendientes" o al auto-sincronizar:
1. Boton se deshabilita con spinner
2. Aparece barra de progreso debajo: "Enviando a Shopify... (0/5)"
3. Barra avanza: "Actualizando registros... (3/5)"
4. Barra llega a 100%: icono verde + "Sincronizacion completada"
5. Despues de 2 segundos, la barra desaparece
