# Plan Maestro: 6 Worktrees en Paralelo — Dosmicos

## Arquitectura de Ejecución

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN BRANCH                           │
│              (sewdle-co / producción)                    │
└──────┬──────┬──────┬──────┬──────┬──────┬───────────────┘
       │      │      │      │      │      │
       ▼      ▼      ▼      ▼      ▼      ▼
    WT-1   WT-2   WT-3   WT-4   WT-5   WT-6
   Holiday Content  IG/FB  TikTok  Fix   Intel
   AI Cal  Planner  Stats  Stats  Msgs  Review
```

Cada worktree es un Agent independiente con isolation: "worktree" que trabaja en su propia rama git sin conflictos.

---

## Skills por Worktree

| Worktree | Skills Requeridos | Agent Team |
|----------|-------------------|------------|
| WT-1: Holiday AI Calendar | `prophit-system-dosmicos`, `frontend-design`, `emil-design-eng` | 1 agent |
| WT-2: Content Planner | `ui-ux-pro-max`, `frontend-design`, `emil-design-eng` | 1 agent |
| WT-3: IG/FB Analytics | `prophit-system-dosmicos`, `ui-ux-pro-max`, `frontend-design` | 1 agent |
| WT-4: TikTok Analytics | `prophit-system-dosmicos`, `ui-ux-pro-max`, `frontend-design` | 1 agent |
| WT-5: Remove Messages | — (refactor simple) | 1 agent |
| WT-6: Intelligence Review | `prophit-system-dosmicos`, `ui-ux-pro-max` | 1 agent (análisis) |

---

## WORKTREE 1: Holiday AI Calendar
**Rama:** `feat/holiday-ai-suggestions`
**Objetivo:** Agregar a Mrk Calendario una sección con fechas de campañas sugeridas por IA, que el usuario pueda aprobar y agregar al calendario.

### Archivos a Modificar/Crear
- `src/pages/MarketingCalendarPage.tsx` — Agregar sección de sugerencias
- `src/hooks/useHolidaySuggestions.ts` — **NUEVO** — Hook para generar/almacenar sugerencias
- `src/components/marketing-calendar/HolidaySuggestionPanel.tsx` — **NUEVO** — Panel lateral de sugerencias
- `supabase/migrations/xxx_holiday_suggestions.sql` — **NUEVO** — Tabla para sugerencias

### Lógica de Negocio (Prophit System)
- Las sugerencias deben alinearse con los 4 peaks trimestrales de Dosmicos:
  - Q1: "Hot Days" (Marzo)
  - Q2: "Día de la Madre" (Mayo)
  - Q3: "Temporada de Frío" (Julio-Agosto)
  - Q4: "Black Friday + Navidad" (Nov-Dic)
- Cada sugerencia debe incluir el "Why Now?" (justificación estratégica del Prophit System)
- Priorizar fechas por expected_impact (high/medium/low)
- Incluir fechas Colombia + USA ya que Dosmicos opera en ambos mercados

### Fechas a Incluir (hardcoded + editable)
**Colombia:** Día de la Madre, Día del Padre, Amor y Amistad, Halloween niños, Black Friday, Navidad, Día del Niño, Semana Santa
**USA:** Mother's Day, Father's Day, Valentine's Day, Back to School, Halloween, Thanksgiving, Black Friday, Christmas, New Year
**Dosmicos-específicas:** Lanzamientos de colección por temporada, Aniversario marca

### UX Esperado
- Panel lateral o sección colapsable en el calendario
- Cards con: fecha, nombre del holiday, mercado (CO/US/ambos), impacto esperado, "Why Now?" pre-llenado
- Botón "Agregar al Calendario" que crea el MarketingEvent automáticamente
- Checkbox para marcar como "descartado" o "ya planificado"
- Vista anual de timeline con todos los holidays

### Prompt para el Agent

```
Eres un agente de desarrollo fullstack senior trabajando en el proyecto Sewdle-co (Dosmicos).

## Contexto
Dosmicos es una marca colombiana de ropa térmica infantil que vende en Colombia y USA.
El proyecto usa: React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase + date-fns + Framer Motion.
Ya tienen Gemini API integrado en Edge Functions (ver supabase/functions/generate-ai-image/index.ts como referencia del patrón).
GEMINI_API_KEY ya está configurado en los secrets de Supabase.

## Skills que DEBES leer antes de escribir código
Lee estos archivos y sigue sus instrucciones al pie de la letra:
1. `.agents/skills/prophit-system-dosmicos/SKILL.md` — Framework financiero. Cada sugerencia debe tener "Why Now?" y alinearse con los 4 peaks trimestrales.
2. `.agents/skills/frontend-design/SKILL.md` — Para diseño visual distintivo, no genérico.
3. `.agents/skills/emil-design-eng/SKILL.md` — Para animaciones y micro-interacciones (entry animations de las cards, transiciones al agregar).

## Tarea
Agrega al MarketingCalendarPage.tsx un sistema de "Fechas Sugeridas por IA" potenciado por Gemini que se auto-actualice.

### PARTE 1: Supabase Edge Function — `generate-holiday-suggestions`

Crea `supabase/functions/generate-holiday-suggestions/index.ts`:
- Sigue EXACTAMENTE el patrón de `supabase/functions/generate-ai-image/index.ts` (CORS, auth, Supabase admin client, logStep)
- Llama a Gemini API (`gemini-2.0-flash`) con este prompt de sistema:

```
Eres un experto en marketing de e-commerce para una marca de ropa térmica infantil (Dosmicos) que opera en Colombia y USA.

Genera una lista de fechas culturales, comerciales y de marca relevantes para campañas de marketing.

Para cada fecha incluye:
- name: nombre del evento/holiday
- date: fecha exacta en formato YYYY-MM-DD (para el año solicitado)
- market: "co" | "us" | "both"
- category: "cultural" | "commercial" | "brand" | "seasonal"
- expected_impact: "high" | "medium" | "low"
- why_now: explicación estratégica de POR QUÉ Dosmicos debería hacer campaña (conectar con ropa térmica infantil, mamás, frío, regalos)
- quarter_peak: "q1" | "q2" | "q3" | "q4"
- suggested_event_type: "promotion" | "cultural_moment" | "product_launch"
- campaign_idea: una idea breve de campaña específica para Dosmicos

Incluye: holidays nacionales de Colombia y USA, fechas comerciales (Black Friday, Cyber Monday, Prime Day), fechas de regalos (Día de la Madre, Navidad, Amor y Amistad), cambios de temporada relevantes para ropa térmica, back to school, y cualquier fecha emergente o trending que sea relevante.

Responde SOLO con un JSON array válido.
```

- El endpoint recibe: `{ year: number, market_filter?: "co" | "us" | "both" }`
- Usa `response_mime_type: "application/json"` en la llamada a Gemini para obtener JSON estructurado
- Upsert los resultados en la tabla `holiday_suggestions` (no duplicar si ya existe para esa fecha+nombre+org)
- Devuelve las sugerencias generadas

### PARTE 2: Auto-actualización

Crea `supabase/functions/refresh-holiday-suggestions/index.ts`:
- Edge Function que se puede llamar con un cron job de Supabase o manualmente
- Llama a `generate-holiday-suggestions` para el año actual y el siguiente
- Marca como "outdated" las sugerencias de años anteriores
- Agrega flag `is_ai_generated: true` vs sugerencias manuales del usuario
- Lógica: si una fecha ya fue "accepted" o "dismissed", NO la sobrescribe

### PARTE 3: Tabla Supabase — `holiday_suggestions`

Crea migración `supabase/migrations/xxx_holiday_suggestions.sql`:
```sql
CREATE TABLE public.holiday_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('co', 'us', 'both')),
  category TEXT NOT NULL CHECK (category IN ('cultural', 'commercial', 'brand', 'seasonal')),
  expected_impact TEXT NOT NULL CHECK (expected_impact IN ('high', 'medium', 'low')),
  why_now TEXT,
  quarter_peak TEXT CHECK (quarter_peak IN ('q1', 'q2', 'q3', 'q4')),
  suggested_event_type TEXT,
  campaign_idea TEXT,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'dismissed')),
  is_ai_generated BOOLEAN DEFAULT true,
  source_model TEXT DEFAULT 'gemini-2.0-flash',
  year INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name, date)
);

-- RLS
ALTER TABLE public.holiday_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own org suggestions" ON public.holiday_suggestions
  FOR SELECT USING (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own org suggestions" ON public.holiday_suggestions
  FOR UPDATE USING (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Service role can insert" ON public.holiday_suggestions
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_holiday_suggestions_org_year ON public.holiday_suggestions(org_id, year);
CREATE INDEX idx_holiday_suggestions_date ON public.holiday_suggestions(date);
```

### PARTE 4: Hook `useHolidaySuggestions.ts`

- Query: listar sugerencias por org_id, filtrable por year, market, quarter_peak, status
- Mutations:
  - `generateSuggestions(year)` — invoca la Edge Function `generate-holiday-suggestions`
  - `acceptSuggestion(id)` — cambia status a "accepted" Y crea un MarketingEvent automáticamente (tipo cultural_moment o promotion según suggested_event_type)
  - `dismissSuggestion(id)` — cambia status a "dismissed"
  - `restoreSuggestion(id)` — vuelve a "suggested"
  - `addManualSuggestion(data)` — agregar fecha manual (is_ai_generated: false)
- Usa TanStack Query con el mismo patrón que useMarketingEvents.ts

### PARTE 5: Componente `HolidaySuggestionPanel.tsx`

- Panel colapsable en la parte superior del calendario
- Botón "✨ Generar sugerencias con IA" que llama a generateSuggestions(currentYear)
  - Loading state con skeleton animations
  - Toast de éxito: "X nuevas fechas sugeridas por Gemini"
- Vista de timeline anual mostrando los 4 quarters con sus peaks
- Cards para cada sugerencia con:
  - Fecha formateada en español
  - Nombre del holiday
  - Bandera del mercado: 🇨🇴 para CO, 🇺🇸 para US, ambas para "both"
  - Badge de impacto (high=rojo, medium=amber, low=gray)
  - "Why Now?" expandible (generado por Gemini)
  - "💡 Idea de campaña" expandible (generado por Gemini)
  - Badge "IA" si is_ai_generated, "Manual" si no
- Botón "Agregar al Calendario" → acceptSuggestion → crea MarketingEvent
- Botón "Descartar" → dismissSuggestion
- Botón "+ Agregar fecha manual" → formulario inline
- Animaciones de entrada escalonadas (staggered) usando Framer Motion
- Filtros por: quarter, mercado, impacto, estado, fuente (IA/Manual)
- Indicador: "Última actualización: hace 3 días" con botón de refresh

### PARTE 6: Integrar en MarketingCalendarPage.tsx

- Agregar el panel encima del calendario existente
- Badge contador de "X sugerencias pendientes" en el header
- Las fechas aceptadas aparecen en el calendario con ícono ✨
- NO modifiques la lógica existente del calendario. Solo AGREGA.

## Estilo Visual
- Seguir el design system existente (shadcn/ui + Tailwind)
- Cards con borde izquierdo de color según quarter peak:
  - Q1 (Hot Days): naranja/fuego 🔥
  - Q2 (Día Madre): rosa/target 🎯
  - Q3 (Frío): azul/montaña 🏔️
  - Q4 (BF+Nav): amarillo/rayo ⚡
- Diferenciar visualmente CO 🇨🇴 vs US 🇺🇸 con colores sutiles de fondo
- Animaciones sutiles (referencia: emil-design-eng)
- Empty state motivacional cuando no hay sugerencias

## Archivos de referencia
- `supabase/functions/generate-ai-image/index.ts` — PATRÓN EXACTO para Edge Function con Gemini
- `src/pages/MarketingCalendarPage.tsx` — Página principal a modificar
- `src/hooks/useMarketingEvents.ts` — Para entender MarketingEvent y replicar patterns
- Los types de EventType ya incluyen 'cultural_moment'
```

---

## WORKTREE 2: Content Planner Semanal
**Rama:** `feat/content-planner`
**Objetivo:** Sistema de planificación de contenido semana a semana donde el equipo de marketing asigne, ejecute y trackee piezas de contenido.

### Archivos a Crear/Modificar
- `src/pages/ContentPlannerPage.tsx` — **NUEVO** — Página completa del planner
- `src/hooks/useContentPlanner.ts` — **NUEVO** — CRUD + filtros + asignaciones
- `src/components/content-planner/WeekView.tsx` — **NUEVO** — Vista semanal tipo Kanban
- `src/components/content-planner/ContentCard.tsx` — **NUEVO** — Card de pieza de contenido
- `src/components/content-planner/ContentForm.tsx` — **NUEVO** — Formulario de creación/edición
- `supabase/migrations/xxx_content_planner.sql` — **NUEVO** — Tablas
- Agregar ruta en el router y link en sidebar si existe

### Modelo de Datos
```typescript
interface ContentPiece {
  id: string;
  org_id: string;
  title: string;
  description: string;
  content_type: 'reel' | 'carousel' | 'story' | 'static_post' | 'tiktok' | 'live' | 'ugc' | 'email' | 'blog';
  platform: 'instagram' | 'tiktok' | 'facebook' | 'email' | 'blog' | 'whatsapp';
  status: 'idea' | 'briefed' | 'in_production' | 'review' | 'approved' | 'scheduled' | 'published';
  assigned_to: string; // user_id
  scheduled_date: string;
  scheduled_time: string;
  copy_text: string;
  hashtags: string[];
  assets_needed: string; // descripción de assets
  assets_url: string; // link a carpeta de assets
  approval_notes: string;
  week_number: number;
  year: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

### Prompt para el Agent

```
Eres un agente de desarrollo frontend senior trabajando en Sewdle-co (Dosmicos).

## Contexto
Dosmicos necesita un Content Planner donde el equipo de marketing pueda planificar contenido semana a semana. El equipo necesita ver quién es responsable de cada pieza, en qué estado está, y qué se publica cada día.

## Skills que DEBES leer antes de escribir código
1. `.agents/skills/ui-ux-pro-max/SKILL.md` — Para UX patterns, accesibilidad, y componentes
2. `.agents/skills/frontend-design/SKILL.md` — Para diseño visual distintivo
3. `.agents/skills/emil-design-eng/SKILL.md` — Para animaciones de drag & drop y transiciones

## Stack
React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase + date-fns + Framer Motion + @dnd-kit (ya instalado)

## Tarea
Crea un sistema completo de Content Planner integrado en el Mrk Calendario.

1. **Tabla Supabase `content_pieces`:**
   - id (uuid), org_id, title, description, content_type (enum: reel/carousel/story/static_post/tiktok/live/ugc/email/blog)
   - platform (enum: instagram/tiktok/facebook/email/blog/whatsapp)
   - status (enum: idea/briefed/in_production/review/approved/scheduled/published)
   - assigned_to (uuid, ref profiles), scheduled_date, scheduled_time
   - copy_text, hashtags (text[]), assets_needed, assets_url, approval_notes
   - week_number (int), year (int), created_by (uuid), created_at, updated_at
   - RLS policies para org_id

2. **Hook `useContentPlanner.ts`:**
   - Query por semana (week_number + year) con filtros por platform, status, assigned_to
   - CRUD completo con optimistic updates (patrón TanStack Query como los otros hooks)
   - Función para mover contenido entre días (drag & drop update)
   - Función para cambiar status
   - Contadores por status para la semana

3. **Página `ContentPlannerPage.tsx`:**
   - Header con navegación de semanas (← Semana 14 →) y mes/año
   - Vista principal: 7 columnas (Lun-Dom), cada una con las content pieces de ese día
   - Sidebar derecho colapsable con: filtros por plataforma, responsable, estado
   - Botón "+" flotante para crear nueva pieza
   - Vista alternativa: lista/tabla para ver todas las piezas de la semana

4. **Componente `ContentCard.tsx`:**
   - Badge de plataforma con icono (IG rosa, TikTok negro, FB azul, etc.)
   - Avatar del responsable + nombre
   - Status pill con color (idea=gray, briefed=blue, in_production=amber, review=purple, approved=green, scheduled=cyan, published=emerald)
   - Hora programada si existe
   - Click para expandir/editar
   - Drag handle para mover entre días usando @dnd-kit

5. **Componente `ContentForm.tsx` (Dialog):**
   - Formulario completo con todos los campos
   - Selector de content_type con iconos
   - Selector de plataforma con logos
   - Selector de responsable (dropdown de miembros del equipo)
   - Campo de copy con contador de caracteres (límites por plataforma)
   - Campo de hashtags con tags
   - Date + time picker
   - Status selector

6. **Integración con Mrk Calendario:**
   - Agregar tab o sección en MarketingCalendarPage.tsx para acceder al Content Planner
   - O crear como página separada accesible desde el sidebar bajo "Marketing"

## UX Crítico
- Drag & drop FLUIDO para mover contenido entre días
- Colores consistentes por plataforma en TODA la UI
- Mobile-friendly: en móvil, vista de un día a la vez con swipe
- Empty states motivacionales para días sin contenido
- Micro-animaciones al cambiar status (confetti sutil al pasar a "published")

## Referencia
Mira cómo están estructurados los hooks existentes en src/hooks/ (especialmente useMarketingEvents.ts) para mantener consistencia en patterns de Supabase + TanStack Query.
```

---

## WORKTREE 3: Instagram/Facebook Analytics Extractor
**Rama:** `feat/social-analytics-meta`
**Objetivo:** Sistema para extraer datos de posts orgánicos de IG/FB via Meta Graph API y analizar qué tipo de contenido tiene mejor performance.

### Archivos a Crear/Modificar
- `src/hooks/useMetaSocialAnalytics.ts` — **NUEVO** — Extracción y análisis de datos
- `src/pages/SocialAnalyticsPage.tsx` — **NUEVO** — Dashboard de analytics sociales
- `src/components/social-analytics/PostPerformanceTable.tsx` — **NUEVO**
- `src/components/social-analytics/ContentTypeAnalysis.tsx` — **NUEVO**
- `src/components/social-analytics/EngagementPatterns.tsx` — **NUEVO**
- `supabase/migrations/xxx_social_posts.sql` — **NUEVO**
- `supabase/functions/sync-meta-posts/index.ts` — **NUEVO** — Edge function para sync

### Modelo de Datos
```typescript
interface SocialPost {
  id: string;
  org_id: string;
  platform: 'instagram' | 'facebook';
  post_id: string; // ID de Meta
  post_type: 'image' | 'carousel' | 'reel' | 'story' | 'video' | 'text';
  caption: string;
  hashtags: string[];
  published_at: string;
  permalink: string;
  thumbnail_url: string;
  // Engagement metrics
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  engagement_rate: number;
  // Reel-specific
  plays: number;
  avg_watch_time: number;
  // Computed
  content_category: string; // AI-tagged: educational, lifestyle, product, ugc, etc.
  performance_score: number; // Composite score
  synced_at: string;
}
```

### Prompt para el Agent

```
Eres un agente de desarrollo fullstack trabajando en Sewdle-co (Dosmicos).

## Contexto
Dosmicos necesita extraer datos de sus publicaciones orgánicas de Instagram y Facebook para analizar qué tipo de contenido funciona mejor. Ya tienen integración con Meta Ads (ver useMetaAdsConnection.ts y MetaAdsConnectionModal.tsx). Necesitamos extender esto para posts orgánicos.

## Skills que DEBES leer antes de escribir código
1. `.agents/skills/prophit-system-dosmicos/SKILL.md` — El análisis debe seguir la jerarquía: engagement que GENERA REVENUE > vanity metrics. Conexión con contribución al Active Customer File.
2. `.agents/skills/ui-ux-pro-max/SKILL.md` — Para dashboard de analytics
3. `.agents/skills/frontend-design/SKILL.md` — Para visualizaciones de datos

## Stack
React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase + Recharts + date-fns

## Tarea

1. **Tabla Supabase `social_posts`:**
   - id, org_id, platform (instagram/facebook), external_post_id
   - post_type (image/carousel/reel/story/video/text)
   - caption, hashtags (text[]), published_at, permalink, thumbnail_url
   - likes, comments, shares, saves, reach, impressions
   - engagement_rate (computed: (likes+comments+shares+saves)/reach)
   - plays (nullable, para reels/video), avg_watch_time (nullable)
   - content_category (text), performance_score (float)
   - synced_at, created_at
   - Índices en: org_id, platform, published_at, post_type
   - RLS por org_id

2. **Hook `useMetaSocialAnalytics.ts`:**
   - Reutilizar la conexión Meta existente (useMetaAdsConnection ya tiene el token)
   - Función de sync que llama a Meta Graph API:
     - `GET /{page-id}/feed?fields=id,message,created_time,permalink_url,type,attachments,insights.metric(post_impressions,post_engaged_users,post_reactions_by_type_total,post_clicks)` para Facebook
     - `GET /{ig-user-id}/media?fields=id,caption,media_type,permalink,thumbnail_url,timestamp,like_count,comments_count,insights.metric(reach,impressions,saved,shares)` para Instagram
   - Queries de análisis:
     - `getPostsByType()` — Agrupado por post_type con avg de cada métrica
     - `getTopPosts()` — Top 20 por engagement_rate
     - `getEngagementTrend()` — Evolución semanal de engagement
     - `getContentCategoryAnalysis()` — Performance por categoría de contenido
     - `getBestPostingTimes()` — Análisis de hora/día vs engagement
     - `getHashtagPerformance()` — Cuáles hashtags correlacionan con más reach

3. **Página `SocialAnalyticsPage.tsx`:**
   - Header con selector de plataforma (IG/FB/ambos) y rango de fechas
   - Botón "Sync Posts" que dispara la extracción
   - KPI cards arriba: Total posts, Avg engagement rate, Best post type, Reach trend

4. **Componente `ContentTypeAnalysis.tsx`:**
   - Gráfico de barras comparando performance por tipo de post
   - Para cada tipo: avg engagement rate, avg reach, avg saves, count
   - Highlight del "winner" con explicación
   - Tabla detallada expandible

5. **Componente `PostPerformanceTable.tsx`:**
   - Tabla con thumbnail, caption (truncado), tipo, fecha, likes, comments, saves, shares, reach, engagement_rate
   - Sorteable por cualquier columna
   - Filtrable por tipo de post y rango de engagement
   - Click para ver detalle completo

6. **Componente `EngagementPatterns.tsx`:**
   - Heatmap de mejor día/hora para publicar
   - Gráfico de tendencia de engagement over time
   - Top hashtags por performance
   - Insight automático: "Tus Reels tienen 3.2x más engagement que tus carousels"

## Análisis Inteligente (Prophit System)
- NO es solo vanity metrics. El análisis debe responder:
  - "¿Qué tipo de contenido genera más SAVES?" (saves = intención de compra)
  - "¿Qué contenido atrae al avatar target de Dosmicos (mamás 25-35)?"
  - "¿Cuál es el contenido que mejor alimenta el Customer File?"
- Generar insights automáticos tipo: "Los reels de producto en uso tienen 2.8x más saves que los flat-lays"
- Performance Score = weighted: saves(0.3) + shares(0.25) + comments(0.2) + engagement_rate(0.15) + reach(0.1)

## Referencia
- `src/hooks/useMetaAdsConnection.ts` — Token y conexión Meta existente
- `src/components/finance-dashboard/MetaAdsConnectionModal.tsx` — UI de conexión
- `src/hooks/useAdIntelligence.ts` — Pattern de análisis de dimensiones que puedes replicar
```

---

## WORKTREE 4: TikTok Analytics Extractor
**Rama:** `feat/social-analytics-tiktok`
**Objetivo:** Sistema paralelo al de Meta pero para TikTok, con análisis de qué contenido performa mejor.

### Archivos a Crear/Modificar
- `src/hooks/useTikTokAnalytics.ts` — **NUEVO**
- `src/hooks/useTikTokConnection.ts` — **NUEVO** — OAuth flow para TikTok
- `src/components/social-analytics/TikTokDashboard.tsx` — **NUEVO**
- `src/components/social-analytics/TikTokConnectionModal.tsx` — **NUEVO**
- `supabase/migrations/xxx_tiktok_posts.sql` — **NUEVO**

### Prompt para el Agent

```
Eres un agente de desarrollo fullstack trabajando en Sewdle-co (Dosmicos).

## Contexto
Dosmicos necesita extraer datos de TikTok para analizar qué tipo de contenido funciona mejor. Esto es PARALELO al sistema de Meta (WT-3), pero con su propia conexión OAuth y métricas específicas de TikTok.

## Skills que DEBES leer antes de escribir código
1. `.agents/skills/prophit-system-dosmicos/SKILL.md` — Análisis orientado a revenue, no vanity metrics
2. `.agents/skills/ui-ux-pro-max/SKILL.md` — Para dashboard
3. `.agents/skills/frontend-design/SKILL.md` — Diseño visual

## Stack
React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase + Recharts

## Tarea

1. **Tabla Supabase `tiktok_posts`:**
   - id, org_id, external_video_id, caption, hashtags (text[])
   - published_at, video_url, thumbnail_url, duration_seconds
   - views, likes, comments, shares, saves
   - avg_watch_time, full_video_watched_rate
   - reach, engagement_rate
   - content_category (text), performance_score (float)
   - sound_name (text), is_original_sound (boolean)
   - synced_at, created_at
   - RLS por org_id

2. **Hook `useTikTokConnection.ts`:**
   - OAuth 2.0 flow para TikTok Business API
   - Almacenar tokens en Supabase (tabla `tiktok_connections`: org_id, access_token, refresh_token, expires_at, tiktok_user_id)
   - Refresh token automático
   - Estado de conexión reactivo

3. **Componente `TikTokConnectionModal.tsx`:**
   - Similar a MetaAdsConnectionModal pero para TikTok
   - Logo TikTok, instrucciones paso a paso
   - Estado de conexión (conectado/desconectado/error)
   - Botón de reconectar

4. **Hook `useTikTokAnalytics.ts`:**
   - Sync via TikTok Content Publishing API / Research API:
     - `GET /v2/video/list/` con fields: id, title, create_time, share_url, duration, cover_image_url
     - `GET /v2/video/query/` para métricas detalladas
   - Análisis:
     - `getVideosByPerformance()` — Ranked por performance_score
     - `getContentPatterns()` — Qué duración, hashtags, sonidos funcionan mejor
     - `getViralityAnalysis()` — Share rate vs view-to-like ratio
     - `getBestPostingTimes()` — Hora/día óptimo
     - `getSoundAnalysis()` — Original vs trending sounds performance
     - `getWatchTimeAnalysis()` — Retención por duración de video

5. **Componente `TikTokDashboard.tsx`:**
   - KPIs: Total videos, Avg views, Avg engagement rate, Best performing category
   - Gráfico de performance por duración de video (¿10s, 30s, 60s?)
   - Top videos grid con thumbnails
   - Sound analysis: original vs trending
   - Watch time funnel: % que ve 25%, 50%, 75%, 100%
   - Heatmap de mejores horas para publicar

6. **Integración con SocialAnalyticsPage:**
   - Agregar tab "TikTok" junto a "Instagram" y "Facebook"
   - O sección separada en la misma página con toggle

## Análisis (Prophit System)
- TikTok es canal de AWARENESS para Dosmicos → medir: shares (viralidad) y profile visits (conversión a follower)
- Performance Score TikTok = views(0.15) + full_watch_rate(0.30) + shares(0.25) + saves(0.20) + comments(0.10)
- Insight clave: "¿Qué contenido lleva a la gente del TikTok al link in bio?"
- Identificar: contenido educational vs entertaining vs product-focused — cuál genera más action

## Referencia
- `src/hooks/useMetaAdsConnection.ts` — Patrón de OAuth a replicar
- `src/components/finance-dashboard/MetaAdsConnectionModal.tsx` — UI patrón
- Si WT-3 ya creó `SocialAnalyticsPage.tsx`, intégralo ahí. Si no, crea la estructura.
```

---

## WORKTREE 5: Remover Mensajes Recibidos
**Rama:** `fix/remove-messages-metric`
**Objetivo:** Quitar la métrica de "Mensajes" del tracking de actividad en Mrk Calendario.

### Archivos a Modificar
- `src/hooks/useMarketingActivity.ts` — Remover query de messaging_messages y campo messagesSent
- `src/components/finance-dashboard/ActivityRevenueChart.tsx` — Remover canal "Mensajes" del chart

### Prompt para el Agent

```
Eres un agente de desarrollo frontend trabajando en Sewdle-co.

## Tarea SIMPLE
Quita la métrica de "Mensajes" (messages sent/received) del sistema de tracking de actividad del Marketing Calendar.

## Archivos a modificar

### 1. `src/hooks/useMarketingActivity.ts`
- Elimina la query a la tabla `messaging_messages` (busca la sección que hace .from('messaging_messages'))
- Elimina `messagesSent` del interface `DailyActivity`
- Elimina `messagesSent` del interface `ActivitySummary`
- Elimina messagesSent de la agregación diaria y del cálculo de `totalActions`
- Actualiza totalActions para que NO incluya messages

### 2. `src/components/finance-dashboard/ActivityRevenueChart.tsx`
- Elimina el canal "Mensajes" del array CHANNELS (el que tiene color #10b981 verde)
- Elimina cualquier referencia a `messagesSent` en el componente
- Elimina el dataKey correspondiente del ComposedChart/stacked bars

## IMPORTANTE
- NO toques nada más. Solo elimina lo relacionado con mensajes.
- Asegúrate de que el totalActions se recalcule correctamente sin messages.
- Verifica que TypeScript compile sin errores después de los cambios.
- Ejecuta el build para verificar: npm run build
```

---

## WORKTREE 6: Intelligence Page Review
**Rama:** `analysis/intelligence-improvements`
**Objetivo:** Analizar la pantalla de Ad Intelligence y proponer mejoras concretas.

### Archivos a Analizar
- `src/pages/AdIntelligencePage.tsx`
- `src/hooks/useAdIntelligence.ts`
- `src/hooks/useAdCreativeSync.ts`
- `src/components/finance-dashboard/ProductMVPMatrix.tsx`

### Prompt para el Agent

```
Eres un equipo de análisis compuesto por:
- **Analista de Producto** (UX/UI expert)
- **Analista de Marketing** (Prophit System expert)
- **Ingeniero Frontend** (implementación)

## Skills que DEBES leer antes de analizar
1. `.agents/skills/prophit-system-dosmicos/SKILL.md` — COMPLETO, incluyendo las referencias en la carpeta references/
2. `.agents/skills/ui-ux-pro-max/SKILL.md` — Para evaluar UX actual
3. `.agents/skills/frontend-design/SKILL.md` — Para evaluar diseño visual

## Tarea
Analiza a fondo la pantalla de Ad Intelligence y genera un REPORTE DETALLADO con mejoras.

### Paso 1: Lee todos los archivos
- `src/pages/AdIntelligencePage.tsx` — Página completa
- `src/hooks/useAdIntelligence.ts` — Lógica de análisis
- `src/hooks/useAdCreativeSync.ts` — Sync de creativos
- `src/components/finance-dashboard/ProductMVPMatrix.tsx` — Matriz MVP

### Paso 2: Evalúa con lente del Prophit System
- ¿La página sigue la jerarquía de métricas? (CM > Business > Customer > Channel)
- ¿Muestra Contribution Margin como métrica principal o solo ROAS?
- ¿Conecta el performance de ads con el impacto en el negocio real?
- ¿La MVP Matrix sigue la lógica de Champions/Growth Drivers/Hidden Gems/Underperformers correctamente?
- ¿Hay diagnóstico de "Creative Diversification"? (no depender de 1 solo creative)
- ¿Se puede identificar el Ad Creative Lifecycle? (launch → scale → fatigue → retire)

### Paso 3: Evalúa UX/UI
- ¿La información más importante es lo primero que ves?
- ¿Hay information overload?
- ¿Los PatternCards son útiles o solo noise?
- ¿Se puede tomar ACCIÓN desde esta pantalla? (actionable insights vs. just data)
- ¿Falta algo que el media buyer necesita ver DIARIAMENTE?
- ¿Cómo se compara con tools como Motion, Triple Whale, Northbeam?

### Paso 4: Genera el reporte
Crea un archivo `INTELLIGENCE-IMPROVEMENTS.md` en la raíz del proyecto con:

1. **Estado Actual** — Qué hace bien la pantalla hoy
2. **Gaps vs Prophit System** — Qué falta según el framework
3. **Problemas UX** — Issues de usabilidad y hierarchy de información
4. **Mejoras Propuestas** (priorizadas P0/P1/P2):
   - P0 (críticas): Lo que falta y DEBE estar
   - P1 (importantes): Mejoras significativas
   - P2 (nice-to-have): Polish y extras
5. **Mockups en texto** — Wireframes ASCII de cómo debería verse
6. **Plan de implementación** — Archivos a crear/modificar, orden de ejecución

Sé ESPECÍFICO. No generalidades. Cada mejora debe decir exactamente QUÉ componente, QUÉ dato, y POR QUÉ.
```

---

## Orden de Ejecución Recomendado

```
Fase 1 (pueden correr en paralelo):
├── WT-5: Remove Messages (5 min) ← Más rápido, hazlo primero
├── WT-6: Intelligence Review (15 min) ← Solo análisis, no bloquea nada
└── WT-1: Holiday AI Calendar (30-45 min)

Fase 2 (pueden correr en paralelo):
├── WT-2: Content Planner (45-60 min)
├── WT-3: IG/FB Analytics (45-60 min)
└── WT-4: TikTok Analytics (45-60 min)
```

## Cómo Ejecutar

Para cada worktree, usa este formato en Claude:

```
Ejecuta el Worktree X con isolation: "worktree" usando el prompt que está en PLAN-WORKTREES-6-TAREAS.md
```

O ejecuta varios en paralelo:

```
Ejecuta en paralelo los Worktrees 1, 5 y 6 con isolation: "worktree"
```

---

## Notas de Merge

Después de que cada worktree termine:
1. Revisa los cambios en la rama
2. Haz merge a main en este orden para evitar conflictos:
   - WT-5 primero (cambios más pequeños)
   - WT-1 segundo (solo agrega al calendario)
   - WT-6 tercero (solo genera reporte)
   - WT-2 cuarto (página nueva, independiente)
   - WT-3 quinto (página nueva + tablas)
   - WT-4 último (depende de que WT-3 cree la estructura base)
