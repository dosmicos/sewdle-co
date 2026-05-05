# Propuestas de Automatización - Sewdle

Análisis del proyecto sewdle-co para identificar oportunidades de automatización usando Claude Desktop y Claude Code.

## Estado Actual del Proyecto

### Stack Tecnológico
- **Frontend**: React 18 + TypeScript + Vite (puerto 8080)
- **Backend**: Supabase (auth, DB, edge functions, realtime)
- **Integraciones**: Shopify, Meta/WhatsApp, Google Ads, Stripe, Alegra
- **Deploy**: Vercel (SPA con rewrite en vercel.json)
- **UI**: Tailwind CSS + shadcn/ui (Radix-based)

### Herramientas Existentes
- **Launch Config**: `.claude/launch.json` (config básica de desarrollo)
- **Settings Local**: `.claude/settings.local.json` (permisos específicos para Supabase/Git)
- **Scripts**: `scripts/` con 3 shell scripts para campañas HotDays (send-hotdays-*.sh)
- **Edge Functions**: ~80 funciones Supabase (webhooks, sync, integraciones)
- **No hay**: hooks de Claude Code configurados, triggers/cron establecidos, scripts de mantenimiento

---

## Propuestas de Automatización

### Categoría 1: Sincronización de Datos (Backend - Supabase)

#### Propuesta 1.1: Sync Automático Diario de Shopify (FÁCIL)
**Qué automatiza**: Sincronización de pedidos, inventario y productos de Shopify cada día a horarios específicos.

**Herramienta Claude**: **Supabase Scheduled Functions** + **Claude Schedule Skill**

**Cómo funciona**:
- Crear edge function `sync-shopify-daily` que llame a `sync-shopify-sales`, `sync-inventory-shopify`, `sync-all-shopify-products`
- Configurar cron en `supabase/config.toml`: `cron = "0 2 * * *"` (2 AM UTC)
- Usa el skill `schedule` para crear trigger remoto que ejecute la función

**Beneficio esperado**:
- Datos siempre frescos sin intervención manual
- Detecta cambios en pedidos, stock y productos automáticamente
- Integración natural con Supabase (sin costos adicionales)

**Complejidad**: 🟢 **FÁCIL**
- Edge function ya existe (sync-shopify-sales)
- Solo necesita envolver múltiples syncs
- Configuración Supabase es straightforward

---

#### Propuesta 1.2: Sync Automático de Métricas Publicitarias (Meta + Google Ads) (MEDIO)
**Qué automatiza**: Actualización diaria de métricas de Meta Ads y Google Ads para el dashboard financiero.

**Herramienta Claude**: **Supabase Scheduled Functions** + **Claude Schedule Skill**

**Cómo funciona**:
- Extender/crear `sync-meta-ad-performance` y `sync-google-ads` con manejo de errores robusto
- Schedule: `0 8 * * *` (8 AM UTC - después de cambio de día en reportes)
- En Finance Dashboard (finance.sewdle.co), se actualizarían métricas automáticamente

**Beneficio esperado**:
- Dashboard financiero siempre tiene data actual
- Evita correr syncs manuales de Meta/Google
- Detecta cambios en ROAS, CPC, conversiones automáticamente
- Necesario para la Fase 2 del Finance Dashboard

**Complejidad**: 🟡 **MEDIO**
- Ya hay funciones base para Meta y Google Ads
- Necesita manejo de OAuth refresh tokens automático
- Validación de límites de rate de APIs

---

#### Propuesta 1.3: Poblado Automático de Cobertura de Envío (FÁCIL)
**Qué automatiza**: Sincronización de ciudades/departamentos de Envia para cobertura de envío.

**Herramienta Claude**: **Supabase Scheduled Functions** + **Claude Schedule Skill**

**Cómo funciona**:
- Ya existe `populate-shipping-coverage`
- Schedule: `0 0 1 * *` (primer día del mes a medianoche)
- O al crear nueva organización (trigger automático)

**Beneficio esperado**:
- Cobertura de envío siempre actualizada
- Previene errores por ciudades faltantes
- Sin intervención manual mensual

**Complejidad**: 🟢 **FÁCIL**
- Función ya existe
- Solo agregar scheduling

---

### Categoría 2: Integración de Webhooks + IA (Tiempo Real)

#### Propuesta 2.1: Auto-Tagging Inteligente de Órdenes Pegadas (MEDIO)
**Qué automatiza**: Detectar y resolver órdenes "pegadas" (no procesadas a pesar de ser pagadas).

**Herramienta Claude**: **Claude Code Hooks** + **Supabase RLS/Triggers**

**Cómo funciona**:
- Crear un hook de Claude que se dispare cuando se ejecuta `perform-editing-operations` en ordenes
- Hook detecta órdenes "stuck" (paid pero no fulfilled) por >6 horas
- Automáticamente las taguea con "REVISAR-MANUALMENTE" o ejecuta `messaging-ai-openai` para análisis
- Ver commit: "d846e92 refactor(orders): replace cron with conversation tagging for stuck orders"

**Beneficio esperado**:
- Órdenes pegadas se detectan automáticamente
- Se avisa al equipo de operaciones sin delay
- Reduce time-to-resolution significativamente

**Complejidad**: 🟡 **MEDIO**
- Requiere custom hook en Claude Code
- Integración con RLS policies de Supabase
- Testing en ambiente staging primero

---

#### Propuesta 2.2: Webhook Automático al Crear Órdenes Express (FÁCIL)
**Qué automatiza**: Notificación automática de órdenes express a través de WhatsApp.

**Herramienta Claude**: **Supabase Realtime Subscriptions** + **Claude Code Hook**

**Cómo funciona**:
- Usar Supabase Realtime para detectar nuevas órdenes con tag "express"
- Disparar `whatsapp-webhook` automáticamente
- Hook de Claude Code notifica al equipo de logística

**Beneficio esperado**:
- Órdenes express se procesan en minutos, no horas
- Equipo se enttera instantáneamente
- Integración con sistema existente de WhatsApp

**Complejidad**: 🟢 **FÁCIL**
- Ya existe infraestructura WhatsApp
- Supabase Realtime es nativo

---

### Categoría 3: Calidad de Código y Deployment

#### Propuesta 3.1: Pre-commit Checks Automáticos (FÁCIL)
**Qué automatiza**: Validación de TypeScript y linting antes de hacer commit.

**Herramienta Claude**: **Claude Code Hooks** (`pre-commit`)

**Cómo funciona**:
- Configurar hook `pre-commit` en `.claude/settings.json`
- Ejecuta automáticamente:
  - `npx tsc --noEmit` (validación TS)
  - `npx eslint .` (linting)
  - Bloquea commit si hay errores

**Beneficio esperado**:
- Evita merges con errores TS
- Mantiene consistencia de código
- No depende de CI/CD para feedback
- Feedback inmediato antes de push

**Complejidad**: 🟢 **FÁCIL**
- Hooks son nativos de Claude Code
- Solo necesita configuración en settings.json

---

#### Propuesta 3.2: Deploy Automático de Edge Functions (FÁCIL)
**Qué automatiza**: Deploy a Supabase cuando se modifica una edge function.

**Herramienta Claude**: **Claude Code Hooks** (`post-commit`)

**Cómo funciona**:
- Hook `post-commit` detecta cambios en `supabase/functions/`
- Ejecuta automáticamente: `npx supabase functions deploy <function-name>`
- Logs de deploy se guardan para audit

**Beneficio esperado**:
- Cambios en funciones se deplayan sin pasos manuales
- Sincronización local ↔ cloud automática
- Reduce riesgo de "olvidar deployar"

**Complejidad**: 🟢 **FÁCIL**
- Permisos ya están en settings.local.json
- Hook simple de detección de archivos

---

#### Propuesta 3.3: Auto-Geminator de Migraciones (MEDIO)
**Qué automatiza**: Generar migraciones SQL basadas en cambios de schema.

**Herramienta Claude**: **Claude Code Hooks** (`pre-db-push`)

**Cómo funciona**:
- Cuando se modifica schema (typescript migrations)
- Hook genera automáticamente SQL migration file
- Usa `supabase db push --dry-run` para validar
- Abre editor para aprobación antes de aplicar

**Beneficio esperado**:
- Migraciones se generan automáticamente
- Menos propenso a errores manuales
- Documentación automática de cambios

**Complejidad**: 🟡 **MEDIO**
- Requiere integración con Supabase CLI
- Parsing de schemas

---

### Categoría 4: Mantenimiento y Monitoreo

#### Propuesta 4.1: Limpieza Automática de Branches Obsoletos (FÁCIL)
**Qué automatiza**: Borrar branches merged y eliminados del remote.

**Herramienta Claude**: **Claude Code Hooks** (`post-sync`) + **Skill `commit-commands:clean_gone`**

**Cómo funciona**:
- Después de `git pull origin main`
- Hook ejecuta automáticamente: `Skill(commit-commands:clean_gone)`
- Limpia branches con [gone] marker

**Beneficio esperado**:
- Repositorio siempre limpio
- No acumula branches obsoletos
- Evita confusión en git branch list

**Complejidad**: 🟢 **FÁCIL**
- Skill ya existe
- Solo hook para dispararlo

---

#### Propuesta 4.2: Monitoreo de Logs de Funciones Edge (MEDIO)
**Qué automatiza**: Alertas cuando edge functions fallan o tienen errores.

**Herramienta Claude**: **Claude Loop Skill** + **Scripts de verificación**

**Cómo funciona**:
- Usar skill `/loop 1h` para ejecutar verificación cada hora
- Script revisa últimos 50 logs de funciones críticas:
  - `meta-webhook-openai`
  - `sync-shopify-sales`
  - `whatsapp-webhook`
  - `sync-google-ads`
- Si encuentra errores, notifica a través de comentario en GitHub o email

**Beneficio esperado**:
- Detecta fallos antes de que impacten usuarios
- Time-to-detection se reduce de horas a minutos
- Proactivo vs. reactivo

**Complejidad**: 🟡 **MEDIO**
- Integración con `supabase functions logs`
- Parsing de logs para patrones de error
- Configuración de notificaciones

---

#### Propuesta 4.3: Reporte Semanal de Métricas (MEDIO)
**Qué automatiza**: Generar reporte automático de salud del sistema.

**Herramienta Claude**: **Claude Schedule Skill** + **Query de datos**

**Cómo funciona**:
- Schedule: `0 9 * * 1` (lunes 9 AM)
- Consulta Supabase:
  - Total órdenes procesadas (últimos 7 días)
  - Tasa de sync exitoso (shopify, ads, etc.)
  - Errors en edge functions
  - Performance de API (tiempo promedio)
- Genera markdown report y crea issue en GitHub

**Beneficio esperado**:
- Visibilidad de salud del sistema
- Detecta tendencias de degradación
- Data-driven decision making

**Complejidad**: 🟡 **MEDIO**
- Queries Supabase complejas
- Integración con GitHub API
- Generación de reportes en markdown

---

### Categoría 5: Desarrollo Frontend

#### Propuesta 5.1: Regeneración Automática de Tipos TypeScript (FÁCIL)
**Qué automatiza**: Generar tipos TypeScript de Supabase después de cambios de schema.

**Herramienta Claude**: **Claude Code Hook** (`post-db-push`)

**Cómo funciona**:
- Después de `supabase db push`
- Hook ejecuta: `npx supabase gen types typescript --project-id ysdcsqsfnckeuafjyrbc > src/types/database.types.ts`
- Actualiza tipos automáticamente

**Beneficio esperado**:
- Tipos siempre sincronizados con DB
- Fewer "Type 'X' has no property 'Y'" errors
- Type safety mejorado

**Complejidad**: 🟢 **FÁCIL**
- Comando Supabase CLI es straightforward
- Hook simple de post-event

---

#### Propuesta 5.2: Auto-Format de Código en Guardado (FÁCIL)
**Qué automatiza**: Ejecutar prettier/eslint al guardar cambios.

**Herramienta Claude**: **Claude Code Hook** (`post-edit`)

**Cómo funciona**:
- Después de editar archivos .tsx/.ts
- Hook ejecuta: `npx prettier --write <archivo>`
- Automáticamente formatea código

**Beneficio esperado**:
- Código siempre bien formateado
- No necesita manual prettier run
- Consistencia visual

**Complejidad**: 🟢 **FÁCIL**
- Hook simple de edit detection

---

### Categoría 6: Claude Desktop Project Configuration

#### Propuesta 6.1: Project .claude/CLAUDE.md Automático
**Qué automatiza**: Documentación automática de instrucciones del proyecto.

**Herramienta Claude**: **Claude Desktop Project Config** + **CLAUDE.md**

**Cómo funciona**:
- Crear `.claude/CLAUDE.md` con instrucciones personalizadas para Claude
- Define:
  - Stack y convenciones del proyecto
  - Paths importantes (src/, supabase/, migrations/)
  - Patrones de código preferidos
  - Órdenes de prioridad (performance > arquitectura)
  - Qué NO hacer (no duplicar memory en código, no crear abstracciones prematuras)

```markdown
# Sewdle Project Guide

## Stack
- React 18 + TypeScript + Vite
- Supabase (auth, DB, edge functions)
- Tailwind CSS + shadcn/ui
- Vercel deployment

## Key Architecture
- Auth: Supabase + AuthContext
- Permissions: module + action RBAC
- Org context for multi-tenancy
- Finance dashboard on subdomain

## File Patterns
- Pages: `src/pages/`
- Hooks: `src/hooks/`
- Components: `src/components/<feature>/`
- Edge functions: `supabase/functions/`
- Migrations: `supabase/migrations/`

## Do's
- Read code before proposing changes
- Prefer editing over creating files
- Use established patterns (hooks for logic, components for UI)
- Check existing implementations first

## Don'ts
- Don't create files unnecessarily
- Don't add "improvements" beyond the ask
- Don't abstract premature
- Don't duplicate memory in code
```

**Beneficio esperado**:
- Onboarding automático de nuevas sesiones de Claude
- Consistencia en recomendaciones
- Menos necesidad de re-explicar contexto

**Complejidad**: 🟢 **FÁCIL**
- Solo crear archivo markdown
- No requiere configuración de CLI

---

## Matriz de Priorización

| ID | Propuesta | Impacto | Complejidad | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| 1.1 | Sync Shopify Diario | 🔴 Alto | 🟢 Fácil | 2h | 🔴 P0 |
| 1.2 | Sync Ads Automático | 🟡 Medio | 🟡 Medio | 4h | 🟡 P1 |
| 1.3 | Cobertura Envío | 🟢 Bajo | 🟢 Fácil | 1h | 🟢 P2 |
| 2.1 | Auto-Tagging Órdenes | 🔴 Alto | 🟡 Medio | 4h | 🔴 P0 |
| 2.2 | Webhook Express | 🟡 Medio | 🟢 Fácil | 2h | 🟡 P1 |
| 3.1 | Pre-commit Checks | 🟡 Medio | 🟢 Fácil | 1h | 🟡 P1 |
| 3.2 | Deploy Automático | 🟡 Medio | 🟢 Fácil | 2h | 🟡 P1 |
| 3.3 | Auto-Migraciones | 🟡 Medio | 🟡 Medio | 5h | 🟢 P2 |
| 4.1 | Limpieza Branches | 🟢 Bajo | 🟢 Fácil | 0.5h | 🟢 P2 |
| 4.2 | Monitoreo Logs | 🔴 Alto | 🟡 Medio | 4h | 🔴 P0 |
| 4.3 | Reporte Semanal | 🟡 Medio | 🟡 Medio | 3h | 🟡 P1 |
| 5.1 | Tipos TS Auto | 🟡 Medio | 🟢 Fácil | 1h | 🟡 P1 |
| 5.2 | Auto-Format | 🟢 Bajo | 🟢 Fácil | 0.5h | 🟢 P2 |
| 6.1 | CLAUDE.md | 🟡 Medio | 🟢 Fácil | 1h | 🟡 P1 |

---

## Recomendación de Rollout

### Fase 1 (Semana 1-2): MVP de Automatizaciones
1. **3.1** Pre-commit Checks (protege contra errores early)
2. **6.1** CLAUDE.md (mejora experiencia de desarrollo)
3. **5.1** Tipos TS Auto (reduce bugs de type safety)

**Esfuerzo**: ~2 horas
**Impacto**: Reducción de errores en commits, mejor DX

---

### Fase 2 (Semana 3-4): Automatizaciones de Datos
1. **1.1** Sync Shopify Diario (core business process)
2. **4.2** Monitoreo de Logs (early warning system)
3. **3.2** Deploy Automático (reduce manual steps)

**Esfuerzo**: ~8 horas
**Impacto**: Menos intervención manual, detecta fallos temprano

---

### Fase 3 (Semana 5-6): Inteligencia y Monitoreo
1. **2.1** Auto-Tagging Órdenes (resuelve problema operativo)
2. **4.3** Reporte Semanal (visibilidad)
3. **1.2** Sync Ads Automático (Finance Dashboard)

**Esfuerzo**: ~11 horas
**Impacto**: Operaciones más eficientes, decisiones data-driven

---

## Herramientas Claude a Usar

### Herramientas Clave Identificadas:
1. **Claude Code Hooks**: Triggers pre/post-commit, edit, db-push
2. **Claude Schedule Skill**: Cron jobs para sync y reportes
3. **Supabase Scheduled Functions**: Backend automation con cron
4. **Claude Loop Skill**: Monitoreo periódico de logs
5. **CLAUDE.md**: Documentación de proyecto
6. **Claude Code Settings**: Permisos y configuración

### Configuración Necesaria:
```json
{
  "hooks": {
    "pre-commit": "npx tsc --noEmit && npx eslint .",
    "post-commit": "detect-and-deploy-functions.sh",
    "post-db-push": "npx supabase gen types typescript..."
  },
  "schedule": {
    "sync-shopify-daily": "0 2 * * *",
    "sync-ads-daily": "0 8 * * *",
    "populate-shipping": "0 0 1 * *",
    "check-logs": "0 * * * *",
    "weekly-report": "0 9 * * 1"
  }
}
```

---

## Próximos Pasos

1. ✅ **Análisis completado** (este documento)
2. ⏳ **Analista identificará tareas repetitivas** específicas del usuario
3. ⏳ **Experto-Claude creará guía de implementación paso a paso**
4. ⏳ **Equipo priorizará según contexto operativo actual**

**Nota**: Las propuestas están ordenadas por impacto y dependencias. Las de Fase 1 son independientes y dan valor inmediato.
