
# Plan: Corregir Bug Critico en Calculo de Ventas de Reposicion IA

## Diagnostico del Problema

Se encontro un **bug critico** en la funcion SQL `refresh_inventory_replenishment` que **infla las ventas 10x** o mas.

### Causa Raiz: LEFT JOIN sin filtro de fecha

La query actual usa dos LEFT JOINs encadenados:

```text
product_variants
  LEFT JOIN shopify_order_line_items (SIN filtro de fecha)  <-- BUG AQUI
    LEFT JOIN shopify_orders (con filtro de fecha en el JOIN)
```

El problema es que:
1. El primer LEFT JOIN une TODOS los line items historicos (sin filtro de fecha)
2. El segundo LEFT JOIN intenta filtrar por fecha, pero como esta en la condicion del JOIN (no en WHERE), cuando una orden no cumple el filtro, `soli.quantity` sigue existiendo
3. Resultado: `SUM(soli.quantity)` suma TODAS las ventas de la historia, no solo 30 dias

### Evidencia con datos reales

| SKU (Pollito T2) | Ventas calculadas | Ventas reales 30d | Inflacion |
|---|---|---|---|
| 46581502738667 | 787 | 79 | 10x |
| 46581502771435 | 532 | 32 | 16x |
| 46691151380715 | 310 | 23 | 13x |

Esto explica por que el sistema sugiere cantidades absurdas de produccion.

### Problema adicional: Ordenes canceladas de Shopify

La query actual no excluye ordenes canceladas de Shopify (donde `cancelled_at IS NOT NULL`). Para Pollito T2:
- Con ordenes pagadas + canceladas: 79 unidades
- Solo pagadas y no canceladas: 62 unidades

---

## Solucion

### 1. Corregir la query de ventas en la funcion SQL

Cambiar el CTE `sales_data` de LEFT JOINs a un sub-select o INNER JOIN con filtros en WHERE:

```sql
-- ANTES (BUGGY): LEFT JOIN sin filtro de fecha en line_items
sales_data AS (
    SELECT pv.id as variant_id,
      COALESCE(SUM(soli.quantity), 0) as sales_30d,
      COUNT(DISTINCT so.id) as orders_count_30d
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN shopify_order_line_items soli 
      ON soli.sku = pv.sku_variant          -- <-- SIN FECHA!
    LEFT JOIN shopify_orders so 
      ON soli.shopify_order_id = so.shopify_order_id 
      AND so.created_at >= NOW() - INTERVAL '30 days'  -- fecha solo en JOIN
    WHERE p.organization_id = org_id
    GROUP BY pv.id
)

-- DESPUES (CORRECTO): Calcular ventas por separado con INNER JOIN
sales_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(s.total_qty, 0) as sales_30d,
      COALESCE(s.order_count, 0) as orders_count_30d
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN LATERAL (
      SELECT 
        SUM(soli.quantity) as total_qty,
        COUNT(DISTINCT so.id) as order_count
      FROM shopify_order_line_items soli
      INNER JOIN shopify_orders so 
        ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '30 days'
        AND so.financial_status NOT IN ('refunded', 'voided')
        AND so.cancelled_at IS NULL
    ) s ON true
    WHERE p.organization_id = org_id
)
```

### 2. Mantener todas las correcciones anteriores

La funcion actualizada conservara:
- Filtro de ordenes por estado (excluyendo `cancelled` y `completed`)
- Uso de `quantity_delivered` en vez de `quantity_approved`
- Calculo de `in_transit` para items en control de calidad

### 3. Preservar registros "executed" y reducir ventana de demanda

Aprovechar esta migracion para incluir las mejoras del plan anterior aprobado:
- No borrar registros con `status = 'executed'` al recalcular
- Cambiar proyeccion de 40 dias a 21 dias de cobertura objetivo
- Filtrar sugerencias ejecutadas en el frontend

### 4. Agregar cobertura de pipeline en la UI

Agregar columna que muestre cuantos dias de venta cubre el pipeline actual.

---

## Resultado esperado con datos reales

| Producto | Ventas actuales (buggy) | Ventas reales 30d | Sugerencia actual | Sugerencia corregida |
|---|---|---|---|---|
| Pollito T2 | 787 | 62 | 848 | ~0 (pipeline > demanda) |
| Pollito T4 | 532 | 32 | ~480 | ~0 |
| Sleeping Walker | similar inflacion | datos reales | proporcional | razonable |

---

## Archivos a modificar

1. **Nueva migracion SQL** - `supabase/migrations/YYYYMMDD_fix_sales_calculation.sql`
   - Reescribir CTE `sales_data` con INNER JOIN y filtros correctos
   - Agregar filtro de `cancelled_at IS NULL`
   - Preservar registros `executed` al recalcular
   - Cambiar demanda de 40 a 21 dias
   - Actualizar vista `v_replenishment_details` con campo `pipeline_coverage_days`

2. **`src/hooks/useReplenishment.ts`**
   - Agregar filtro `.eq('status', 'pending')` al fetch
   - Agregar campo `pipeline_coverage_days` a la interface

3. **`src/hooks/useProductionOrders.ts`**
   - Agregar filtro de fecha al marcar como `executed`

4. **`src/components/supplies/ReplenishmentSuggestions.tsx`**
   - Agregar columna "Cobertura" con badge visual
   - Filtrar sugerencias ejecutadas
