
# Plan: Corregir Cálculos de Reposición IA

## Diagnóstico del Problema

La sección de **Reposición IA** está sugiriendo cantidades incorrectas porque la función `refresh_inventory_replenishment` tiene tres errores de lógica:

### Problemas Identificados

| Problema | Impacto | Ejemplo Real |
|----------|---------|--------------|
| No filtra órdenes por estado | Suma cantidades de órdenes completadas/canceladas | Órdenes `completed` siguen contando como pendientes |
| Usa `quantity_approved` en vez de `quantity_delivered` | No considera productos ya entregados pero en control de calidad | "Sleeping Walker Ovejita" muestra 8 pendientes cuando son 5 |
| Ignora entregas "en tránsito" | Productos entregados pero no aprobados no se descuentan | 3 unidades en `in_quality` no se consideran |

### Datos de Ejemplo (Sleeping Walker de Ovejita TOG 2.0)

```text
┌────────────────────────────────────────────┐
│ CÁLCULO ACTUAL (INCORRECTO)                │
├────────────────────────────────────────────┤
│ Ordenado total:          24 unidades       │
│ Aprobado:                16 unidades       │
│ Pendiente producción:    24 - 16 = 8       │
│ Sugerencia:              9 unidades        │ ← SOBRE-SUGIERE
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ CÁLCULO CORRECTO                           │
├────────────────────────────────────────────┤
│ Ordenado (no cancelado):  24 unidades      │
│ Entregado (delivered):    19 unidades      │
│ Pendiente producción:     24 - 19 = 5      │
│ Sugerencia:               6 unidades       │ ← CORRECTO
└────────────────────────────────────────────┘
```

---

## Solución Propuesta

### 1. Actualizar Función `refresh_inventory_replenishment`

Modificar la función SQL para:

**a) Filtrar órdenes activas:**
```sql
-- ANTES (suma todas las órdenes)
SELECT SUM(oi.quantity) as pending_qty
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
WHERE oi.product_variant_id = pv.id

-- DESPUÉS (solo órdenes no completadas/canceladas)
SELECT SUM(oi.quantity) as pending_qty
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
WHERE oi.product_variant_id = pv.id
  AND o.status NOT IN ('cancelled', 'completed')
```

**b) Usar quantity_delivered en vez de quantity_approved:**
```sql
-- ANTES
SUM(di.quantity_approved) as total_delivered

-- DESPUÉS
SUM(di.quantity_delivered) as total_delivered
```

**c) Agregar columna "en_transito" para mostrar productos en control de calidad:**
```sql
-- Nueva columna que muestra productos ya entregados pero pendientes de aprobación
SUM(CASE 
  WHEN d.status IN ('in_quality', 'partial_approved') 
  THEN di.quantity_delivered - COALESCE(di.quantity_approved, 0) 
  ELSE 0 
END) as in_transit
```

### 2. Actualizar Vista `v_replenishment_details`

Agregar columna `in_transit` para mostrar en la UI cuántos productos están en control de calidad.

### 3. Actualizar UI del Componente

Modificar `ReplenishmentSuggestions.tsx` para mostrar:
- **Pendientes**: Productos en producción (ordenados - entregados)
- **En Calidad**: Productos entregados pero pendientes de aprobación

---

## Cambios Técnicos Detallados

### Migración SQL

Se creará una nueva migración que:

1. **Elimina** la función actual `refresh_inventory_replenishment`
2. **Crea** una nueva versión con la lógica corregida
3. **Actualiza** la vista `v_replenishment_details` para incluir `in_transit`

```sql
-- Estructura de la nueva función (pseudocódigo)
CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  WITH 
  -- Ventas de Shopify (sin cambios)
  sales_data AS (...),
  
  -- NUEVO: Órdenes pendientes (excluye cancelled/completed)
  pending_orders AS (
    SELECT product_variant_id, SUM(quantity) as ordered_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status NOT IN ('cancelled', 'completed')
    GROUP BY product_variant_id
  ),
  
  -- NUEVO: Entregas usando quantity_delivered + in_transit
  delivery_data AS (
    SELECT 
      product_variant_id,
      SUM(quantity_delivered) as total_delivered,
      SUM(CASE WHEN status IN ('in_quality', 'partial_approved')
          THEN quantity_delivered - quantity_approved 
          ELSE 0 END) as in_transit
    FROM delivery_items di
    JOIN deliveries d ON di.delivery_id = d.id
    ...
  )
  
  INSERT INTO inventory_replenishment (
    ...,
    pending_production,  -- = ordered_qty - total_delivered
    in_transit,          -- NUEVA COLUMNA
    suggested_quantity   -- = demand_40d - stock - pending - in_transit
  )
  ...
END;
$$;
```

### Cambios en UI

Actualizar la tabla de sugerencias para mostrar:

| Columna Actual | Columna Nueva |
|----------------|---------------|
| "Pendientes" | "En Producción" (ordenado - entregado) |
| - | "En Calidad" (entregado - aprobado) |

---

## Archivos a Modificar

1. **Nueva migración SQL**: `supabase/migrations/YYYYMMDD_fix_replenishment_calculation.sql`
   - Función `refresh_inventory_replenishment` corregida
   - Vista `v_replenishment_details` actualizada
   - Nueva columna `in_transit` en tabla `inventory_replenishment`

2. **`src/hooks/useReplenishment.ts`**
   - Actualizar interface `ReplenishmentSuggestion` para incluir `in_transit`

3. **`src/components/supplies/ReplenishmentSuggestions.tsx`**
   - Agregar columna "En Calidad" a la tabla
   - Actualizar cálculo de totales seleccionados

---

## Resultados Esperados

Después de aplicar los cambios:

- Las sugerencias reflejarán correctamente los productos ya ordenados
- Los productos en control de calidad se mostrarán por separado
- La columna `suggested_quantity` será más precisa
- Se reducirá el riesgo de sobre-producción

---

## Notas de Implementación

- La migración agregará una nueva columna `in_transit` a la tabla `inventory_replenishment`
- Los usuarios deberán hacer clic en "Calcular Sugerencias" para ver los datos corregidos
- Los datos históricos no se actualizarán automáticamente
