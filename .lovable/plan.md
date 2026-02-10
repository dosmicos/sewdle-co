

# Corregir parsing de tracking de Envia.com

## Problema
El estado de envio siempre muestra "En transito" aunque el paquete ya fue entregado. Esto ocurre porque:

1. La API de Envia.com devuelve los eventos en un campo llamado `eventHistory`, pero el codigo busca en `checkpoints` (que no existe en la respuesta)
2. Como no encuentra eventos, el array queda vacio y el estado por defecto es `in_transit`
3. Ademas, la API devuelve el estado global en `trackingData.status` (ej: `"Delivered"`) que no se esta usando

## Evidencia del log
La API devuelve correctamente:
```text
"status": "Delivered"
"eventHistory": [
  { "event": "A Recibir Por Coordinadora", "date": "2026-02-09 00:00:00" },
  { "event": "En Terminal Origen", "date": "2026-02-09 17:14:17" },
  { "event": "Entregada", "description": "Persona que recibe: francy Villamizar", "date": "2026-02-10 13:28:15" }
]
```
Pero el codigo busca `trackingData.checkpoints` que no existe.

## Solucion

### Archivo: `supabase/functions/envia-track/index.ts`

**1. Parsear `eventHistory` en vez de `checkpoints` (lineas 111-123):**
- Buscar en `trackingData.eventHistory` (el campo real de la API)
- Mapear `event` como descripcion, ya que la API usa ese campo en vez de `description`

**2. Usar `trackingData.status` como fuente primaria del estado (lineas 125-139):**
- Primero verificar `trackingData.status` directamente (ej: `"Delivered"`, `"InTransit"`)
- Si no es concluyente, usar los eventos como fallback
- Esto hace el parsing mas robusto

**3. Remover columnas inexistentes del UPDATE (lineas 154-161):**
- La tabla `shipping_labels` no tiene columnas `last_tracking_update` ni `tracking_events`
- Solo actualizar la columna `status` que si existe

## Cambios especificos

```text
// Antes (no funciona):
if (trackingData.checkpoints && Array.isArray(trackingData.checkpoints)) { ... }
let status = 'in_transit';

// Despues (correcto):
if (trackingData.eventHistory && Array.isArray(trackingData.eventHistory)) {
  for (const evt of trackingData.eventHistory) {
    events.push({
      date: evt.date || '',
      time: '',
      description: evt.event || evt.description || '',
      location: evt.location || '',
      status: evt.event || ''
    });
  }
}

// Usar trackingData.status como fuente primaria
const apiStatus = (trackingData.status || '').toLowerCase();
if (apiStatus === 'delivered' || apiStatus.includes('delivered')) {
  status = 'delivered';
} else if (apiStatus === 'intransit' || ...) {
  status = 'in_transit';
} else {
  // fallback: revisar ultimo evento
}
```

**UPDATE simplificado:**
```text
// Solo actualizar status (las otras columnas no existen)
.update({ status: status })
.eq('tracking_number', body.tracking_number)
```

## Archivos a modificar
- `supabase/functions/envia-track/index.ts` - corregir parsing de respuesta API y UPDATE de DB

