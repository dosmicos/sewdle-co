# Claude Automation Toolkit - Referencia Rápida

Herramientas y técnicas disponibles en Claude Desktop para automatizar tareas en sewdle-co.

## 1. Claude Code Hooks

**¿Qué son?** Comandos que se ejecutan automáticamente antes/después de eventos específicos.

**Dónde configurar**: `.claude/settings.json` o `.claude/settings.local.json`

**Eventos disponibles**:
- `pre-commit`: Antes de hacer git commit
- `post-commit`: Después de hacer git commit
- `pre-push`: Antes de hacer git push
- `post-push`: Después de hacer git push
- `pre-edit`: Antes de editar archivo
- `post-edit`: Después de editar archivo
- `pre-db-push`: Antes de `supabase db push`
- `post-db-push`: Después de `supabase db push`

**Ejemplo de configuración**:
```json
{
  "hooks": {
    "pre-commit": "npx tsc --noEmit && npx eslint .",
    "post-commit": "./scripts/deploy-functions.sh"
  }
}
```

**Casos de uso en sewdle**:
- ✅ Validación TS/Linting antes de commit
- ✅ Deploy automático de edge functions
- ✅ Regeneración de tipos de BD

---

## 2. Claude Schedule Skill

**¿Qué es?** Ejecuta prompts o comandos en un intervalo recurrente (cron).

**Sintaxis**: `/schedule <cron> <prompt>`

**Ejemplos de cron**:
```
0 2 * * *      → Diariamente a las 2 AM
0 */6 * * *    → Cada 6 horas
0 9 * * 1      → Lunes a las 9 AM (reportes semanales)
*/15 * * * *   → Cada 15 minutos
0 0 1 * *      → Primer día del mes a medianoche
```

**Ejemplo**:
```
/schedule "0 2 * * *" "Ejecuta edge function sync-shopify-daily"
```

**Casos de uso en sewdle**:
- ✅ Sync diario de Shopify (2 AM)
- ✅ Sync de métricas de Ads (8 AM)
- ✅ Monitoreo de logs (cada hora)
- ✅ Reporte semanal (lunes 9 AM)
- ✅ Limpieza mensual de datos

---

## 3. Supabase Scheduled Functions

**¿Qué son?** Edge functions con cron incorporado, ejecutadas por Supabase (no por Claude).

**Dónde configurar**: `supabase/config.toml`

**Configuración**:
```toml
[functions.sync-shopify-daily]
verify_jwt = false
# Agregar cron en supabase/functions/sync-shopify-daily/index.ts
```

**Diferencia con Schedule Skill**:
| Aspecto | Claude Schedule | Supabase Scheduled |
|---|---|---|
| Ejecutado por | Claude | Supabase (backend) |
| Requiere sesión Claude | ✅ Sí | ❌ No |
| Costo | Depende de uso | Incluido en Supabase |
| Confiabilidad | High (con retry) | Very High (SLA) |
| Mejor para | Experimentación | Producción |

**Casos de uso en sewdle**:
- ✅ Sync de Shopify (producción)
- ✅ Sync de Ads (producción)
- ✅ Poblado de cobertura de envío
- ✅ Limpieza automática de datos

---

## 4. Claude Loop Skill

**¿Qué es?** Ejecuta un prompt repetidamente en un intervalo.

**Sintaxis**: `/loop <intervalo> <comando>`

**Intervalos soportados**:
- `1m`, `5m`, `15m`, `30m`
- `1h`, `2h`, `6h`, `12h`, `24h`
- Defecto: 10 minutos

**Ejemplo**:
```
/loop 1h /check-supabase-logs
```

**Diferencia con Schedule**:
- Loop: Ejecuta mientras Claude está activo
- Schedule: Cron en background, no requiere Claude

**Casos de uso en sewdle**:
- ⚠️ Monitoreo durante sesión (ej: durante deployment)
- ⚠️ Debugging en tiempo real
- ❌ NO para producción (requiere sesión abierta)

---

## 5. Claude Desktop Project Configuration

**¿Qué es?** Instrucciones personalizadas para cada proyecto, cargadas automáticamente.

**Archivo**: `.claude/CLAUDE.md` (en raíz del proyecto)

**Contenido**:
```markdown
# Sewdle Project Guide

## Stack
- React 18 + TypeScript + Vite
- Supabase (auth, DB, edge functions)

## Conventions
- Use useHook pattern for business logic
- Create components in src/components/<feature>/
- Store queries in hooks (useQuery, useMutation)

## Key Paths
- Frontend: src/pages/, src/components/
- Backend: supabase/functions/
- Schema: supabase/migrations/

## Preferences
- Always read code before proposing changes
- Prefer editing over creating files
- Don't create abstractions prematurely
```

**Beneficio**: Claude carga estas instrucciones automáticamente en cada sesión.

---

## 6. MCP (Model Context Protocol) Servers

**¿Qué son?** Conexiones a servicios externos (GitHub, Slack, Supabase, etc.).

**Configuración**: `.claude/mcp.json`

**Disponibles en sewdle** (ya configurados):
- `github`: GitHub API (PRs, issues, gists)
- `slack`: Slack API (mensajes, canales)
- `supabase`: Supabase API (queries, functions)

**Ejemplo de uso**:
```
MCP llamará automáticamente a supabase para:
- Queryear datos
- Ejecutar edge functions
- Gestionar secrets
```

---

## Matriz de Herramientas por Caso de Uso

### Sync Automático (Datos Backend)
| Tarea | Herramienta | Por qué |
|---|---|---|
| Sync diario Shopify | Supabase Scheduled | Confiable, sin depender de Claude |
| Sync de Ads | Supabase Scheduled | Necesita ejecutarse siempre |
| Populate cobertura | Supabase Scheduled | Tarea crítica de negocio |
| Monitoreo logs | Claude Loop | Durante sesión de trabajo |

### Calidad de Código (Frontend/Git)
| Tarea | Herramienta | Por qué |
|---|---|---|
| Pre-commit checks | Claude Hook | Feedback inmediato antes de push |
| Deploy functions | Claude Hook | Automático post-commit |
| Format código | Claude Hook | Ejecutar al editar |
| Limpieza branches | Claude Hook + Skill | Periódico, no crítico |

### Inteligencia & Alertas
| Tarea | Herramienta | Por qué |
|---|---|---|
| Auto-tagging órdenes | Claude Hook + RLS | Trigger cuando hay cambios |
| Alertas de fallos | Claude Loop (dev) | Monitoreo activo durante sesión |
|  | Supabase Triggers (prod) | Alertas en producción confiables |
| Reportes semanales | Claude Schedule | Cron automático |

---

## Jerarquía de Confiabilidad

```
🟢 PRODUCCIÓN CRÍTICA
├── Supabase Scheduled Functions (SLA garantizado)
├── GitHub Actions (CI/CD pipeline)
└── Webhooks (Shopify, Meta, Stripe)

🟡 PRODUCCIÓN IMPORTANTE
├── Claude Schedule (con retry manual)
├── Supabase Triggers RLS
└── Custom scripts en edge functions

🔴 DESARROLLO / MONITOREO
├── Claude Loop (requiere sesión)
├── Claude Hooks (local, pre-push)
└── Manual scripts
```

---

## Pasos para Configurar Automatizaciones

### Paso 1: Crear Configuración Base
```bash
# Crear/editar settings.json
vim .claude/settings.json
```

### Paso 2: Agregar Hooks
```json
{
  "hooks": {
    "pre-commit": "npx tsc --noEmit",
    "post-commit": "npx supabase functions deploy sync-shopify-daily"
  }
}
```

### Paso 3: Crear CLAUDE.md
```bash
# Crear guía del proyecto
echo "# Sewdle Project Guide" > .claude/CLAUDE.md
```

### Paso 4: Para Scheduled Functions
```bash
# Editar supabase/functions/sync-shopify-daily/index.ts
# Agregar lógica de scheduling o usar Supabase Cron
```

### Paso 5: Usar Schedule Skill (Experimental)
```
/schedule "0 2 * * *" "Sincronizar shopify diariamente"
```

---

## Troubleshooting

### Hook no se ejecuta
- ✅ Verificar sintaxis en settings.json
- ✅ Verificar permisos del archivo
- ✅ Check `claude logs` para errores

### Schedule no ejecuta
- ✅ Verificar sintaxis de cron (`crontab.guru`)
- ✅ Si usa Claude Schedule, mantener sesión abierta
- ✅ Para Supabase, verificar `supabase functions logs`

### Tipos de TypeScript desincronizados
- ✅ Ejecutar: `npx supabase gen types typescript > src/types/database.types.ts`
- ✅ O configurar hook post-db-push

### Permissions denegados en Supabase
- ✅ Verificar SERVICE_KEY en `.claude/settings.local.json`
- ✅ Usar `supabase projects list` para verify auth

---

## Roadmap de Implementación para Sewdle

### Week 1: Fundamentos
- [ ] Crear `.claude/CLAUDE.md`
- [ ] Configurar hooks básicos (pre-commit, post-edit)
- [ ] Setup types auto-regeneration

### Week 2: Datos
- [ ] Crear edge function `sync-shopify-daily` con scheduling
- [ ] Setup `sync-google-ads` con cron
- [ ] Test en staging

### Week 3: Inteligencia
- [ ] Implementar auto-tagging de órdenes
- [ ] Setup monitoreo de logs
- [ ] Crear reporte semanal

### Week 4: Polish
- [ ] Documentación de configuración
- [ ] Training del equipo
- [ ] Runbooks para troubleshooting

---

## Referencias Externas

- **Claude Code Documentation**: https://claude.ai/code
- **Supabase Functions**: https://supabase.com/docs/guides/functions
- **Cron Reference**: https://crontab.guru/
- **GitHub Actions**: https://github.com/features/actions

---

**Última actualización**: 2026-03-27
**Mantenedor**: experto-claude
