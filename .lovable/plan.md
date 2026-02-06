
# Plan: Guardar Ultima Velocidad Conocida como Fallback Permanente

## Problema

Cuando un producto lleva mas de 90 dias sin stock, tanto la ventana de 30 dias como la de 90 dias muestran 0 ventas. El sistema sugiere producir 0 unidades, aunque el producto era muy popular antes de agotarse.

```text
Ejemplo: Ruana Pony T6
- Oct-Nov: Vendia 0.7 unidades/dia (popular)
- Diciembre 1: Se agota, no hay manera de producir
- Febrero 6 (hoy): 67 dias sin stock
  -> Ventana 30d: 0 ventas / 0 dias = 0 velocidad
  -> Ventana 90d: todavia tiene datos (67 < 90)
  
Si pasan 90+ dias:
  -> Ventana 90d: 0 ventas / 0 dias = 0 velocidad
  -> Sistema sugiere: 0 unidades  <-- MAL
```

## Solucion: Ultima Velocidad Conocida

Guardar la velocidad de venta calculada cada vez que se ejecuta el calculo. Si en el futuro no hay ventas recientes ni en 30 ni en 90 dias, usar la ultima velocidad guardada como fallback.

### Flujo logico:

```text
1. Calcular ventas 30d con dias de stock disponible
2. Si hay datos 30d (>= 5 dias con stock) -> usar velocidad 30d
3. Si no, calcular ventas 90d con dias de stock disponible
4. Si hay datos 90d (>= 5 dias con stock) -> usar velocidad 90d
5. Si no hay datos en ninguna ventana:
   -> Buscar ultima velocidad guardada en inventory_replenishment
   -> Usar esa velocidad con data_confidence = 'low'
   -> Etiquetar con reason = 'Vel. historica guardada'
6. Guardar siempre la velocidad calculada para uso futuro
```

## Cambios Tecnicos

### 1. Nueva columna en `inventory_replenishment`: `last_known_velocity`

Agregar una columna `last_known_velocity` (numeric) para almacenar la velocidad calculada cada vez que se procesa una variante con ventas reales. Esta columna sirve como memoria permanente.

### 2. Actualizar funcion SQL `refresh_inventory_replenishment`

Agregar 3 CTEs nuevos a la funcion:

**CTE `sales_90d`** - Ventas en ventana de 90 dias:
```sql
sales_90d AS (
  SELECT pv.id as variant_id, COALESCE(s.total_qty, 0) as sales_90d
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  LEFT JOIN LATERAL (
    SELECT SUM(soli.quantity) as total_qty
    FROM shopify_order_line_items soli
    INNER JOIN shopify_orders so ON ...
    WHERE so.created_at >= NOW() - INTERVAL '90 days'
      AND so.cancelled_at IS NULL
      AND so.financial_status NOT IN ('refunded', 'voided')
  ) s ON true
  WHERE p.organization_id = org_id
)
```

**CTE `stock_days`** - Dias con stock disponible en cada ventana:
```sql
stock_days AS (
  SELECT psh.product_variant_id as variant_id,
    COUNT(DISTINCT CASE 
      WHEN psh.recorded_at >= NOW() - INTERVAL '30 days' AND psh.stock_quantity > 0
      THEN DATE(psh.recorded_at) END) as days_with_stock_30d,
    COUNT(DISTINCT CASE 
      WHEN psh.stock_quantity > 0 
      THEN DATE(psh.recorded_at) END) as days_with_stock_90d
  FROM product_stock_history psh
  WHERE psh.recorded_at >= NOW() - INTERVAL '90 days'
  GROUP BY psh.product_variant_id
)
```

**CTE `last_velocity`** - Ultima velocidad conocida guardada:
```sql
last_velocity AS (
  SELECT DISTINCT ON (variant_id) variant_id, avg_daily_sales as saved_velocity
  FROM inventory_replenishment
  WHERE organization_id = org_id AND avg_daily_sales > 0
  ORDER BY variant_id, calculated_at DESC
)
```

**Logica de velocidad en `replenishment_calc`**:
```sql
CASE
  -- Prioridad 1: Velocidad ajustada 30d (dividida por dias con stock, no 30)
  WHEN stk.days_with_stock_30d >= 5 AND sales.sales_30d > 0
  THEN ROUND(sales.sales_30d::numeric / stk.days_with_stock_30d, 2)
  -- Prioridad 2: Velocidad ajustada 90d
  WHEN stk.days_with_stock_90d >= 5 AND s90.sales_90d > 0
  THEN ROUND(s90.sales_90d::numeric / stk.days_with_stock_90d, 2)
  -- Prioridad 3: Division simple 30d (si no hay historial de stock)
  WHEN sales.sales_30d > 0
  THEN ROUND(sales.sales_30d::numeric / 30, 2)
  -- Prioridad 4: FALLBACK - Ultima velocidad guardada
  WHEN lv.saved_velocity > 0
  THEN lv.saved_velocity
  ELSE 0
END as avg_daily_sales
```

**Razon almacenada** para identificar la fuente:
```sql
CASE
  WHEN stk.days_with_stock_30d >= 5 AND sales.sales_30d > 0 THEN 'Vel. 30d ajustada'
  WHEN stk.days_with_stock_90d >= 5 AND s90.sales_90d > 0 THEN 'Vel. 90d ajustada'
  WHEN sales.sales_30d > 0 THEN 'Vel. 30d'
  WHEN lv.saved_velocity > 0 THEN 'Vel. historica guardada'
  ELSE NULL
END as reason
```

**Confianza de datos**:
```sql
CASE
  WHEN stk.days_with_stock_30d >= 15 THEN 'high'
  WHEN stk.days_with_stock_30d >= 5 THEN 'medium'
  WHEN stk.days_with_stock_90d >= 5 THEN 'low'
  WHEN lv.saved_velocity > 0 THEN 'low'   -- Fallback historico
  ELSE 'low'
END
```

**Guardar velocidad**: Despues del INSERT principal, actualizar `last_known_velocity` en todos los registros donde la velocidad se calculo con datos reales (no fallback):
```sql
UPDATE inventory_replenishment ir
SET last_known_velocity = ir.avg_daily_sales
WHERE ir.organization_id = org_id
  AND ir.calculation_date = today_date
  AND ir.avg_daily_sales > 0
  AND ir.reason NOT LIKE '%historica%';
```

### 3. UI - Indicador visual de fuente de datos

En `ReplenishmentSuggestions.tsx`, junto a la velocidad diaria, mostrar un icono naranja con tooltip cuando la velocidad viene del fallback historico:

- Si `reason` contiene "historica" -> mostrar badge naranja "Est. historico" 
- Si `reason` contiene "90d" -> mostrar badge amarillo "90d"
- Si no -> mostrar velocidad normal (datos frescos de 30d)

### 4. Filtro WHERE actualizado

Actualmente la funcion solo incluye variantes con ventas o produccion. Con el fallback, tambien debe incluir variantes que tengan `last_known_velocity > 0`:

```sql
WHERE rc.sales_30d > 0 
  OR rc.pending_production > 0 
  OR rc.in_transit > 0
  OR rc.avg_daily_sales > 0  -- Incluye fallback historico
```

## Archivos a modificar

1. **Nueva migracion SQL**
   - Agregar columna `last_known_velocity` a `inventory_replenishment`
   - Reescribir funcion `refresh_inventory_replenishment` con CTEs de 90d, stock_days y last_velocity
   - Actualizar vista `v_replenishment_details`

2. **`src/components/supplies/ReplenishmentSuggestions.tsx`**
   - Agregar indicador visual junto a velocidad diaria cuando viene de fallback historico

## Resultado esperado

| Situacion | Antes | Despues |
|---|---|---|
| Producto con ventas 30d | Usa vel. 30d/30 | Usa vel. 30d/dias_con_stock (mas precisa) |
| Agotado 30d, tiene datos 90d | Sugiere 0 | Usa vel. 90d/dias_con_stock |
| Agotado 90+ dias | Sugiere 0 | Usa ultima velocidad guardada |
| Producto nuevo sin historial | Sugiere 0 | Sugiere 0 (no hay datos) |

La velocidad se guarda cada vez que se calcula con datos reales, asi que aunque pasen 6 meses sin stock, el sistema recordara la demanda historica del producto.
