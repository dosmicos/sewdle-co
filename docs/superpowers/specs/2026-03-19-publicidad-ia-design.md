# Publicidad IA — Design Spec

## Overview

Nueva sección "Publicidad" en el sidebar de Sewdle para generación de imágenes con IA. Permite crear fotos de producto y creativos publicitarios usando Nano Banana 2 (Gemini 3.1 Flash Image), con soporte para imágenes semilla, templates, prompts guardados y skills reutilizables.

## Usuarios

- Solo usuarios con rol **admin** pueden ver y usar la sección
- Módulo de permisos: `publicidad`
- Feature gate: `ai_image_generation` — disponible en plan `enterprise` (usa `all_features` wildcard)

## API de Generación

- **Proveedor:** Nano Banana 2 (Gemini 3.1 Flash Image Preview)
- **Llamada:** Desde una Supabase Edge Function (`generate-ai-image`) para no exponer el API key
- **Modos:** text-to-image e image-to-image
- **Resoluciones:** 1K, 2K, 4K
- **Costo estimado:** ~$0.02-0.04 por imagen
- **Output:** Imagen subida a Supabase Storage temporal, retorna signed URL (válida 1 hora). No se almacena permanentemente.
- **Formato:** PNG por defecto, JPEG para fotografía (configurable)

## Arquitectura

```
Frontend (PublicidadPage)
  → Supabase Edge Function (generate-ai-image)
    → Verifica JWT + rol admin via auth.getUser()
    → Verifica rate limit (max 50 generaciones/día por org)
    → Construye prompt con semillas y template
    → Llama Nano Banana 2 API
    → Sube imagen a Storage bucket temporal (publicidad-temp)
    → Guarda registro en ai_image_generations
    → Retorna signed URL (1 hora TTL)
  → Frontend muestra preview
  → Usuario descarga la imagen
  → Cleanup job borra imágenes temporales > 1 hora
```

## Estructura de la Sección

```
Publicidad (sidebar item, icon: Megaphone)
├── Tab: Generar (workspace principal)
├── Tab: Historial
└── Tab: Ajustes
    ├── Semillas de Producto
    ├── Semillas de Publicidad
    ├── Prompts Guardados
    └── Skills
```

## Funcionalidades

### 1. Generar Imagen — Workspace Principal

Tres modos de generación disponibles como sub-tabs o toggle:

#### 1a. Templates Predefinidos
- Categorías de templates:
  - **Producto:** fondo blanco, lifestyle, editorial, flatlay
  - **Ads:** story Instagram (1080x1920), banner Facebook (1200x628), carrusel (1080x1080), post cuadrado (1080x1080)
- El usuario selecciona template → ajusta detalles (nombre producto, colores, texto promocional) → genera
- Cada template tiene un prompt base que se completa con los inputs del usuario
- Templates almacenados en tabla `ai_templates` (permite agregar/editar sin deploy)

#### 1b. Prompt Libre
- Campo de texto abierto para escribir prompt personalizado
- Selector de resolución (1K, 2K, 4K)
- Opción de adjuntar imágenes semilla como referencia de estilo
- Botón generar → muestra preview → botón descargar

#### 1c. Edición con Imagen Base
- Subir foto del producto real (drag & drop o click)
- Escribir instrucciones de edición (ej. "cambiar fondo a playa", "agregar iluminación cálida")
- Opción de seleccionar semilla de publicidad como fondo objetivo
- Usa modo image-to-image de Nano Banana 2

### 2. Imágenes Semilla

#### 2a. Semillas de Producto
- Subir imágenes de referencia que muestran el estilo visual deseado para fotos de producto
- Ejemplo: 3-4 fotos de ruanas con estilo editorial → la IA genera nuevas fotos en ese estilo
- Se guardan en Supabase Storage bucket `publicidad-seeds` bajo `products/{orgId}/`
- Tabla: `ai_seed_images` con type='product'
- Se pueden etiquetar por categoría de producto (ruanas, sleepings, chaquetas)
- Max 5MB por imagen, formatos: JPG, PNG, WEBP

#### 2b. Semillas de Publicidad
- Subir fondos/escenas base para publicidad
- Ejemplo: foto de un parque, sala de estar, set editorial navideño
- La IA toma esas escenas y les agrega productos, o genera variaciones similares con el producto incluido
- Se guardan en Supabase Storage bucket `publicidad-seeds` bajo `ads/{orgId}/`
- Tabla: `ai_seed_images` con type='advertising'
- Se pueden etiquetar por campaña o temporada
- Max 5MB por imagen, formatos: JPG, PNG, WEBP

### 3. Prompts Guardados
- Biblioteca de prompts reutilizables
- Campos: nombre, prompt, categoría (producto/publicidad)
- Ejemplo: "Editorial luz cálida" → "Professional product photo, warm natural lighting, wooden surface, soft bokeh background, editorial style"
- CRUD completo: crear, editar, eliminar, duplicar
- Tabla: `ai_saved_prompts`

### 4. Skills (Presets)
- Combinación guardada de: prompt + semillas seleccionadas + configuración (resolución, modo)
- Ejemplo skill: "Story Instagram Navidad" = prompt navideño + semilla de fondo rojo + resolución 1080x1920
- Al seleccionar un skill, se pre-cargan todos los campos automáticamente
- CRUD completo
- Tabla: `ai_skills`
- Junction table `ai_skill_seeds` para relación con semillas (integridad referencial)

### 5. Historial
- Tabla con todas las generaciones realizadas
- Columnas: fecha, usuario, modo (template/libre/edición), prompt usado, template usado, skill usado, semillas usadas
- **No** almacena la imagen generada permanentemente (solo temporal para descarga)
- Botón "Re-usar" que carga el mismo prompt/config en el workspace
- Filtros por fecha, modo, usuario
- Tabla: `ai_image_generations`
- Junction table `ai_generation_seeds` para relación con semillas usadas

### 6. Rate Limiting
- Máximo 50 generaciones por día por organización
- Contador en tabla `ai_image_generations` filtrado por `created_at >= today`
- Edge function verifica antes de llamar la API
- Frontend muestra contador: "12/50 generaciones hoy"

## Error Handling

- **API timeout (>30s):** Mostrar toast "La generación tardó demasiado. Intenta de nuevo."
- **Content policy rejection:** Mostrar toast "El contenido no pudo ser generado. Intenta modificar el prompt."
- **Rate limit exceeded:** Mostrar toast "Has alcanzado el límite diario de generaciones (50/día)."
- **Auth failure:** Redirigir a login
- **Network error:** Mostrar toast con botón de retry

## Base de Datos

### Nuevas Tablas

```sql
-- Templates (en DB para poder editarlos sin deploy)
CREATE TABLE ai_templates (
  id TEXT PRIMARY KEY, -- ej: 'prod-white-bg'
  organization_id UUID REFERENCES organizations(id), -- NULL = global/default
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('product', 'advertising')),
  prompt_base TEXT NOT NULL,
  resolution TEXT DEFAULT '2K',
  dimensions TEXT, -- ej: '1080x1920' para ads
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Imágenes semilla (producto y publicidad)
CREATE TABLE ai_seed_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL CHECK (type IN ('product', 'advertising')),
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  category TEXT, -- ej: "ruanas", "navidad", "lifestyle"
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompts guardados
CREATE TABLE ai_saved_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT CHECK (category IN ('product', 'advertising')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skills (presets)
CREATE TABLE ai_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  mode TEXT CHECK (mode IN ('template', 'free', 'edit')),
  template_id TEXT REFERENCES ai_templates(id),
  resolution TEXT DEFAULT '1K',
  config JSONB DEFAULT '{}', -- configuración adicional
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction: skills <-> seed images
CREATE TABLE ai_skill_seeds (
  skill_id UUID NOT NULL REFERENCES ai_skills(id) ON DELETE CASCADE,
  seed_image_id UUID NOT NULL REFERENCES ai_seed_images(id) ON DELETE CASCADE,
  PRIMARY KEY (skill_id, seed_image_id)
);

-- Historial de generaciones
CREATE TABLE ai_image_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  mode TEXT NOT NULL CHECK (mode IN ('template', 'free', 'edit')),
  prompt TEXT NOT NULL,
  template_id TEXT REFERENCES ai_templates(id),
  skill_id UUID REFERENCES ai_skills(id) ON SET NULL,
  base_image_url TEXT, -- imagen base si fue modo edición
  resolution TEXT,
  output_format TEXT DEFAULT 'png',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction: generations <-> seed images used
CREATE TABLE ai_generation_seeds (
  generation_id UUID NOT NULL REFERENCES ai_image_generations(id) ON DELETE CASCADE,
  seed_image_id UUID NOT NULL REFERENCES ai_seed_images(id) ON DELETE SET NULL,
  PRIMARY KEY (generation_id, seed_image_id)
);

-- Indexes
CREATE INDEX idx_ai_seed_images_org ON ai_seed_images(organization_id);
CREATE INDEX idx_ai_saved_prompts_org ON ai_saved_prompts(organization_id);
CREATE INDEX idx_ai_skills_org ON ai_skills(organization_id);
CREATE INDEX idx_ai_image_generations_org ON ai_image_generations(organization_id);
CREATE INDEX idx_ai_image_generations_created ON ai_image_generations(organization_id, created_at);

-- Updated_at triggers
CREATE TRIGGER set_ai_saved_prompts_updated_at
  BEFORE UPDATE ON ai_saved_prompts
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER set_ai_skills_updated_at
  BEFORE UPDATE ON ai_skills
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

### RLS Policies

```sql
-- ai_seed_images
ALTER TABLE ai_seed_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view seed images" ON ai_seed_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create seed images" ON ai_seed_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update seed images" ON ai_seed_images FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete seed images" ON ai_seed_images FOR DELETE TO authenticated USING (true);

-- ai_saved_prompts
ALTER TABLE ai_saved_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view prompts" ON ai_saved_prompts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create prompts" ON ai_saved_prompts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update prompts" ON ai_saved_prompts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete prompts" ON ai_saved_prompts FOR DELETE TO authenticated USING (true);

-- ai_skills
ALTER TABLE ai_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view skills" ON ai_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create skills" ON ai_skills FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update skills" ON ai_skills FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete skills" ON ai_skills FOR DELETE TO authenticated USING (true);

-- ai_skill_seeds
ALTER TABLE ai_skill_seeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view skill seeds" ON ai_skill_seeds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage skill seeds" ON ai_skill_seeds FOR ALL TO authenticated USING (true);

-- ai_image_generations
ALTER TABLE ai_image_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view generations" ON ai_image_generations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create generations" ON ai_image_generations FOR INSERT TO authenticated WITH CHECK (true);

-- ai_generation_seeds
ALTER TABLE ai_generation_seeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view generation seeds" ON ai_generation_seeds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create generation seeds" ON ai_generation_seeds FOR INSERT TO authenticated WITH CHECK (true);

-- ai_templates
ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view templates" ON ai_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage templates" ON ai_templates FOR ALL TO authenticated USING (true);
```

### Storage Bucket

```sql
-- Crear bucket para semillas (persistente)
INSERT INTO storage.buckets (id, name, public) VALUES ('publicidad-seeds', 'publicidad-seeds', true);

-- Crear bucket temporal para imágenes generadas
INSERT INTO storage.buckets (id, name, public) VALUES ('publicidad-temp', 'publicidad-temp', false);

-- Policies para publicidad-seeds
CREATE POLICY "Authenticated users can upload seeds" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'publicidad-seeds');
CREATE POLICY "Anyone can view seeds" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'publicidad-seeds');
CREATE POLICY "Authenticated users can delete seeds" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'publicidad-seeds');

-- Policies para publicidad-temp (solo edge function via service role)
-- No se necesitan policies — el edge function usa service_role key
```

## Edge Function: generate-ai-image

```
POST /functions/v1/generate-ai-image
Authorization: Bearer <supabase-auth-token>

Body:
{
  "mode": "free" | "template" | "edit",
  "prompt": "string",
  "resolution": "1K" | "2K" | "4K",
  "output_format": "png" | "jpeg",
  "seed_image_ids": ["uuid1", "uuid2"], // opcionales
  "base_image": "base64", // solo para modo edit
  "template_id": "string" // solo para modo template
}

Response:
{
  "image_url": "signed URL (1h TTL)",
  "generation_id": "uuid"
}
```

### Edge Function Auth Pattern:
```typescript
// 1. Extract and verify JWT
const authHeader = req.headers.get("Authorization");
if (!authHeader) throw new Error("No authorization header");
const token = authHeader.replace("Bearer ", "");
const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
if (userError) throw new Error(`Auth error: ${userError.message}`);
const user = userData.user;

// 2. Get user's org and verify admin role
const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('organization_id, role')
  .eq('id', user.id)
  .single();
if (!profile || profile.role !== 'admin') {
  return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
}

// 3. Check daily rate limit
const today = new Date().toISOString().split('T')[0];
const { count } = await supabaseAdmin
  .from('ai_image_generations')
  .select('*', { count: 'exact', head: true })
  .eq('organization_id', profile.organization_id)
  .gte('created_at', today);
if (count >= 50) {
  return new Response(JSON.stringify({ error: 'Daily limit reached (50/day)' }), { status: 429 });
}

// 4. Fetch seed image URLs if provided
// 5. Build prompt (template base + user input + seed context)
// 6. Call Nano Banana 2 API
// 7. Upload result to publicidad-temp bucket
// 8. Create signed URL (1h)
// 9. Save record to ai_image_generations + ai_generation_seeds
// 10. Return signed URL
```

## Frontend — Archivos Nuevos

### Páginas
- `src/pages/PublicidadPage.tsx` — página principal con tabs (Generar, Historial, Ajustes)

### Componentes
- `src/components/publicidad/GenerateWorkspace.tsx` — workspace de generación con los 3 modos
- `src/components/publicidad/TemplateSelector.tsx` — grid de templates predefinidos
- `src/components/publicidad/PromptEditor.tsx` — campo de prompt libre con selector de semillas
- `src/components/publicidad/ImageEditor.tsx` — subir imagen base + instrucciones de edición
- `src/components/publicidad/ImagePreview.tsx` — preview de imagen generada + botón descargar
- `src/components/publicidad/GenerationHistory.tsx` — tabla de historial con filtros
- `src/components/publicidad/SeedImageManager.tsx` — CRUD de imágenes semilla (producto y publicidad)
- `src/components/publicidad/SavedPromptsManager.tsx` — CRUD de prompts guardados
- `src/components/publicidad/SkillsManager.tsx` — CRUD de skills/presets
- `src/components/publicidad/SettingsPanel.tsx` — panel de ajustes con sub-tabs

### Hooks
- `src/hooks/useAiGeneration.ts` — llamar edge function, manejar loading/error, rate limit counter
- `src/hooks/useSeedImages.ts` — CRUD de semillas
- `src/hooks/useSavedPrompts.ts` — CRUD de prompts
- `src/hooks/useAiSkills.ts` — CRUD de skills (con join a ai_skill_seeds)
- `src/hooks/useGenerationHistory.ts` — fetch historial con filtros (con join a ai_generation_seeds)
- `src/hooks/useAiTemplates.ts` — fetch templates

### Edge Function
- `supabase/functions/generate-ai-image/index.ts`

## Cambios en Archivos Existentes

### `src/components/AppSidebar.tsx`
- Agregar import: `Megaphone` de lucide-react
- Agregar entrada en `moduleToPermissionMap`: `'publicidad': 'publicidad'`
- Agregar item en `allMenuItems`: `{ title: 'Publicidad', url: '/publicidad', icon: Megaphone, module: 'publicidad' }`

### `src/App.tsx`
- Agregar import: `PublicidadPage`
- Agregar ruta: `<Route path="publicidad" element={<PermissionRoute module="publicidad" action="view"><PublicidadPage /></PermissionRoute>} />`

## Templates Iniciales (seed data para ai_templates)

### Producto
| ID | Nombre | Prompt Base | Resolución |
|----|--------|-------------|------------|
| prod-white-bg | Fondo Blanco | Professional product photo on pure white background, studio lighting, centered, high detail | 2K |
| prod-lifestyle | Lifestyle | Product in natural lifestyle setting, warm ambient lighting, cozy atmosphere | 2K |
| prod-editorial | Editorial | Editorial style product photography, dramatic lighting, magazine quality | 2K |
| prod-flatlay | Flatlay | Flat lay product arrangement, top-down view, minimalist styling, clean composition | 2K |

### Publicidad
| ID | Nombre | Prompt Base | Resolución | Dimensiones |
|----|--------|-------------|------------|-------------|
| ad-ig-story | Story Instagram | Vertical promotional image, vibrant colors, bold text space at top | 2K | 1080x1920 |
| ad-fb-banner | Banner Facebook | Horizontal promotional banner, clean design, call to action space | 2K | 1200x628 |
| ad-carousel | Carrusel | Square promotional image, product focused, modern design | 2K | 1080x1080 |
| ad-post | Post Cuadrado | Square social media post, eye-catching, brand-consistent | 2K | 1080x1080 |

## Flujo de Usuario

### Generar con Template
1. Abrir Publicidad → Tab Generar
2. Seleccionar modo "Templates"
3. Elegir template (ej. "Fondo Blanco")
4. Opcionalmente seleccionar semillas de producto como referencia de estilo
5. Ajustar detalles (nombre producto, color, etc.)
6. Click "Generar" → loading spinner
7. Ver preview → Click "Descargar"
8. Si error → toast con mensaje y botón retry

### Generar con Prompt Libre
1. Abrir Publicidad → Tab Generar
2. Seleccionar modo "Prompt Libre"
3. Escribir prompt o seleccionar prompt guardado
4. Opcionalmente adjuntar semillas
5. Elegir resolución y formato
6. Click "Generar" → loading spinner
7. Ver preview → Click "Descargar"

### Editar Imagen
1. Abrir Publicidad → Tab Generar
2. Seleccionar modo "Editar"
3. Subir foto del producto (max 5MB, JPG/PNG/WEBP)
4. Opcionalmente seleccionar semilla de publicidad como fondo objetivo
5. Escribir instrucciones (ej. "poner producto en esta escena navideña")
6. Click "Generar" → loading spinner
7. Ver preview → Click "Descargar"

### Usar Skill
1. Abrir Publicidad → Tab Generar
2. Seleccionar skill del dropdown (ej. "Story Instagram Navidad")
3. Se pre-cargan prompt, semillas y configuración
4. Ajustar si necesario
5. Click "Generar"

### Re-usar desde Historial
1. Abrir Publicidad → Tab Historial
2. Encontrar generación pasada
3. Click "Re-usar"
4. Se carga el mismo prompt/config en el workspace
5. Ajustar y generar
