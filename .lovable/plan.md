

# Plan: Corregir Problema de Invocación de Edge Functions para Envío

## Problema Identificado

La función `invokeEdgeFunction` en `src/features/shipping/lib/invokeEdgeFunction.ts` falla silenciosamente porque intenta acceder a propiedades que **no existen** en el cliente Supabase v2.x:

```typescript
// Líneas 21-22 - ESTAS PROPIEDADES NO EXISTEN
const supabaseUrl = (supabase as any).supabaseUrl as string | undefined;
const supabaseKey = (supabase as any).supabaseKey as string | undefined;
```

Cuando estas propiedades son `undefined`, el código lanza un error en la línea 24-26 que se captura silenciosamente, causando que el spinner aparezca y desaparezca sin mostrar resultados.

**Nota**: El resto del proyecto usa `supabase.functions.invoke` nativo (38 archivos) y funciona correctamente. Solo la integración de Envia usa esta función personalizada.

---

## Solución

Exportar las constantes `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` desde el archivo del cliente y usarlas directamente en `invokeEdgeFunction`.

---

## Cambios a Realizar

### 1. Exportar Constantes del Cliente Supabase

**Archivo**: `src/integrations/supabase/client.ts`

| Antes | Después |
|-------|---------|
| `const SUPABASE_URL = "https://..."` | `export const SUPABASE_URL = "https://..."` |
| `const SUPABASE_PUBLISHABLE_KEY = "eyJ..."` | `export const SUPABASE_PUBLISHABLE_KEY = "eyJ..."` |

### 2. Actualizar invokeEdgeFunction para Usar las Constantes

**Archivo**: `src/features/shipping/lib/invokeEdgeFunction.ts`

```typescript
// Cambiar la importación
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';

// Usar las constantes directamente
const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_PUBLISHABLE_KEY;
```

---

## Por Qué Funcionaba Antes

Posiblemente:
1. Una versión anterior del cliente Supabase exponía estas propiedades
2. Se actualizó `@supabase/supabase-js` y cambió la estructura interna del cliente
3. Hubo una regeneración del archivo client.ts que removió configuraciones personalizadas

---

## Impacto de los Cambios

| Aspecto | Descripción |
|---------|-------------|
| **Riesgo** | Muy bajo - solo cambia la forma de obtener valores que ya son públicos |
| **Funcionalidad** | Los botones "Verificar Guía" y "Cotizar Envío" funcionarán correctamente |
| **Seguridad** | Sin impacto - la anon key está diseñada para uso en cliente |
| **Otros módulos** | Sin impacto - los 38 archivos que usan `supabase.functions.invoke` no se modifican |

---

## Archivos a Modificar

1. `src/integrations/supabase/client.ts` - Agregar `export` a las constantes
2. `src/features/shipping/lib/invokeEdgeFunction.ts` - Importar y usar las constantes exportadas

---

## Verificación Post-Cambio

Después de aplicar los cambios, al hacer clic en:
- **"Verificar Guía"**: Debería buscar si existe una guía previa para el pedido
- **"Cotizar Envío"**: Debería mostrar opciones de carriers con precios (Coordinadora, Deprisa, Interrapidísimo)

