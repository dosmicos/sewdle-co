# Quick Start: Automatizaciones Sewdle - 15 Minutos

Guía express para implementar automatizaciones sin necesidad de entender toda la arquitectura.

---

## TL;DR - Lo más importante

Existen 3 formas de automatizar en Sewdle:

1. **Supabase Cron Jobs** (preferido): Se ejecutan automáticamente en horarios fijos
2. **Claude Code Hooks**: Se ejecutan durante desarrollo local (validaciones, deploys)
3. **Scripts Bash**: Se ejecutan manualmente

**Para la mayoría de casos, usa Cron Jobs.**

---

## Secuencia de 5 Minutos

### ¿Necesitas una tarea que se ejecute automáticamente cada día/semana/mes?

**Responde estas preguntas**:

1. ¿A qué hora debe ejecutarse?
   - Ejemplo: "Cada día a las 2 AM UTC (21:00 Colombia)"

2. ¿Qué debe hacer?
   - Ejemplo: "Sincronizar órdenes de Shopify"

3. ¿Existe ya una función/script que lo haga?
   - Mira en `/supabase/functions/` o `/scripts/`
   - Busca el nombre de lo que quieres hacer

4. ¿La función/script funciona manualmente?
   - Pruébalo una vez: `npx supabase functions invoke nombre-funcion`
   - Si funciona, procede. Si no, arréglalo primero.

**Si respondiste todo**: continúa con la **Sección "Tu Automatización en 3 Pasos"**

---

## Tu Automatización en 3 Pasos

### PASO 1: Crea el archivo de migración

```bash
cd /Users/juliancastro/Desktop/sewdle-co

npx supabase migration create nombre_descriptivo_de_mi_automatizacion
```

Esto crea un archivo como:
```
supabase/migrations/20260327123456_nombre_descriptivo.sql
```

### PASO 2: Edita el archivo con la configuración

Abre el archivo creado y reemplaza TODO con:

```sql
-- ===== TU AUTOMATIZACIÓN AQUÍ =====
-- Reemplaza "MI_TAREA" con nombre descriptivo
-- Reemplaza "0 8 * * *" con tu horario (ver tabla más abajo)
-- Reemplaza "URL_DE_LA_FUNCION" con la URL real

SELECT cron.schedule(
  'MI_TAREA',
  '0 8 * * *',  -- Tu horario aquí
  $$
  SELECT net.http_post(
      url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/URL_DE_LA_FUNCION',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
      body:='{"scheduled": true, "execution_time": "' || now() || '"}'::jsonb
  );
  $$
);
```

**Ejemplos listos para copiar**:

#### Ejemplo 1: Sincronizar órdenes Shopify cada día a las 2 AM UTC
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

#### Ejemplo 2: Sincronizar Meta Ads cada 6 horas
```sql
SELECT cron.schedule(
  'sync-meta-ads-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
      url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-meta-ad-performance',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
      body:='{"scheduled": true, "execution_time": "' || now() || '"}'::jsonb
  );
  $$
);
```

#### Ejemplo 3: Enviar campaña WhatsApp cada jueves a las 6 AM UTC
```sql
SELECT cron.schedule(
  'hotdays-campaign-weekly',
  '0 6 * * 4',
  $$
  SELECT net.http_post(
      url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/send-hotdays-campaign',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
      body:='{"scheduled": true, "execution_time": "' || now() || '"}'::jsonb
  );
  $$
);
```

#### Ejemplo 4: Reposición inteligente cada lunes a las 6 AM UTC
```sql
SELECT cron.schedule(
  'intelligent-replenishment-weekly',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
      url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/intelligent-replenishment',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
      body:='{"scheduled": true, "execution_time": "' || now() || '"}'::jsonb
  );
  $$
);
```

### PASO 3: Deploya y verifica

```bash
# Desde la raíz del proyecto
npx supabase db push

# Espera a que confirme. Si todo OK:
# "✅ Database push successful"
```

**Verifica que funciona**:
```bash
# En Supabase Dashboard (web) → SQL Editor
# Ejecuta:
SELECT * FROM cron.job WHERE jobname = 'TU_NOMBRE_AQUI';

# Deberías ver una fila con tu tarea agendada
```

---

## Tabla de Horarios Rápida

Usa esta tabla para reemplazar `'0 8 * * *'` en tus ejemplos:

### Horarios Comunes

| Descripción | Expresión Cron | Ejemplo |
|---|---|---|
| **Cada día a las 2 AM UTC** | `0 2 * * *` | Sync Shopify |
| **Cada día a las 8 AM UTC** | `0 8 * * *` | Reporte, Stock |
| **Cada 6 horas** | `0 */6 * * *` | Meta Ads (0,6,12,18) |
| **Cada 12 horas** | `0 */12 * * *` | Google Ads |
| **Lunes a las 6 AM UTC** | `0 6 * * 1` | Reposición |
| **Martes a las 7 AM UTC** | `0 7 * * 2` | Sync Tags |
| **Miércoles a las 8 AM UTC** | `0 8 * * 3` | Replenishment |
| **Jueves a las 6 AM UTC** | `0 6 * * 4` | WhatsApp Campaign |
| **Viernes a las 5 AM UTC** | `0 5 * * 5` | - |
| **Primer día del mes a las 3 AM UTC** | `0 3 1 * *` | Envía Coverage |
| **Trimestral (1º de ene,abr,jul,oct)** | `0 2 1 1,4,7,10 *` | Archive Orders |

### Convertir a tu Zona Horaria

Colombia está en UTC-5 (o UTC-4 si hay horario de verano).

**Para convertir UTC a Colombia**: resta 5 horas

| UTC | Colombia | Ejemplo |
|---|---|---|
| 00:00 (medianoche) | 19:00 (7 PM) | - |
| 02:00 | 21:00 (9 PM) | ← Mejor para sync |
| 06:00 | 01:00 (1 AM) | ← Mejor para campañas |
| 08:00 | 03:00 (3 AM) | ← Mejor para cálculos |
| 12:00 (mediodía) | 07:00 (7 AM) | ← Mejor para reportes |

### Crear tu propia expresión Cron

Formato: `minute hour day month day_of_week`

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (0 = domingo)
│ │ │ │ │
│ │ │ │ │
0 8 * * 3  ← Miércoles a las 8 AM UTC
```

**Especiales**:
- `*/6` = cada 6 unidades (0, 6, 12, 18...)
- `1-5` = rango de 1 a 5
- `1,3,5` = días específicos (1, 3, 5)

---

## Verificación Post-Deploy

### Paso 1: Confirma que el job existe
```bash
# En Supabase → SQL Editor, ejecuta:
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;

# Verifica que tu tarea aparece en la lista
```

### Paso 2: Ver logs de ejecución
```bash
# En terminal:
npx supabase functions logs nombre-funcion --limit 10

# O en dashboard: Supabase → Functions → Logs
# Busca tu función por nombre
```

### Paso 3: Esperar la siguiente ejecución
- El cron se ejecutará en la próxima ventana de tiempo
- Revisa logs 2-3 minutos después de la hora programada

---

## Troubleshooting Rápido

| Problema | Causa | Solución |
|---|---|---|
| Job no aparece en `cron.job` | Migración no se ejecutó | Ejecuta `npx supabase db push` nuevamente |
| Job aparece pero no se ejecuta | URL o token inválidos | Verifica URL existe en `npx supabase functions list` |
| Función devuelve error | Función tiene bugs | Ejecuta manualmente: `npx supabase functions invoke nombre-funcion` |
| "Bearer token invalid" | Token expirado/incorrecto | No usar token hardcodeado, usar `current_setting('app.settings.anon_key')` |
| Cron se ejecuta pero no sincroniza | Función no hace nada con `scheduled: true` | Revisa la lógica de la función, agregar validaciones |

---

## Funciones Disponibles Listas para Usar

```
✅ sync-shopify-sales          → Órdenes Shopify
✅ sync-meta-ad-performance    → Meta Ads
✅ sync-google-ads             → Google Ads
✅ intelligent-replenishment   → Reposición inteligente
✅ send-hotdays-campaign       → WhatsApp campaigns
✅ populate-shipping-coverage  → Cobertura Envía
✅ sync-recent-shopify-tags    → Etiquetas Shopify
✅ sync-inventory-shopify      → Inventario Shopify
```

Todas están en `/supabase/functions/` y listas para agendar.

---

## Ejemplo Completo: De Cero a Automatización

### Quiero: Sincronizar órdenes Shopify cada día a las 21:00 Colombia (2 AM UTC)

**Paso 1**: Crear migración
```bash
npx supabase migration create sync_shopify_sales_daily
```

**Paso 2**: Editar archivo (reemplaza TODO)
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

**Paso 3**: Desplegar
```bash
npx supabase db push
```

**Paso 4**: Verificar
```bash
# En SQL Editor de Supabase, ejecutar:
SELECT * FROM cron.job WHERE jobname = 'sync-shopify-sales-daily';

# Deberías ver: jobname, schedule '0 2 * * *', enabled
```

**Paso 5**: Esperar
- Mañana a las 2 AM UTC, la función se ejecutará automáticamente
- Puedes revisar logs para confirmar

**✅ LISTO**. Ahora cada día a las 21:00 Colombia, Shopify se sincroniza automáticamente.

---

## El Siguiente Paso

Una vez domines esto, lee:
- **`GUIAS_AUTOMATIZACIONES.md`** para casos más complejos
- **`CLAUDE_CODE_HOOKS.md`** para automatizar durante desarrollo

---

**Recuerda**:
- Todos los horarios en Supabase son **UTC**
- Colombia está **UTC-5**
- Cron se ejecuta automáticamente, sin intervención manual
- Los logs están en Supabase Dashboard → Functions → Logs

**¿Necesitas ayuda?** Revisa la sección "Troubleshooting Rápido" arriba o abre un issue en el repo.

---

**Última actualización**: 2026-03-27
**Proyecto**: Sewdle
**Objetivo**: Que cualquiera pueda crear una automatización en 15 minutos
