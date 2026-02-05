
## Diagnóstico (con evidencia)

### 1) La base de datos sí tiene notas (al menos en algunos pedidos)
Consulta directa a Supabase (tabla `shopify_orders`):

- Orden **68642** → `note = "ok"` y `raw_data->>'note' = "ok"`
- Orden **68643** → `note = null` y `raw_data->>'note' = ""` (vacío)

Esto prueba dos cosas:
- El sistema **sí** puede almacenar notas en Supabase.
- Para algunos pedidos (ej. 68643) **la nota no está llegando / no se está actualizando** en la DB.

### 2) El UI está bloqueando su propio “cargar desde Supabase” (por un bug del parche de cache)
En `PickingOrderDetailsModal.tsx` hay dos efectos:
- Efecto A: “hidratar” `shopifyNote` desde `effectiveOrder.shopify_order.note` (lo que viene de Supabase)
- Efecto B: “background sync” llamando a edge function `update-shopify-order` acción `sync_from_shopify`

Hoy el efecto B hace esto:
- Marca `backgroundSyncDoneRef.current = key` **ANTES** de que el fetch termine.
- El efecto A, al ver `backgroundSyncDoneRef.current === key`, **sale temprano y NO setea `shopifyNote` desde la DB**.

Resultado:
- Aunque Supabase tenga nota (68642), el textarea puede quedarse vacío porque **nunca se hidrata desde DB**.
- Y como el background sync está fallando/abortando, tampoco llega a setear la nota desde Shopify.

### 3) El background sync está abortándose (no está completando)
En los logs de red del navegador aparecen llamadas a:
`POST /functions/v1/update-shopify-order` con `{"action":"sync_from_shopify"}`  
y el resultado es:
- **Error: “signal is aborted without reason”**

Esto coincide con el timeout de 3 segundos en el background sync:
```ts
{ timeoutMs: 3_000, signal: controller.signal }
```
Es decir:
- El sync en background se está cancelando por timeout (o abort), **y como ya marcamos “done” antes**, no reintenta.

### 4) El webhook de Shopify sí incluye `note` (pero no es suficiente para “siempre actualizado”)
En `supabase/functions/shopify-webhook/index.ts` el create guarda:
```ts
note: order.note || null
```
y el updateExistingOrder ya tiene guardia:
```ts
...(hasOwnProperty('note') ? { note: order.note || null } : {})
```
Entonces, a nivel código, “note” está contemplado.  
Pero para 68643 la DB está en null, lo que significa que:
- el webhook no llegó,
- o llegó sin `note`,
- o el `sync_from_shopify` (que debía corregir esto al abrir) está fallando por el abort.

## Objetivo del arreglo
1) Al abrir un pedido: mostrar **inmediato** lo que hay en Supabase (sin depender de Shopify).
2) En paralelo: refrescar desde Shopify sin bloquear y sin “romper” la hidratación desde DB.
3) Si el refresco en background falla/timeout: no bloquear UI y permitir reintentos futuros.
4) Mantener auto-guardado con debounce y sync a Shopify en background.

---

## Cambios propuestos (implementación)

### A) Corregir la lógica de “no sobrescribir con cache” sin bloquear la hidratación
En `src/components/picking/PickingOrderDetailsModal.tsx`:

1) Reemplazar el uso de `backgroundSyncDoneRef` como “candado global” para la hidratación.
   - La hidratación desde DB debe suceder siempre al cargar el pedido (primera vez por orderId).
   - El “no sobrescribir” debe aplicarse solo cuando:
     - ya trajimos una nota más fresca desde Shopify, o
     - el usuario está editando (hay cambios locales no guardados).

2) Introducir refs separados:
   - `hydratedKeyRef`: indica si ya se hidrató desde DB para `orderId`.
   - `syncInFlightKeyRef`: evita duplicar el request de sync.
   - `shopifyFreshKeyRef` (o `noteSourceRef`): marca que “esta nota ya viene de Shopify / es más fresca” para no volver a pisarla con un cache viejo.

Regla:
- **Siempre** hidratar desde DB en el primer render válido del pedido.
- Luego, si hay updates subsecuentes del cache:
  - solo aplicar si el usuario no está editando y no tenemos una nota “más fresca” desde Shopify.

### B) Hacer el background sync robusto: no marcar “done” hasta éxito + reintento si timeout
En el effect de background sync:

1) No asignar `backgroundSyncDoneRef.current = key` antes del fetch.
2) Usar `syncInFlightKeyRef`:
   - si está en flight para ese `key`, no disparar otra vez.
3) Si el request:
   - **éxito**: entonces sí marcar `shopifyFreshKeyRef = key` y actualizar estado/cache.
   - **abort/timeout/error**: limpiar `syncInFlightKeyRef` para permitir nuevos intentos (por ejemplo al reabrir modal o al navegar y volver).

4) Ajustar timeout:
   - El timeout de **3s** está causando aborts reales en producción.
   - Propuesta: **8–10s** para background (sigue sin bloquear UI, no hay spinner).
   - Alternativamente mantener 3s, pero entonces se requiere reintento automático; recomiendo subirlo y además optimizar la edge function (siguiente punto).

### C) Optimizar `sync_from_shopify` para que sea rápido y confiable
En `supabase/functions/update-shopify-order/index.ts`, caso `sync_from_shopify`:

1) Cambiar el GET a Shopify para pedir solo campos mínimos:
   - `fields=id,note,tags,updated_at`
   - Endpoint: `/orders/${id}.json?fields=id,note,tags,updated_at`

2) No actualizar `raw_data` (es grande, más lento, y no es necesario para sincronizar nota).
   - Solo actualizar:
     - `note`
     - `tags`
     - `updated_at_shopify`

3) (Recomendado) Resolver credenciales por organización (como `update-shopify-order-note`):
   - Hoy `update-shopify-order` depende de `SHOPIFY_STORE_DOMAIN` y `SHOPIFY_ACCESS_TOKEN` en env.
   - Si hay multi-organización o credenciales por org, esto falla intermitentemente.
   - Mejor: replicar la lógica “env → fallback DB” ya usada en `update-shopify-order-note`.

Resultado esperado:
- El background sync pasa a ser suficientemente rápido para no abortar.
- Y aunque Shopify tarde, el UI ya mostró la nota desde Supabase.

### D) Observabilidad mínima (sin “ensuciar” producción)
1) Reintroducir logs de diagnóstico pero controlados por `import.meta.env.DEV` o usando `logger.debug`.
2) Loggear en el modal solo eventos clave:
   - “hidraté desde DB” (con orderId y longitud de nota, no PII)
   - “background sync start/success/timeout”
3) En edge function, loggear:
   - tiempo total de request
   - nota recibida (solo longitud o string si es seguro para ustedes)

---

## Validación (pasos exactos)
1) Abrir pedido **68642**:
   - Debe mostrar “ok” inmediatamente (desde Supabase), sin esperar Shopify.
2) Abrir pedido **68643**:
   - Si Supabase está en null, puede abrir vacío inicialmente.
   - Dentro de ~1–10s (background), debe actualizarse automáticamente con la nota de Shopify si existe.
3) Editar nota en Sewdle:
   - Debe verse “Guardando…” → “Guardado ✓” sin depender de Shopify.
   - Si Shopify falla, debe pasar a estado “pending_sync” y reintentar.
4) Cambiar nota en Shopify y volver a abrir en Sewdle:
   - Debe reflejar cambio automáticamente al abrir (sin botón manual).

---

## Archivos a tocar
1) `src/components/picking/PickingOrderDetailsModal.tsx`
   - Arreglar hidratación + flags correctos + robustecer background sync.
2) `supabase/functions/update-shopify-order/index.ts`
   - Optimizar `sync_from_shopify` (fields mínimos, sin raw_data, mejor credenciales).

---

## Resultado final esperado
- Las notas se ven siempre “de una” desde Supabase (cuando existan).
- La verificación con Shopify ocurre en background sin bloquear y sin requerir botón.
- Si hay notas en Shopify que no están en Supabase, se corrige automáticamente al abrir.
- El sistema deja de depender de un request que hoy se aborta por timeout y además deja el UI sin hidratar.

## Próximas mejoras (opcionales)
- Mantener el botón de refresh solo como “forzar actualización” y esconderlo detrás de un icono más discreto.
- Agregar un “última sincronización” (timestamp) pequeño para auditoría interna.
- Programar un job/cron de reconciliación (si quieren garantizar convergencia incluso si webhooks fallan).
