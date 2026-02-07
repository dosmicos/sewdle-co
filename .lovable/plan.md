
# Cambiar proyeccion de demanda de 21 a 30 dias

## Resumen
Actualmente la funcion `refresh_inventory_replenishment` proyecta la demanda a 21 dias para calcular la cantidad sugerida. Se cambiara a 30 dias, manteniendo todo lo demas igual (velocidad ajustada, dias de stock, urgencia, etc.).

## Cambio unico

### Migracion SQL: Actualizar `refresh_inventory_replenishment`

En el bloque de `projected_demand_21d` (lineas 184-195 de la funcion actual), cambiar todos los `* 21` por `* 30`:

- `(velocidad) * 21` pasa a `(velocidad) * 30`
- El alias interno cambia de `projected_demand_21d` a `projected_demand_30d`
- La referencia en el INSERT (linea 259-260) tambien se actualiza

**Formula resultante:**
```text
suggested_quantity = MAX(0, (velocidad_ajustada * 30) - stock - produccion_pendiente - en_transito)
```

**Ejemplo (variante 47176267464939):**
- Velocidad: 1.0/dia
- Demanda 30d: 30 unidades
- Stock: 7, pendiente: 0, transito: 0
- Sugerida: 30 - 7 = 23 unidades (antes era 14 con 21 dias)

No se modifica ningun archivo de frontend ni la columna de la tabla (sigue siendo `projected_demand_40d` como nombre de columna en la DB, solo cambia el valor calculado).
