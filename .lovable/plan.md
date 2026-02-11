

## Plan: Permitir crear entregas para orden ORD-0066 (estado "completed")

### Diagnostico

La orden `ORD-0066` tiene estado `completed`. El formulario de entrega solo carga ordenes con estado `assigned` o `in_progress`, por eso no aparece en el dropdown y no puedes seleccionarla.

### Solucion

Ampliar el filtro de ordenes disponibles para incluir tambien ordenes con estado `completed`. Es valido necesitar registrar entregas adicionales para ordenes ya completadas (ajustes, entregas parciales pendientes, etc.).

### Detalle tecnico

**Archivo: `src/hooks/useDeliveryOrders.ts`**

Cambiar la linea:
```
.in('status', ['assigned', 'in_progress'])
```
Por:
```
.in('status', ['assigned', 'in_progress', 'completed'])
```

Esto permite que ordenes completadas tambien aparezcan en el selector del formulario de entrega. Es un cambio de una sola linea.

