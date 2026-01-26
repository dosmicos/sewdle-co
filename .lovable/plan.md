
## Plan: Corregir Formato de Identificación en auto-invoice-alegra

### Problema Identificado

Los pedidos no se están facturando porque el API de Alegra rechaza el formato de identificación. Analizando el código de `alegra-api/index.ts` que **SÍ funciona** para actualizar contactos, veo que usa **ambos formatos simultáneamente**:

```typescript
// En alegra-api (funciona)
identificationType: 'CC',
identificationNumber: '12345678',
identification: '12345678',
identificationObject: { type: 'CC', number: '12345678' },
```

Pero en `auto-invoice-alegra` solo usamos el objeto anidado:
```typescript
// En auto-invoice-alegra (NO funciona)
identification: { type: 'CC', number: '12345678' },
```

### Solución

Modificar el `contactPayload` en `auto-invoice-alegra/index.ts` para enviar **todos los formatos** que Alegra acepta, igual que en el código que ya funciona.

### Cambio Técnico

**Archivo:** `supabase/functions/auto-invoice-alegra/index.ts`

**Ubicación:** Líneas 225-244

**Antes:**
```typescript
const contactPayload = {
  name: fullName,
  nameObject: { firstName, lastName },
  // ...otros campos...
  identification: {
    type: 'CC',
    number: String(identification).slice(0, 20),
  },
  kindOfPerson: 'PERSON_ENTITY',
  type: ['client'],
}
```

**Después:**
```typescript
const contactPayload = {
  name: fullName,
  nameObject: { firstName, lastName },
  // ...otros campos...
  // Formato plano (requerido para creación)
  identificationType: 'CC',
  identificationNumber: String(identification).slice(0, 20),
  identification: String(identification).slice(0, 20),
  // Formato objeto (por compatibilidad)
  identificationObject: {
    type: 'CC',
    number: String(identification).slice(0, 20),
  },
  kindOfPerson: 'PERSON_ENTITY',
  type: ['client'],
}
```

### Acciones Adicionales

1. **Re-desplegar la función** después del cambio
2. **Limpiar tags de error** de pedidos fallidos para que puedan ser re-procesados

### Pedidos Afectados

Los siguientes pedidos necesitarán ser re-procesados manualmente o a través de un trigger:
- #68021 (Diego Fino) - $97,900
- #68020 (Jorge Eduardo Lamo Blanco) - $253,800  
- #68018 (Jennifer Barbosa) - $103,700

### Resultado Esperado

Después del fix:
- Los contactos se crearán correctamente en Alegra
- Las facturas se generarán y emitirán automáticamente
- El tag "FACTURADO" se agregará a los pedidos exitosos
