# Fix: guías faltantes al crear manifiestos (Coordinadora / Interrapidísimo)

> **Para trabajadores agénticos:** usar superpowers:executing-plans para implementar. Los pasos usan checkbox (`- [ ]`).

**Goal:** Que el diálogo "Crear Manifiesto" muestre TODAS las guías pendientes de una transportadora (sin perder las que ya avanzaron de estado), para que el manifiesto refleje el conteo físico.

**Architecture:** El listado de candidatas se arma hoy desde la API externa de Envia (`queries.envia.com`) con un filtro de estado `=== 'created'` y SIN respaldo de la base local. Lo migramos a usar la tabla local `shipping_labels` como fuente de verdad (ahora confiable porque el nuevo `envia-tracking-webhook` mantiene `status` al día), con match de carrier **normalizado**, ventana de fechas en hora Colombia, y un criterio de "pendiente de manifestar" que NO descarte guías ya admitidas por la transportadora. Se añade normalización del carrier en escritura + backfill, y endurecimientos defensivos en la creación.

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), PostgreSQL (migraciones SQL), React + TypeScript (Vite), hook `useShippingManifests`.

---

## Causa raíz (confirmada con datos de producción)

- Los manifiestos guardados están íntegros: `total_packages == count(manifest_items)` en TODOS (`faltantes = 0`). → La capa de persistencia NO es el problema.
- Las guías "faltantes" se crearon **horas antes** del manifiesto y hoy están en `in_transit`:
  - COO-20260624-001 creado 16:44 → faltantes creadas 10:42 y 14:10.
  - COO-20260616-001 creado 18:07 → 13 faltantes creadas entre 08:37 y 09:18.
- Mecanismo: el candidato se arma desde la API de Envia filtrando `status === 'created'` y **sin respaldo de DB** (`envia-list-shipments/index.ts:151-258`, comentario "We do NOT supplement with DB guides"). Las guías que la transportadora ya admitió (→ `in_transit`) antes de crear el manifiesto desaparecen de la lista.
- Bug secundario: el carrier se guarda inconsistente — `interRapidisimo` (3.105 filas) y `interrapidisimo` (283). Cualquier `.eq('carrier', code)` se pierde la mayoría.

**Verificación reproducible (solo lectura):**
```sql
-- Guías por día (hora Colombia) creadas vs dentro de un manifiesto
SELECT (sl.created_at AT TIME ZONE 'America/Bogota')::date AS dia,
       count(*) AS creadas,
       count(*) FILTER (WHERE mi.id IS NOT NULL) AS en_manifiesto,
       count(*) FILTER (WHERE mi.id IS NULL)     AS fuera
FROM shipping_labels sl
LEFT JOIN manifest_items mi ON mi.tracking_number = sl.tracking_number
WHERE sl.carrier ILIKE 'coordinadora'
  AND sl.status NOT IN ('cancelled','error')
  AND sl.created_at >= now() - interval '14 days'
GROUP BY 1 ORDER BY 1 DESC;
```

---

## ⚠️ Decisiones de producto a confirmar ANTES de implementar

1. **¿Qué guías deben aparecer como candidatas?** Propuesta: las de la transportadora, dentro de la ventana, que **no** estén ya en un manifiesto (abierto/cerrado/recogido) y cuyo estado **no** sea final (`cancelled`, `error`, `delivered`, `returned`). Esto **incluye** `created` e `in_transit`-no-manifestadas. ¿De acuerdo, o solo `created` + `in_transit` del día?
2. **Ventana de fechas:** hoy son 7 días. ¿Se mantiene?
3. **Excluir manifiestos abiertos también:** hoy solo excluye `closed`/`picked_up` (permite re-crear). ¿Queremos excluir también `open` para no duplicar guías entre dos manifiestos abiertos del mismo día?
4. **Histórico:** ¿reconciliamos las guías que ya se despacharon sin manifiesto (≈222 Coordinadora + 28 Interrapidísimo en 30 días)? ¿Crear manifiestos retroactivos o solo un reporte?

> **Decisión final (implementada):** candidatas = `created` de los últimos 7 días **+** `in_transit` de hoy/ayer (recupera las que saltan de estado el mismo día sin resucitar las ya despachadas), que **no** estén en ningún manifiesto (`open`/`closed`/`picked_up`). Histórico ignorado. El operario confirma escaneando físicamente. Verificado con datos: ahora mismo hay 0 guías en estado `created` pendientes (todas saltan a `in_transit` en segundos), por lo que el filtro viejo daría ~0 candidatas.

---

## File Structure

- **Crear** `supabase/functions/_shared/carrier.ts` — normalización canónica del carrier (única fuente de verdad para escritura y match).
- **Crear** `supabase/functions/_shared/carrier.test.ts` — test unitario Deno de la normalización.
- **Modificar** `supabase/functions/create-envia-label/index.ts` (~1170) — guardar `carrier` ya normalizado.
- **Modificar** `supabase/functions/envia-list-shipments/index.ts` — fuente local + match normalizado + ventana TZ + estado pendiente + excluir manifestadas.
- **Crear** `supabase/migrations/<ts>_normalize_carrier_values.sql` — backfill `interRapidisimo` → `interrapidisimo` (y otras variantes) + índice case-insensitive.
- **Modificar** `src/hooks/useShippingManifests.ts` — `getAvailableLabels` con carrier normalizado; `createManifest` defensivo (dedupe por tracking, reconciliar `total_packages`).
- **Modificar** `src/components/shipping/ManifestCreationModal.tsx` — copy ("estado: creada" → "pendientes"), dedupe por tracking antes de crear.
- **Crear** `docs/superpowers/plans/reconciliacion-guias-sin-manifiesto.sql` — consultas de reconciliación histórica.

---

## Task 1: Helper de normalización de carrier (con test)

**Files:**
- Create: `supabase/functions/_shared/carrier.ts`
- Test: `supabase/functions/_shared/carrier.test.ts`

- [ ] **Step 1: Escribir el test que falla**
```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canonicalCarrier } from "./carrier.ts";

Deno.test("normaliza variantes de Interrapidísimo", () => {
  for (const v of ["interRapidisimo", "Interrapidísimo", "INTERRAPIDISIMO", " inter rapidisimo "]) {
    assertEquals(canonicalCarrier(v), "interrapidisimo");
  }
});
Deno.test("normaliza Coordinadora y Deprisa", () => {
  assertEquals(canonicalCarrier("Coordinadora"), "coordinadora");
  assertEquals(canonicalCarrier("DEPRISA"), "deprisa");
});
Deno.test("desconocido cae a slug minúsculo sin tildes", () => {
  assertEquals(canonicalCarrier("Servientrega S.A."), "servientrega");
});
```

- [ ] **Step 2: Correr y ver fallar** — `deno test supabase/functions/_shared/carrier.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar mínimo**
```ts
// Canónicos soportados (códigos internos en minúscula sin tildes).
const CANON = ["coordinadora", "interrapidisimo", "deprisa", "servientrega", "tcc", "envia"] as const;
export type CarrierCanon = typeof CANON[number] | string;

export function canonicalCarrier(raw: string | null | undefined): string {
  const n = (raw || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const hit = CANON.find((c) => n.includes(c) || c.includes(n));
  return hit || n;
}
```

- [ ] **Step 4: Correr y ver pasar** — `deno test supabase/functions/_shared/carrier.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add supabase/functions/_shared/carrier.ts supabase/functions/_shared/carrier.test.ts && git commit -m "feat(shipping): helper canonicalCarrier con test"`

---

## Task 2: Guardar carrier normalizado al crear la guía

**Files:** Modify `supabase/functions/create-envia-label/index.ts` (~1170, donde se arma el insert a `shipping_labels`).

- [ ] **Step 1:** Importar `canonicalCarrier` desde `../_shared/carrier.ts`.
- [ ] **Step 2:** Cambiar `carrier: shipmentData.carrier || carrierConfig.carrier` por `carrier: canonicalCarrier(shipmentData.carrier || carrierConfig.carrier)`.
- [ ] **Step 3: Verificar** — generar una guía de prueba en staging y confirmar `SELECT carrier FROM shipping_labels ORDER BY created_at DESC LIMIT 1;` → `interrapidisimo` (minúscula).
- [ ] **Step 4: Commit** — `git commit -am "fix(shipping): normalizar carrier al guardar la guía"`

---

## Task 3: Backfill de carrier + índice case-insensitive (migración)

**Files:** Create `supabase/migrations/<timestamp>_normalize_carrier_values.sql`

- [ ] **Step 1: Escribir la migración**
```sql
-- Unifica variantes históricas (p. ej. 'interRapidisimo' → 'interrapidisimo')
UPDATE public.shipping_labels
SET carrier = lower(translate(carrier, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou'))
WHERE carrier <> lower(translate(carrier, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou'));

-- Índice para acelerar el filtrado por carrier en la ventana reciente
CREATE INDEX IF NOT EXISTS idx_shipping_labels_carrier_created
  ON public.shipping_labels (carrier, created_at DESC);
```
- [ ] **Step 2: Validar en rama/staging primero** (no aplicar directo a prod sin revisar). Conteo previo:
  `SELECT carrier, count(*) FROM shipping_labels GROUP BY carrier;`
- [ ] **Step 3: Aplicar** vía PR de migración (no `apply_migration` directo a producción sin aprobación).
- [ ] **Step 4: Verificar** — el `GROUP BY carrier` ya no muestra `interRapidisimo`.
- [ ] **Step 5: Commit** — `git commit -am "fix(shipping): backfill de carrier inconsistente + índice"`

---

## Task 4: `envia-list-shipments` → fuente local confiable

**Files:** Modify `supabase/functions/envia-list-shipments/index.ts`

- [ ] **Step 1:** Importar `canonicalCarrier`. Calcular la ventana de fechas con TZ correcta (límites en hora Colombia, p. ej. `cutoff` = `today_bogota - 7d`, comparando contra `created_at AT TIME ZONE 'America/Bogota'` en la query).
- [ ] **Step 2:** Reescribir la rama de candidatos para que **la base local sea la fuente principal** (no solo fallback):
```ts
// Candidatas = labels de la org, carrier canónico, en ventana,
// estado NO final, y NO ya en un manifiesto.
let q = supabase.from('shipping_labels')
  .select('id, shopify_order_id, order_number, tracking_number, carrier, recipient_name, destination_city, created_at, shipment_id, status')
  .eq('organization_id', orgId)
  .not('tracking_number', 'is', null)
  .not('status', 'in', '("cancelled","error","delivered","returned")')
  .gte('created_at', cutoffIsoUtc); // derivado del día Colombia
if (body.carrier) q = q.eq('carrier', canonicalCarrier(body.carrier));
```
- [ ] **Step 3:** Excluir guías ya presentes en cualquier manifiesto `open`/`closed`/`picked_up` (no solo cerrados) — reutilizar el bloque actual ampliando los estados, comparando por `tracking_number`.
- [ ] **Step 4:** Mantener la API de Envia **solo como enriquecimiento opcional** (metadata) o como respaldo si la DB viene vacía; quitar el filtro duro `status === 'created'` como criterio de inclusión.
- [ ] **Step 5: Verificar (la prueba de oro)** — para un día con faltantes conocidas (p. ej. 2026-06-24), el conteo devuelto por la función debe igualar:
```sql
SELECT count(*) FROM shipping_labels sl
LEFT JOIN manifest_items mi ON mi.tracking_number = sl.tracking_number
WHERE sl.carrier = 'coordinadora'
  AND sl.status NOT IN ('cancelled','error','delivered','returned')
  AND mi.id IS NULL
  AND (sl.created_at AT TIME ZONE 'America/Bogota')::date = '2026-06-24';
```
- [ ] **Step 6: Commit** — `git commit -am "fix(shipping): candidatas del manifiesto desde DB local (no solo API Envia)"`

---

## Task 5: Endurecer la creación (defensivo, sin romper lo que funciona)

**Files:** Modify `src/hooks/useShippingManifests.ts` (`createManifest`, `getAvailableLabels`), `src/components/shipping/ManifestCreationModal.tsx`

- [ ] **Step 1:** En `createManifest`, **deduplicar `shipments` por `tracking_number`** antes de armar stubs e items (evita abortos por el índice único `(manifest_id, tracking_number)`).
- [ ] **Step 2:** Fijar `total_packages: itemsToInsert.length` (no `shipments.length`) para que el header nunca mienta; convertir el `console.warn` de descarte en un `toast`/telemetría visible.
- [ ] **Step 3:** En `getAvailableLabels`, normalizar el carrier (`canonicalCarrier` equivalente en TS) en vez de `.eq('carrier', carrier)` literal.
- [ ] **Step 4:** En el modal, deduplicar por `tracking_number` al construir `selected`; actualizar copy "estado: creada" → "pendientes de manifestar".
- [ ] **Step 5: Verificar** — crear un manifiesto de prueba en staging con guías repetidas/avanzadas y confirmar que `total_packages == count(manifest_items)` y que no se pierde ninguna.
- [ ] **Step 6: Commit** — `git commit -am "fix(shipping): dedupe + conteo fiel + carrier normalizado en creación"`

---

## Task 6: Reconciliación histórica (reporte)

**Files:** Create `docs/superpowers/plans/reconciliacion-guias-sin-manifiesto.sql`

- [ ] **Step 1:** Consulta de guías despachadas sin manifiesto (por carrier/día) para que el equipo decida si crear manifiestos retroactivos:
```sql
SELECT sl.carrier, (sl.created_at AT TIME ZONE 'America/Bogota')::date AS dia,
       count(*) AS sin_manifiesto
FROM shipping_labels sl
LEFT JOIN manifest_items mi ON mi.tracking_number = sl.tracking_number
WHERE mi.id IS NULL
  AND sl.status NOT IN ('cancelled','error')
  AND sl.created_at >= now() - interval '60 days'
GROUP BY 1,2 ORDER BY 2 DESC, 1;
```
- [ ] **Step 2:** Documentar la decisión (reporte vs manifiestos retroactivos) y, si aplica, un script de inserción retroactiva controlado.
- [ ] **Step 3: Commit** — `git commit -am "docs(shipping): reconciliación de guías sin manifiesto"`

---

## Estrategia de pruebas y despliegue

- **Unitario:** `canonicalCarrier` (Task 1, Deno test).
- **Datos (antes/después):** las consultas de verificación de Task 4/6 deben dar `fuera = 0` para días nuevos tras el fix.
- **Manual/staging:** generar guías, dejar que algunas avancen a `in_transit`, crear manifiesto y confirmar que aparecen todas.
- **Despliegue:** primero migración (Task 3) y edge functions en **staging**; validar; luego producción. Las edge functions se redepliegan con `supabase functions deploy`.

## Riesgos

- **Sobre-inclusión:** mostrar `in_transit`-no-manifestadas podría listar guías genuinamente ya enviadas días atrás. Mitigado por la ventana (7 días) y excluir las ya manifestadas; el operador puede deseleccionar.
- **Cobertura del webhook:** si `envia-tracking-webhook` no recibe eventos de algún carrier, el status local podría quedarse en `created` (no rompe el fix: igual se incluyen).
- **Migración de carrier:** el `UPDATE` masivo debe correr en horario valle y validado en staging.
- **Edge function:** cambiar la fuente de datos afecta a todos los carriers; validar Coordinadora, Interrapidísimo y Deprisa.
