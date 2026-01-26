
## Plan: Cambiar el botón "Volver" para ir siempre a la página de Entregas

### Problema actual

El botón "Volver" en la página de detalles de entrega usa `navigate(-1)`, que navega hacia atrás en el historial del navegador. Esto puede causar que el usuario vaya a una página diferente si no vino directamente desde `/deliveries`.

### Solución

Modificar la función `handleBack` en `DeliveryDetailsPage.tsx` para que siempre navegue a `/deliveries` en lugar de usar el historial del navegador.

---

### Archivo a modificar

`src/pages/DeliveryDetailsPage.tsx`

---

### Cambio

**Ubicación:** Líneas 145-147

**Antes:**
```typescript
const handleBack = (shouldRefresh?: boolean) => {
  navigate(-1);
};
```

**Después:**
```typescript
const handleBack = (shouldRefresh?: boolean) => {
  navigate('/deliveries');
};
```

---

### Resultado esperado

| Escenario | Antes | Después |
|-----------|-------|---------|
| Usuario viene de `/deliveries` | Vuelve a `/deliveries` | Vuelve a `/deliveries` |
| Usuario viene de otra página | Vuelve a esa otra página | Vuelve a `/deliveries` |
| Usuario abre la URL directamente | Comportamiento impredecible | Vuelve a `/deliveries` |

---

### Nota

El componente `DeliveryDetails.tsx` ya tiene como fallback `navigate('/deliveries')` (línea 66), pero esta lógica no se usa porque `DeliveryDetailsPage` siempre pasa `onBack`. El cambio se hace en `DeliveryDetailsPage.tsx` que es donde se define la función `handleBack` que se pasa como prop.
