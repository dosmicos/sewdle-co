

## Plan: Cumpleanos de hijos + Fix link TikTok

### Problema 1: Agregar campo de cumpleanos para hijos

Actualmente la tabla `ugc_creator_children` no tiene un campo para la fecha de nacimiento/cumpleanos. Se necesita:

1. **Migracion de base de datos**: Agregar columna `birth_date` (tipo `date`, nullable) a la tabla `ugc_creator_children`.

2. **Actualizar tipo TypeScript** (`src/types/ugc.ts`): Agregar `birth_date: string | null` a la interfaz `UgcCreatorChild`.

3. **Actualizar formulario de hijos** (`src/components/ugc/UgcChildrenManager.tsx`):
   - Agregar campo de fecha (input tipo date) con label "Cumpleanos".
   - Incluir `birth_date` en la mutacion `addChild`.
   - Mostrar la fecha de cumpleanos en la lista de hijos existentes.

4. **Actualizar hook** (`src/hooks/useUgcCreators.ts`): Incluir `birth_date` en el insert de `addChild`.

5. **Actualizar tipos de Supabase** (`src/integrations/supabase/types.ts`): Regenerar o agregar manualmente el campo.

---

### Problema 2: Fix link de TikTok

**Causa raiz**: El formulario de creadores (`UgcCreatorForm.tsx`) siempre muestra el campo "Instagram handle" sin importar la plataforma seleccionada. Cuando alguien selecciona "tiktok" como plataforma, ingresa su usuario de TikTok en el campo de Instagram, y el modal de detalle genera un link a `instagram.com/usuario` en lugar de `tiktok.com/@usuario`.

**Solucion**:

1. **Actualizar `UgcCreatorForm.tsx`**:
   - Cuando la plataforma es "tiktok", ocultar el campo de Instagram y solo mostrar el de TikTok.
   - Cuando es "instagram", solo mostrar el de Instagram (como esta actualmente).
   - Cuando es "ambas", mostrar ambos campos.

2. **Actualizar `UgcCreatorDetailModal.tsx`**:
   - Validar que los links se generen correctamente segun la plataforma del creador.
   - Si la plataforma es "tiktok" y solo tiene `instagram_handle` (datos legacy), generar el link como TikTok en lugar de Instagram.

---

### Detalle tecnico

**Migracion SQL**:
```sql
ALTER TABLE ugc_creator_children ADD COLUMN birth_date date;
```

**Cambios en archivos**:

| Archivo | Cambio |
|---|---|
| `src/types/ugc.ts` | Agregar `birth_date: string / null` a `UgcCreatorChild` |
| `src/components/ugc/UgcChildrenManager.tsx` | Agregar input de fecha + mostrar cumpleanos en lista |
| `src/hooks/useUgcCreators.ts` | Incluir `birth_date` en insert/tipo del mutation |
| `src/components/ugc/UgcCreatorForm.tsx` | Condicionar visibilidad del campo Instagram segun plataforma |
| `src/components/ugc/UgcCreatorDetailModal.tsx` | Fallback inteligente para links segun plataforma |
| `src/integrations/supabase/types.ts` | Agregar campo `birth_date` al tipo de la tabla |

