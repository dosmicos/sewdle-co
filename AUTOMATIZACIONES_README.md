# 🤖 Automatizaciones Sewdle - Centro de Control

Bienvenido al hub central de automatizaciones del proyecto Sewdle. Aquí encontrarás todo lo que necesitas para automatizar tareas repetitivas.

---

## 📚 Documentación Disponible

### 1. **Quick Start** (5-15 minutos) 🚀
**`AUTOMATIZACIONES_QUICK_START.md`**

👉 **Empieza aquí si**:
- Es tu primera vez automatizando
- Necesitas implementar algo rápido
- Quieres entender cómo funcionan los horarios Cron

**Contenido**:
- TL;DR: qué es automatización en Sewdle
- 3 pasos para crear tu primer cron job
- Tabla de horarios listos para copiar
- 4 ejemplos completos (Shopify, Meta, WhatsApp, Reposición)

**Tiempo**: 15 minutos ⏱️

---

### 2. **Guías Completas** (Referencia exhaustiva) 📖
**`GUIAS_AUTOMATIZACIONES.md`**

👉 **Usa esto para**:
- Implementar cualquier automatización importante
- Entender todos los detalles (prerequisitos, verificación, mantenimiento)
- Encontrar soluciones a problemas específicos
- Consultar tabla de referencia de todas las automatizaciones

**Contenido**:
- 10 automatizaciones paso a paso
- Para cada una: prerequisitos, pasos, archivos, verificación, mantenimiento
- Tabla de referencia con horarios y funciones
- Troubleshooting y mejores prácticas

**Tiempo**: 30-45 minutos (depende de qué implementes) ⏱️

---

### 3. **Claude Code Hooks** (Desarrollo local) 💻
**`CLAUDE_CODE_HOOKS.md`**

👉 **Lee esto para**:
- Automatizar durante desarrollo local (validaciones, deploys)
- Configurar hooks que se ejecutan en eventos de Git
- Syncronizar funciones edge automáticamente cuando editas
- Prevenir que commits errores TypeScript

**Contenido**:
- 10 hooks automáticos configurables
- Cómo instalar y usar
- Plantilla lista para copiar-pegar
- Comparación con otras opciones

**Tiempo**: 20 minutos ⏱️

---

## 🎯 Flujo de Decisión: ¿Cuál Documento Necesito?

```
┌─────────────────────────────────┐
│ ¿Necesito automatizar algo?     │
└─────────────────────────────────┘
              │
              ↓
    ┌─────────────────────────┐
    │ ¿Es mi primera vez?     │
    │ ¿Necesito hacer rápido? │
    └─────────────────────────┘
       SÍ ↓              ↓ NO
         │               │
    ┌────────────────┐  ┌─────────────────────┐
    │ QUICK START    │  │ ¿Es durante dev o   │
    │ (5 min)        │  │ cuando uso la app?  │
    └────────────────┘  └─────────────────────┘
                           DEV ↓  ↓ CUANDO CORRO APP
                             │    │
                        ┌─────────────────────┐
                        │ CLAUDE CODE HOOKS   │ GUÍAS COMPLETAS
                        │ (20 min)            │ (30-45 min)
                        └─────────────────────┘ │
                                                ↓
                                        (Con todos los detalles)
```

**Resumen rápido**:
- 🚀 **Quiero hacerlo YA**: QUICK START
- 🔨 **Quiero todos los detalles**: GUÍAS COMPLETAS
- 💻 **Quiero validaciones/hooks locales**: CLAUDE CODE HOOKS

---

## 🗺️ Mapa de Automatizaciones Disponibles

### Nivel: Básico (Ya implementadas)
✅ **Reposición Inteligente** - Semanal (miércoles 8 AM UTC)
   - Ubicación: `supabase/migrations/20250715132607-*.sql`
   - Función: `intelligent-replenishment`

### Nivel: Intermedio (Listos para usar)
📝 **Sincronización Shopify** - Diaria (2 AM UTC)
📝 **Meta Ads Sync** - Cada 6 horas
📝 **WhatsApp Campaigns** - Semanal (configurable)
📝 **Google Ads Sync** - Cada 12 horas

### Nivel: Avanzado (Requieren setup)
🔧 **Notificaciones Stock Bajo** - Diaria
🔧 **Reporte de Ventas** - Diaria por email
🔧 **Limpiar Órdenes Obsoletas** - Trimestral

---

## 📊 Capacidades de Automatización en Sewdle

### 1. Supabase Cron Jobs (pg_cron) ⭐ Recomendado
**Cuándo usar**: Tareas automáticas 24/7 en horarios fijos

| Aspecto | Detalles |
|---|---|
| **Frecuencia** | Diaria, horaria, semanal, mensual, custom |
| **Ejecución** | Automática en Supabase (no tu máquina) |
| **Latencia** | 1-2 minutos desde el horario |
| **Costo** | Incluido en Supabase, gratuito |
| **Documentación** | GUIAS_AUTOMATIZACIONES.md |

**Ejemplo**:
```sql
SELECT cron.schedule('mi-tarea', '0 8 * * *', $$ ... $$);
```

---

### 2. Claude Code Hooks (Desarrollo local)
**Cuándo usar**: Automatizar durante desarrollo (validaciones, deploys)

| Aspecto | Detalles |
|---|---|
| **Frecuencia** | En eventos (commit, deploy, save) |
| **Ejecución** | En tu máquina de desarrollo |
| **Latencia** | Inmediato (<1 segundo) |
| **Costo** | Gratuito |
| **Documentación** | CLAUDE_CODE_HOOKS.md |

**Ejemplo**:
```json
{
  "hooks": {
    "before-commit": {
      "run": "npx tsc --noEmit"
    }
  }
}
```

---

### 3. Scripts Bash (Manual)
**Cuándo usar**: Tareas de una vez, debugging, testing

| Aspecto | Detalles |
|---|---|
| **Frecuencia** | Manual, a demanda |
| **Ejecución** | Terminal de tu máquina |
| **Latencia** | Inmediato |
| **Costo** | Gratuito |
| **Ejemplo** | `/scripts/send-hotdays-batched.sh` |

---

## 🚀 Inicio Rápido (Copiar-Pegar)

### Quiero: Sincronizar Shopify cada día a las 21:00 Colombia

1. Crear migración:
```bash
npx supabase migration create sync_shopify_daily
```

2. Editar archivo creado con:
```sql
SELECT cron.schedule(
  'sync-shopify-sales-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
      url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-shopify-sales',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
      body:='{"scheduled": true, "execution_time": "' || now() || '"}'::jsonb
  );
  $$
);
```

3. Desplegar:
```bash
npx supabase db push
```

4. Verificar:
```bash
# En Supabase SQL Editor:
SELECT * FROM cron.job WHERE jobname = 'sync-shopify-sales-daily';
```

✅ Listo. Mañana a las 21:00 Colombia, Shopify se sincroniza automáticamente.

---

## 📋 Automatizaciones por Área de Negocio

### E-Commerce (Shopify)
- **Sincronizar órdenes** → GUIAS #1
- **Sincronizar etiquetas** → GUIAS #10
- **Sincronizar inventario** → GUIAS (referencia)
- **Limpiar órdenes viejas** → GUIAS #7

### Marketing (Ads & WhatsApp)
- **Meta Ads analytics** → GUIAS #2
- **Google Ads analytics** → GUIAS #6
- **WhatsApp campaigns** → GUIAS #4
- **Stock bajo alerts** → GUIAS #8

### Operaciones
- **Reposición inteligente** → GUIAS #3
- **Cobertura envía** → GUIAS #5
- **Reporte diario ventas** → GUIAS #9

### Desarrollo
- **Validación TypeScript** → HOOKS #1
- **Lint pre-deploy** → HOOKS #2
- **Sync migrations** → HOOKS #3
- **Deploy funciones edge** → HOOKS #4

---

## ❓ FAQ

### ¿Cómo cambio la hora de una automatización?
Ver GUIAS #1 "Cambiar horario de replenishment" o QUICK START "Tu propia expresión Cron".

### ¿Dónde veo si una automatización se ejecutó?
Supabase Dashboard → Functions → Logs, o terminal: `npx supabase functions logs nombre`

### ¿Qué pasa si la función falla?
El cron lo reintenta automáticamente. Revisa logs para ver el error.

### ¿Puedo automatizar sin Cron?
Sí, usa GitHub Actions o un servicio externo como Zapier (costo extra).

### ¿Cuál es el mínimo intervalo?
1 minuto (pg_cron). Para menos, usa Cloud Functions en tiempo real.

---

## 🛠️ Setup Inicial (Onboarding)

Si es la primera vez:

1. ✅ Lee **QUICK START** (15 min)
2. ✅ Elige 1 automatización de GUIAS
3. ✅ Sigue los 3 pasos para crearla
4. ✅ Verifica que se ejecutó (revisa logs)
5. ✅ Ahora dominas el proceso para el resto

---

## 📞 Support & Resources

**Problema frecuente?** → Ver Troubleshooting en GUIAS o QUICK START

**Necesitas detalles?** → Lee GUIAS_AUTOMATIZACIONES.md

**¿Desarrollo local?** → Usa CLAUDE_CODE_HOOKS.md

**Sintaxis Cron?** → Ver tabla en QUICK START

**API Reference?** → https://supabase.com/docs/guides/database/functions#cron-jobs

---

## 📈 Evolución: De Manual a Completamente Automatizado

### Semana 1
- [ ] Crear automatización 1: Shopify sync
- [ ] Entender horarios Cron
- [ ] Revisar logs diarios

### Semana 2
- [ ] Crear automatización 2: Meta Ads sync
- [ ] Setup Claude Code hooks para dev
- [ ] Leer mejores prácticas

### Semana 3+
- [ ] Crear automatizaciones 3-5 según necesidad
- [ ] Monitorear y optimizar
- [ ] Agregar nuevas según surgimiento

---

## 🎓 Conceptos Clave

**Cron Job**: Tarea que se ejecuta automáticamente en horarios específicos
**Hook**: Comando que se ejecuta automáticamente en respuesta a eventos
**pg_cron**: Extensión Postgres que permite agendar trabajos en Supabase
**UTC**: Zona horaria Supabase (Colombia es UTC-5)
**Idempotencia**: Ejecutar dos veces da el mismo resultado que una

---

## 📝 Últimas Actualizaciones

| Documento | Última Update | Cambios |
|---|---|---|
| QUICK START | 2026-03-27 | Inicial |
| GUIAS COMPLETAS | 2026-03-27 | 10 automatizaciones |
| CLAUDE HOOKS | 2026-03-27 | 10 hooks + plantilla |
| README (este) | 2026-03-27 | Índice y navegación |

---

## 🚀 Próximos Pasos

**Hoy**:
- [ ] Lee QUICK START
- [ ] Implementa 1 automatización

**Esta semana**:
- [ ] Implementa 2-3 más
- [ ] Revisa logs para confirmar ejecución

**Este mes**:
- [ ] Automatiza 50% de las tareas repetitivas
- [ ] Setup alerts si algo falla

---

## 📞 ¿Necesitas Ayuda?

1. **Primer cron job?** → QUICK START
2. **Automatización específica?** → GUIAS (índice de contenidos)
3. **Setup de hooks?** → CLAUDE CODE HOOKS
4. **Troubleshooting?** → Sección correspondiente en cada doc

---

**Proyecto**: Sewdle
**Objetivo**: Reducir tareas manuales repetitivas
**Última actualización**: 2026-03-27
**Mantenedor**: Equipo de Automatizaciones

---

## 📚 Índice de Documentos

```
sewdle-co/
├── AUTOMATIZACIONES_README.md (este archivo - índice y navegación)
├── AUTOMATIZACIONES_QUICK_START.md (5-15 min, copiar-pegar)
├── GUIAS_AUTOMATIZACIONES.md (30-45 min, exhaustivo)
└── CLAUDE_CODE_HOOKS.md (20 min, desarrollo local)
```

**Comienza por**: AUTOMATIZACIONES_QUICK_START.md

---

**¡Listo para automatizar? ¡Adelante! 🚀**
