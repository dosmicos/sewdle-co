

## Corregir zona horaria en fechas de facturas Alegra

### Problema

Las facturas se crean usando `new Date()` que en el servidor (UTC) puede estar un dia adelante con respecto a Colombia (UTC-5). Alegra rechaza facturas con fecha futura, por lo que despues de las 7:00 PM hora colombiana, todas las facturas fallan.

### Solucion

Reemplazar todas las generaciones de fecha con una funcion que use la zona horaria de Colombia (`America/Bogota`).

### Archivos a modificar

| Archivo | Lineas | Cambio |
|---------|--------|--------|
| `supabase/functions/auto-invoice-alegra/index.ts` | 592, 627 | Usar fecha Colombia en lugar de UTC |
| `src/components/alegra/BulkInvoiceCreator.tsx` | 1617-1618, 2083-2084 | Usar fecha Colombia en lugar de UTC |
| `supabase/functions/alegra-api/index.ts` | 1166 | Usar fecha Colombia en el pago |

### Detalle tecnico

Se agregara una funcion helper `getColombiaDate()` en cada archivo afectado:

```typescript
function getColombiaDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  // Retorna formato YYYY-MM-DD en hora colombiana
}
```

En el frontend (BulkInvoiceCreator), se usara la misma logica con `Intl.DateTimeFormat`:

```typescript
const getColombiaDate = (): string => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
};
```

Luego se reemplazan todas las ocurrencias:

- `new Date().toISOString().split('T')[0]` -> `getColombiaDate()`
- `format(new Date(), 'yyyy-MM-dd')` -> `getColombiaDate()`

### Resultado esperado

Las facturas siempre se crean con la fecha correcta de Colombia, sin importar la hora del dia, eliminando el rechazo de Alegra por "fecha futura".

