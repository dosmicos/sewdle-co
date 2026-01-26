

## Plan: Mejorar Algoritmo de Similitud para Evitar Falsos Positivos

### Problema Identificado

El algoritmo actual de `calculateSimilarity` es demasiado permisivo. Productos como:
- "Sleeping para Bebé **Espacial** TOG 2.5"  
- "Sleeping para Bebé **Osito** TOG 2.5"

Tienen un score de ~0.83 (5 de 6 palabras coinciden), por lo que el sistema piensa que son el mismo producto cuando **NO lo son**.

### Solución

Modificar el algoritmo de similitud para:
1. **Aumentar el umbral** de 0.6 a 0.85 para ser más estricto
2. **Penalizar palabras extra** en Alegra que no están en Shopify (si Alegra tiene "Osito" y Shopify tiene "Espacial", penalizar)
3. **Verificar palabras clave distintivas** que diferencian productos (ej: colores, diseños)

### Cambios Técnicos

#### Archivo: `src/components/alegra/AlegraProductSyncModal.tsx`

**1. Mejorar función `calculateSimilarity`:**

```typescript
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const words1 = s1.split(/\s+/).filter(w => w.length > 2);
  const words2 = s2.split(/\s+/).filter(w => w.length > 2);
  
  let matches = 0;
  for (const word of words1) {
    if (words2.some(w => w.includes(word) || word.includes(w))) {
      matches++;
    }
  }
  
  const baseScore = words1.length > 0 ? matches / words1.length : 0;
  
  // NUEVO: Penalizar si Alegra tiene palabras que NO están en Shopify
  // Esto evita que "Espacial" coincida con "Osito"
  let extraWordsInAlegra = 0;
  for (const word of words2) {
    const existsInShopify = words1.some(w => w.includes(word) || word.includes(w));
    if (!existsInShopify) {
      extraWordsInAlegra++;
    }
  }
  
  // Aplicar penalización del 10% por cada palabra extra
  const penalty = extraWordsInAlegra * 0.1;
  const finalScore = Math.max(0, baseScore - penalty);
  
  return finalScore;
};
```

**2. Aumentar umbral de coincidencia:**

```typescript
// Línea 82 - Cambiar de 0.6 a 0.85
if (score > 0.85 && (!bestMatch || score > bestMatch.score)) {
```

### Ejemplo de Cálculo Nuevo

**Antes (problemático):**
- "Sleeping para Bebé Espacial TOG 2.5" vs "Sleeping para Bebé Osito TOG 2.5"
- Score: 5/6 = 0.83 → **MATCH** (mayor que 0.6)

**Después (corregido):**
- Base score: 5/6 = 0.83
- Palabras extra en Alegra: "Osito" (no está en Shopify) = 1
- Penalización: 1 × 0.1 = 0.1
- Score final: 0.83 - 0.1 = **0.73** → **NO MATCH** (menor que 0.85)

### Resultado Esperado

| Comparación | Score Antes | Score Después | ¿Match? |
|-------------|-------------|---------------|---------|
| Espacial vs Osito | 0.83 | 0.73 | ❌ No |
| Espacial vs Espacial | 1.0 | 1.0 | ✅ Sí |
| Mapache vs Mapache | 1.0 | 1.0 | ✅ Sí |
| Ruana Grinch vs Ruana | 0.75 | 0.65 | ❌ No |

### Archivos a Modificar

- `src/components/alegra/AlegraProductSyncModal.tsx`

