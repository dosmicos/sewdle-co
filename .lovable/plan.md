

## Plan: Permitir que Bogotá coincida con departamentos "Bogotá" y "Cundinamarca"

### Problema

Cuando Shopify envía un pedido de Bogotá:
- **city** = "Bogotá D.C."
- **province** = "Cundinamarca" (así lo maneja Shopify)

En la base de datos `shipping_coverage`:
- **municipality** = "Bogotá"
- **department** = "Bogotá"

La función actual filtra por `department ILIKE '%cundi%'` y no encuentra resultados porque Bogotá está guardado con `department = "Bogotá"`.

---

### Solución

Agregar un caso especial en la función `findCoverageRowNormalized` que detecte cuando la ciudad es Bogotá y busque en ambos departamentos.

---

### Archivo a modificar

`supabase/functions/create-envia-label/index.ts`

---

### Cambio específico

**Ubicación:** Líneas 108-111

**Código actual:**
```typescript
// If department provided, filter by it (also accent-insensitive via ilike partial)
if (normalizedDept) {
  query = query.ilike('department', `%${normalizedDept.substring(0, 5)}%`);
}
```

**Nuevo código:**
```typescript
// Special case: Bogotá can come with province "Cundinamarca" from Shopify 
// but is stored as department "Bogotá" in the database
const isBogota = normalizedCity.includes('bogota');

if (isBogota) {
  console.log(`🏛️ Detected Bogotá - searching in both Bogotá and Cundinamarca departments`);
  query = query.or('department.ilike.%bogot%,department.ilike.%cundi%');
} else if (normalizedDept) {
  // Normal case: filter by provided department
  query = query.ilike('department', `%${normalizedDept.substring(0, 5)}%`);
}
```

---

### Comportamiento resultante

| Ciudad | Departamento Shopify | Búsqueda | Resultado |
|--------|---------------------|----------|-----------|
| Bogotá D.C. | Cundinamarca | `dept ILIKE '%bogot%' OR dept ILIKE '%cundi%'` | ✅ Encuentra |
| Bogotá D.C. | Bogotá D.C. | `dept ILIKE '%bogot%' OR dept ILIKE '%cundi%'` | ✅ Encuentra |
| Soacha | Cundinamarca | `dept ILIKE '%cundi%'` | ✅ Sin cambio |
| Medellín | Antioquia | `dept ILIKE '%antio%'` | ✅ Sin cambio |

---

### Sección técnica

**Función:** `findCoverageRowNormalized` (líneas 91-162)

**Sintaxis Supabase:** El método `.or()` permite combinar condiciones con OR:
```typescript
query.or('department.ilike.%bogot%,department.ilike.%cundi%')
// Equivale a: WHERE department ILIKE '%bogot%' OR department ILIKE '%cundi%'
```

**Detección de Bogotá:**
- `normalizedCity.includes('bogota')` captura todas las variantes:
  - "Bogotá" → "bogota"
  - "Bogotá D.C." → "bogota d.c."
  - "BOGOTÁ" → "bogota"

