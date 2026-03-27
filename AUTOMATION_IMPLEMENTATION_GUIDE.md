# Guía de Implementación - Automatizaciones Sewdle

Documento técnico para el implementador (Task #3). Incluye arquitectura, dependencias y patrones.

---

## 📐 Arquitectura de Automatizaciones

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Desktop (Local)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Hooks (pre/post-commit, pre/post-db-push)            │   │
│  │ • Pre-commit checks (TS, Linting)                     │   │
│  │ • Post-commit deploy functions                        │   │
│  │ • Post-db-push regenerate types                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Schedule Skill + Loop Skill (Experimental)            │   │
│  │ • Ejecuta prompts en intervalo cron                   │   │
│  │ • Depende de sesión Claude abierta                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Local Scripts (Bash, Node)                            │   │
│  │ • scripts/monitor-edge-functions.sh                   │   │
│  │ • scripts/sync-shopify-daily.js                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
├─────────────────────────────────────────────────────────────┤
│                    Git + GitHub (Remote)                      │
├─────────────────────────────────────────────────────────────┤
│ • Webhooks de commits                                         │
│ • CI/CD pipeline (GitHub Actions)                             │
│ • Branch protection rules                                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                 Supabase (Backend Automation)                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Scheduled Functions (Cron Jobs)                       │   │
│  │ • sync-shopify-daily (0 2 * * *)                      │   │
│  │ • sync-google-ads (0 8 * * *)                         │   │
│  │ • populate-shipping-coverage (0 0 1 * *)              │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Database Triggers (RLS Policies)                      │   │
│  │ • Auto-tagging órdenes pegadas                        │   │
│  │ • Validación de datos                                 │   │
│  │ • Notificaciones en tiempo real                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Real-time Subscriptions                               │   │
│  │ • Webhooks de Shopify                                 │   │
│  │ • Meta Webhooks                                       │   │
│  │ • Stripe Webhooks                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Alertas & Notificaciones                              │   │
│  │ • Email                                               │   │
│  │ • Slack (futuro: MCP Slack)                           │   │
│  │ • GitHub Issues (futuro: MCP GitHub)                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  External Services (APIs)                    │
├─────────────────────────────────────────────────────────────┤
│ • Shopify (Orders, Inventory, Products)                      │
│ • Meta (Ad Performance, Webhooks)                            │
│ • Google Ads (Campaigns, Performance)                        │
│ • Stripe (Payments)                                          │
│ • Sendgrid (Email Notifications)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔗 Dependencias Entre Automatizaciones

```
├─ Fase 1: FOUNDATIONAL (Semana 1)
│  ├─ Pre-commit Checks ✅
│  │  └─ Depende de: Nothing
│  ├─ CLAUDE.md ✅
│  │  └─ Depende de: Nothing
│  └─ Tipos TS Auto ✅
│     └─ Depende de: supabase/config.toml
│
├─ Fase 2: DATA PIPELINE (Semana 2)
│  ├─ Sync Shopify Diario
│  │  ├─ Depende de: sync-shopify-sales (existente)
│  │  ├─ Depende de: sync-inventory-shopify (existente)
│  │  └─ Depende de: Supabase scheduled functions
│  ├─ Deploy Automático
│  │  └─ Depende de: Pre-commit Checks ✅
│  └─ Monitoreo Logs
│     └─ Depende de: supabase CLI auth
│
├─ Fase 3: INTELLIGENCE (Semana 3)
│  ├─ Auto-Tagging Órdenes
│  │  ├─ Depende de: Supabase Realtime
│  │  └─ Depende de: RLS Policies
│  ├─ Sync Ads
│  │  ├─ Depende de: Meta OAuth tokens
│  │  ├─ Depende de: Google OAuth tokens
│  │  └─ Depende de: Finance Dashboard DB
│  └─ Reportes Semanales
│     ├─ Depende de: Queries a Supabase
│     └─ Depende de: GitHub API (MCP)
```

---

## 📦 Configuración Necesaria por Automatización

### 1️⃣ Pre-commit Checks

**Archivos a crear/modificar**:
- `.claude/settings.json` → Agregar hook pre-commit

**Dependencias externas**: Ninguna (usa herramientas ya instaladas)

**Comandos necesarios**:
```bash
npx tsc --noEmit      # TypeScript check (3-5 segundos)
npx eslint .           # Linting (5-10 segundos)
```

**Test**:
```bash
# Introducir error TS intencional
echo "const x: number = 'string';" >> src/test.ts
git add src/test.ts
git commit -m "test"  # Debería fallar
git reset HEAD~1
git checkout src/test.ts
```

---

### 2️⃣ Sync Shopify Diario

**Archivos a crear/modificar**:
- `supabase/functions/sync-shopify-daily/index.ts` → Nueva función
- `supabase/config.toml` → Agregar [functions.sync-shopify-daily]

**Dependencias internas**:
- Edge function: `sync-shopify-sales`
- Edge function: `sync-inventory-shopify`
- Edge function: `sync-all-shopify-products`

**Configuración necesaria**:
```bash
# SERVICE_KEY en .claude/settings.local.json (ya existe)
# SUPABASE_URL en variables de entorno (ya existe)
```

**Deploy**:
```bash
npx supabase functions deploy sync-shopify-daily
```

**Test**:
```bash
# Llamar función manualmente
curl -X POST https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-shopify-daily \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json"
```

---

### 3️⃣ Monitoreo de Logs

**Archivos a crear/modificar**:
- `scripts/monitor-edge-functions.sh` → Script de verificación
- `scripts/create-alert-if-errors.sh` → Script de alertas

**Dependencias externas**:
- `supabase` CLI (ya instalado)
- `gh` CLI (para GitHub issues)

**Configuración necesaria**:
```bash
# Supabase auth (ya existe en ~/.config/supabase)
# GitHub token (en ~/.config/gh/hosts.yml)
```

**Test**:
```bash
./scripts/monitor-edge-functions.sh  # Debería listar funciones
npx supabase functions logs meta-webhook-openai --limit 10
```

---

### 4️⃣ Auto-Tagging de Órdenes Pegadas

**Archivos a crear/modificar**:
- `.claude/settings.json` → Hook para detectar cambios de órdenes
- `supabase/migrations/` → RLS policy nueva para auto-tagging

**Dependencias internas**:
- `shopify_orders` table
- `messaging-ai-openai` edge function
- Supabase Realtime subscriptions

**RLS Policy necesaria**:
```sql
-- Detectar órdenes > 6 horas stuck (paid pero no fulfilled)
-- Automáticamente agregar tag "REVISAR-MANUALMENTE"

CREATE OR REPLACE FUNCTION auto_tag_stuck_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- Si orden es paid y fulfillment_status es null/pending y > 6 horas
  IF NEW.financial_status = 'paid'
     AND (NEW.fulfillment_status IS NULL OR NEW.fulfillment_status = 'pending')
     AND (EXTRACT(EPOCH FROM (NOW() - NEW.updated_at)) / 3600) > 6
  THEN
    -- Agregar tag
    UPDATE shopify_orders
    SET tags = CONCAT(tags, ', REVISAR-MANUALMENTE')
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_tag_stuck_orders
AFTER INSERT OR UPDATE ON shopify_orders
FOR EACH ROW
EXECUTE FUNCTION auto_tag_stuck_orders();
```

---

### 5️⃣ Regenerar Tipos TypeScript

**Archivos a crear/modificar**:
- `.claude/settings.json` → Hook post-db-push

**Dependencias externas**: Ninguna

**Hook**:
```json
{
  "hooks": {
    "post-db-push": "npx supabase gen types typescript --project-id ysdcsqsfnckeuafjyrbc > src/types/database.types.ts"
  }
}
```

**Test**:
```bash
# Hacer cambio dummy en migrations
# Ejecutar: supabase db push
# Verificar que src/types/database.types.ts fue regenerado
```

---

## 🔐 Secrets y Credentials Necesarios

### Para Sync Shopify
- `SHOPIFY_API_KEY` → En Supabase secrets
- `SHOPIFY_API_PASSWORD` → En Supabase secrets
- `SHOPIFY_STORE_NAME` → En Supabase secrets

**Verificar**:
```bash
npx supabase secrets list
```

### Para Sync Ads
- `META_ACCESS_TOKEN` → En Supabase secrets
- `META_BUSINESS_ACCOUNT_ID` → En Supabase secrets
- `GOOGLE_ADS_DEVELOPER_TOKEN` → En Supabase secrets

### Para Notificaciones
- `SENDGRID_API_KEY` → En Supabase secrets (opcional)
- `SLACK_BOT_TOKEN` → En Supabase secrets (futuro)

---

## 🧪 Estrategia de Testing

### Nivel 1: Local Testing
```bash
# Pre-commit checks
git commit -m "test" --dry-run

# Scripts
bash scripts/monitor-edge-functions.sh

# Hooks
echo "test" >> src/test.ts && git add src/test.ts && git commit -m "test"
```

### Nivel 2: Staging Testing
```bash
# Deploy función a staging
npx supabase functions deploy sync-shopify-daily --env staging

# Test llamada
curl -X POST https://staging.supabase.co/functions/v1/sync-shopify-daily
```

### Nivel 3: Production Rollout
```bash
# Deploy a producción
npx supabase functions deploy sync-shopify-daily

# Verificar en logs
npx supabase functions logs sync-shopify-daily --limit 50
```

### Nivel 4: Monitoring
```bash
# Monitoreo continuo
/loop 1h "Ejecutar scripts/monitor-edge-functions.sh"
```

---

## 📋 Checklist de Implementación

### Pre-requisitos
- [ ] Acceso a Supabase project (ysdcsqsfnckeuafjyrbc)
- [ ] Acceso a GitHub (anthropics/sewdle-co)
- [ ] Credenciales de Shopify (API key + password)
- [ ] SERVICE_KEY de Supabase en settings.local.json

### Fase 1: Foundational (4 horas)
- [ ] Crear `.claude/CLAUDE.md` con guía del proyecto
- [ ] Agregar hook `pre-commit` en settings.json
- [ ] Test pre-commit checks localmente
- [ ] Crear hook `post-db-push` para regenerar tipos
- [ ] Test regeneración de tipos (hacer dummy migration)

### Fase 2: Data Pipeline (6 horas)
- [ ] Crear `supabase/functions/sync-shopify-daily/index.ts`
- [ ] Agregar función en supabase/config.toml
- [ ] Deploy función
- [ ] Test manual de función
- [ ] Crear `scripts/monitor-edge-functions.sh`
- [ ] Test monitoreo localmente

### Fase 3: Intelligence (8 horas)
- [ ] Crear migration para auto-tagging RLS policy
- [ ] Deploy migration
- [ ] Test RLS policy con datos reales
- [ ] Crear `sync-google-ads` edge function
- [ ] Integrar con Finance Dashboard DB
- [ ] Crear script de reporte semanal

### Post-Implementation
- [ ] Documentar en team wiki
- [ ] Training para equipo
- [ ] Crear runbook de troubleshooting
- [ ] Setup alertas en GitHub/Slack
- [ ] Revisar logs después de 1 semana

---

## 🚨 Patrones Comunes y Gotchas

### Gotcha 1: Permissions Denegados en Supabase
**Problema**: Hook intenta ejecutar comando supabase pero falla con "permission denied"

**Solución**:
```bash
# Verificar que service role key está en settings.local.json
# Verificar que key no está expirada
supabase projects list
```

### Gotcha 2: Hook Pre-commit Toma Mucho Tiempo
**Problema**: `npx eslint .` tarda 10+ segundos

**Solución**:
```bash
# Opción A: Solo lint archivos modificados
git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | xargs npx eslint

# Opción B: Usar pre-commit library (Python)
pip install pre-commit
```

### Gotcha 3: Scheduled Function No Se Ejecuta
**Problema**: Función configurada en supabase/config.toml pero no ejecuta

**Solución**:
```bash
# No existe "cron" nativo en Supabase v1
# Usar Schedule Skill de Claude en su lugar
# O crear edge function que se auto-schedule usando pg_cron (Supabase Pro)

# Verificar status:
npx supabase functions logs sync-shopify-daily
```

### Gotcha 4: Tipos de TypeScript Desincronizados
**Problema**: Cambiar schema pero tipos no se regeneran

**Solución**:
```bash
# Ejecutar manualmente
npx supabase gen types typescript --project-id ysdcsqsfnckeuafjyrbc > src/types/database.types.ts

# O esperar a que post-db-push hook se ejecute
supabase db push
```

### Gotcha 5: Service Key Expira
**Problema**: SERVICE_KEY en settings.local.json expira después de 1 año

**Solución**:
```bash
# Regenerar periodicamente
# O usar Supabase Admin API para generar tokens de corta duración

# Check expiración:
cat /Users/juliancastro/.claude/projects/-Users-juliancastro-Desktop-sewdle-co/memory/MEMORY.md | grep SERVICE_KEY
```

---

## 📈 Escalabilidad y Performance

### Load Testing de Sync Shopify
```bash
# Estimar tiempo de sincronización
time npx supabase functions logs sync-shopify-daily

# Verificar errores de timeout
# Si sincroniza > 300 órdenes: considerar pagination
```

### Optimización de Hooks
```bash
# Pre-commit checks tardando mucho?
# Solución: Solo lint archivos staged
git diff --cached --name-only --diff-filter=ACM | xargs npx eslint
```

### Limits de Supabase
- Max 60 requests/segundo por API
- Max 3MB por request body
- Max 1000 concurrent connections

**Implicación**: Sync de Shopify necesita pagination si > 1000 órdenes

---

## 🔄 Rollback Strategy

### Si Hook Causa Problemas
```bash
# Temporalmente desabilitar en settings.json
# Remover hook configuration
# Hacer commit con --no-verify si es necesario
git commit --no-verify -m "fix: disable hook while debugging"
```

### Si Scheduled Function Falla
```bash
# Desactivar función
npx supabase functions delete sync-shopify-daily

# O simplemente no deployarla hasta fix
```

### Si RLS Policy Falla
```bash
# Rollback migration
supabase db push --rollback-version <migration_id>
```

---

## 📚 Referencias Técnicas

- **Supabase Functions**: https://supabase.com/docs/guides/functions
- **Supabase RLS**: https://supabase.com/docs/guides/auth/row-level-security
- **Cron Syntax**: https://crontab.guru/
- **Deno Runtime**: https://deno.land/api
- **TypeScript Generator**: `npx supabase gen types typescript --help`

---

## 📞 Support y Debugging

### Debug Hooks
```bash
# En Claude Code: Abrir "Logs" panel
# Buscar líneas que comiencen con "Hook:"
# Copiar full error message
```

### Debug Scheduled Functions
```bash
npx supabase functions logs <function-name> --limit 100

# Buscar líneas con "error" o "Error" o "ERROR"
# Check timestamps para correlacionar con errores conocidos
```

### Debug RLS Policies
```bash
# En pgAdmin (Supabase dashboard)
# Navegar a: Database → Policies
# Verificar que policy está ENABLED
# Check que usuarios tienen correct roles
```

---

**Documento creado**: 2026-03-27
**Para**: Implementador (Task #3)
**Versión**: 1.0
