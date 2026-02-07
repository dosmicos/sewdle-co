

# Fix: days_of_supply debe usar la velocidad ajustada

## Problema confirmado

En la funcion `refresh_inventory_replenishment` (migracion mas reciente `20260206145019`), lineas 181-185:

```text
-- Dias de suministro (BUGGY)
CASE 
  WHEN sales.sales_30d > 0 AND sd.current_stock > 0
  THEN ROUND((sd.current_stock::numeric * 30) / sales.sales_30d, 1)
  ELSE NULL 
END as days_of_supply
```

Esta formula equivale a `stock / (sales_30d / 30)`, es decir, siempre divide entre 30 dias. Pero `avg_daily_sales` (lineas 165-179) ya usa la velocidad ajustada dividiendo entre dias con stock. Resultado: los dos valores son inconsistentes.

## Solucion

Reemplazar el calculo de `days_of_supply` para que replique la misma logica de prioridades que `avg_daily_sales`, calculando `current_stock / velocidad_ajustada`:

```text
CASE
  -- P1: stock / velocidad ajustada 30d
  WHEN COALESCE(stk.days_with_stock_30d, 0) >= 5 AND COALESCE(sales.sales_30d, 0) > 0 AND COALESCE(sd.current_stock, 0) > 0
  THEN ROUND(sd.current_stock::numeric / (sales.sales_30d::numeric / stk.days_with_stock_30d), 1)
  -- P2: stock / velocidad ajustada 90d
  WHEN COALESCE(stk.days_with_stock_90d, 0) >= 5 AND COALESCE(s90.sales_90d, 0) > 0 AND COALESCE(sd.current_stock, 0) > 0
  THEN ROUND(sd.current_stock::numeric / (s90.sales_90d::numeric / stk.days_with_stock_90d), 1)
  -- P3: stock / velocidad simple 30d
  WHEN COALESCE(sales.sales_30d, 0) > 0 AND COALESCE(sd.current_stock, 0) > 0
  THEN ROUND(sd.current_stock::numeric / (sales.sales_30d::numeric / 30), 1)
  -- P4: stock / velocidad historica guardada
  WHEN COALESCE(lv.saved_velocity, 0) > 0 AND COALESCE(sd.current_stock, 0) > 0
  THEN ROUND(sd.current_stock::numeric / lv.saved_velocity, 1)
  ELSE NULL
END as days_of_supply
```

## Cambio requerido

### 1. Nueva migracion SQL

Se creara un `CREATE OR REPLACE FUNCTION refresh_inventory_replenishment` que es identico al actual excepto por las lineas 181-185, donde se reemplaza la formula naive con la formula ajustada mostrada arriba.

No se necesitan cambios en el frontend ni en la vista `v_replenishment_details` — la vista ya lee `days_of_supply` directamente de la tabla.

## Resultado esperado

Para la variante 47176267464939 (11 ventas, 11 dias con stock, 7 unidades):
- Antes: days_of_supply = 7 * 30 / 11 = **19.1 dias** (medium)
- Despues: days_of_supply = 7 / (11/11) = **7.0 dias** (critical)

Para la variante 46656050168043 (25 ventas, 30 dias con stock, 38 unidades):
- Antes: 38 * 30 / 25 = **45.6 dias** (low)
- Despues: 38 / (25/30) = **45.6 dias** (low) -- sin cambio porque tuvo stock los 30 dias

## Archivo

1. Nueva migracion SQL en `supabase/migrations/` con `CREATE OR REPLACE FUNCTION`

