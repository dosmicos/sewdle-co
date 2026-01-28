

# Plan: Búsqueda Robusta de DANE sin Depender de ILIKE

## Problema

El `ilike` de PostgreSQL no maneja correctamente la equivalencia ñ↔n:
- `'Nariño' ILIKE '%narin%'` → **FALSE**
- Reducir a 4 caracteres causa colisiones (Sant→Santander/San Andrés)

## Solución

Copiar la estrategia de `envia-quote` que **sí funciona**: buscar primero sin filtrar por departamento, y validar el departamento en JavaScript donde la normalización funciona.

## Cambios Técnicos

### Archivo: `supabase/functions/create-envia-label/index.ts`

**Modificar `findCoverageRowNormalized` (líneas 91-169):**

```typescript
async function findCoverageRowNormalized(
  supabase: any, 
  organizationId: string, 
  city: string, 
  department?: string
): Promise<{ dane_code: string; municipality: string; department: string } | null> {
  const normalizedCity = normalizeForComparison(city);
  const normalizedDept = department ? normalizeForComparison(department) : null;
  
  console.log(`🔍 Finding coverage: city="${city}" (norm: "${normalizedCity}"), dept="${department}" (norm: "${normalizedDept}")`);
  
  // Estrategia 1: Buscar por municipio exacto primero (sin filtrar departamento en SQL)
  // Esto evita problemas con ILIKE y caracteres especiales como ñ
  const { data: exactMatches } = await supabase
    .from('shipping_coverage')
    .select('dane_code, municipality, department')
    .eq('organization_id', organizationId)
    .ilike('municipality', city.trim());
  
  if (exactMatches && exactMatches.length > 0) {
    // Si hay múltiples, preferir el que coincida con el departamento
    if (normalizedDept && exactMatches.length > 1) {
      const deptMatch = exactMatches.find((row: any) => 
        normalizeForComparison(row.department).includes(normalizedDept) ||
        normalizedDept.includes(normalizeForComparison(row.department))
      );
      if (deptMatch) {
        console.log(`✅ DANE found (exact + dept match): "${city}" → "${deptMatch.dane_code}"`);
        return deptMatch;
      }
    }
    console.log(`✅ DANE found (exact match): "${city}" → "${exactMatches[0].dane_code}"`);
    return exactMatches[0];
  }
  
  // Estrategia 2: Traer todos los candidatos y hacer matching normalizado en JavaScript
  // Esto funciona correctamente con ñ, tildes, etc.
  const { data: allCandidates } = await supabase
    .from('shipping_coverage')
    .select('dane_code, municipality, department')
    .eq('organization_id', organizationId)
    .limit(2000);
  
  if (!allCandidates || allCandidates.length === 0) {
    console.log(`⚠️ No coverage data for organization`);
    return null;
  }
  
  // Filtrar candidatos: match por municipio Y departamento (ambos normalizados)
  let candidates = allCandidates.filter((row: any) => {
    const normMunicipality = normalizeForComparison(row.municipality);
    const cityMatches = normMunicipality === normalizedCity || 
                        normMunicipality.includes(normalizedCity) || 
                        normalizedCity.includes(normMunicipality);
    
    if (!cityMatches) return false;
    
    // Si hay departamento, validar que coincida
    if (normalizedDept) {
      const normDept = normalizeForComparison(row.department);
      return normDept.includes(normalizedDept) || normalizedDept.includes(normDept);
    }
    
    return true;
  });
  
  if (candidates.length === 0) {
    console.log(`⚠️ No matching municipality for "${city}" in "${department}"`);
    return null;
  }
  
  // Si hay múltiples, preferir match exacto de municipio, luego el más largo
  candidates.sort((a: any, b: any) => {
    const aExact = normalizeForComparison(a.municipality) === normalizedCity;
    const bExact = normalizeForComparison(b.municipality) === normalizedCity;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return b.municipality.length - a.municipality.length;
  });
  
  const match = candidates[0];
  console.log(`✅ DANE found (normalized JS match): "${city}" → "${match.dane_code}" (${match.municipality}, ${match.department})`);
  return match;
}
```

## Beneficios

| Caso | Antes | Después |
|------|-------|---------|
| Pasto, Nariño | ❌ ILIKE falla con ñ | ✅ JS normaliza correctamente |
| Medellín, Antioquia | ✅ Funciona | ✅ Funciona |
| Albania, Santander | ⚠️ Podría confundir | ✅ Valida municipio + depto |

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/create-envia-label/index.ts` | Reescribir `findCoverageRowNormalized` para usar matching en JavaScript |

## Resultado Esperado

1. Pasto, Nariño → DANE 52001000 ✅
2. Sin riesgo de confundir departamentos porque se valida ambos campos
3. Todos los caracteres especiales (ñ, tildes) funcionan correctamente

