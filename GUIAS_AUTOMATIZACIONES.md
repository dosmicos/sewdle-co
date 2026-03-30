# Guías de Implementación - Automatizaciones Sewdle

Documento completo con guías paso a paso para implementar automatizaciones en el proyecto Sewdle (React + Supabase + Vercel).

---

## 1. Sincronización Automática de Órdenes Shopify (Diaria)

**Descripción**: Sincronizar automáticamente todas las órdenes nuevas y actualizadas de Shopify a la base de datos, ejecutándose una vez por día.

**Prerequisitos**:
- Supabase CLI instalado (`brew install supabase`)
- Acceso a Supabase Dashboard
- Función `sync-shopify-sales` ya existe en `/supabase/functions/sync-shopify-sales/`
- Anon key de Supabase (en `.env`)

**Pasos**:

### Paso 1: Crear migración con cron job
```bash
# Desde la raíz del proyecto
npx supabase migration create add_shopify_sync_cron
```

### Paso 2: Editar el archivo de migración generado
El archivo se crea en `supabase/migrations/` con un timestamp. Abre ese archivo y agrega:

```sql
-- Habilitar extensiones si no existen
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Sincronizar órdenes de Shopify cada día a las 2 AM UTC (9 PM CO)
SELECT cron.schedule(
  'sync-shopify-sales-daily',
  '0 2 * * *',  -- Cada día a las 2 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-shopify-sales',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
        body:='{"scheduled": true, "execution_time": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);
```

### Paso 3: Desplegar la migración
```bash
npx supabase db push
```

### Paso 4: Verificar que el cron se creó
En Supabase Dashboard → SQL Editor, ejecuta:
```sql
SELECT * FROM cron.job;
```

Deberías ver una entrada con `sync-shopify-sales-daily`.

**Verificación**:
1. Espera a las 2 AM UTC del día siguiente
2. Ve a Supabase Dashboard → Edge Functions → Logs
3. Busca llamadas a `sync-shopify-sales` con `scheduled: true`

**Mantenimiento**:
- **Revisar logs semanalmente**: Verifica Supabase Dashboard → Functions → Logs para ver si hay errores
- **Monitor de órdenes**: Comprueba `shopify_orders` tabla para confirmar nuevas órdenes
- **Si falla**: Revisa logs, verifica token en la función, confirma conectividad Shopify

---

## 2. Sincronización de Anuncios Meta (Cada 6 Horas)

**Descripción**: Sincronizar automáticamente datos de rendimiento de anuncios Meta (Facebook) a la dashboard financiera.

**Prerequisitos**:
- Función `sync-meta-ad-performance` existe en `/supabase/functions/`
- Meta Ads API configurada
- Acceso a Supabase con permisos de migración

**Pasos**:

### Paso 1: Crear migración
```bash
npx supabase migration create add_meta_ads_sync_cron
```

### Paso 2: Editar migración con configuración de cron
```sql
-- Sincronizar rendimiento de anuncios Meta cada 6 horas
SELECT cron.schedule(
  'sync-meta-ads-performance-6h',
  '0 */6 * * *',  -- Cada 6 horas (0, 6, 12, 18 UTC)
  $$
  SELECT
    net.http_post(
        url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-meta-ad-performance',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
        body:='{"scheduled": true, "sync_type": "performance", "execution_time": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);
```

### Paso 3: Desplegar
```bash
npx supabase db push
```

**Verificación**:
- Dashboard Financiero → Métricas Meta deberían actualizarse cada 6 horas
- Logs de función: busca timestamps de ejecución a 0, 6, 12, 18 horas

**Mantenimiento**:
- Si ves NaN en el dashboard: revisa que Meta Ads API esté activa
- Si no hay datos: verifica que ad accounts estén configurados en `ad_accounts` tabla
- Monitor de cuota: Meta API tiene límites, monitorea cantidad de llamadas diarias

---

## 3. Reposición Inteligente de Inventario (Semanal)

**Descripción**: Calcular automáticamente sugerencias de reposición cada miércoles (ya implementado, pero se documenta aquí).

**Estado**: ✅ Ya configurado en `20250715132607-80eafe16-44b5-48b8-92ce-a7924020b1ce.sql`

**Cómo funciona**:
- Se ejecuta cada miércoles a las 8 AM UTC (3 AM Colombia)
- Llama función `intelligent-replenishment`
- Genera sugerencias basadas en inventario actual vs demanda

**Si necesitas cambiar el horario**:

### Paso 1: Ver el job actual
```sql
SELECT * FROM cron.job WHERE jobname = 'intelligent-replenishment-weekly';
```

### Paso 2: Desagendar
```sql
SELECT cron.unschedule('intelligent-replenishment-weekly');
```

### Paso 3: Reagendar con nuevo horario
```sql
-- Ejemplo: cambiar a lunes a las 6 AM UTC
SELECT cron.schedule(
  'intelligent-replenishment-weekly',
  '0 6 * * 1',  -- Lunes a las 6 AM
  $$
  SELECT net.http_post(
      url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/intelligent-replenishment',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
      body:='{"scheduled": true, "execution_time": "' || now() || '"}'::jsonb
  );
  $$
);
```

**Mantenimiento**:
- **Revisar sugerencias**: Cada jueves, revisa módulo de Reposición
- **Ajustar umbrales**: Si las sugerencias no son útiles, edita la función `calculate_replenishment_suggestions()`
- **Monitor de productos**: Verifica que el catálogo de Shopify esté actualizado

---

## 4. Campañas WhatsApp en Lotes (Manual + Automatizable)

**Descripción**: Enviar mensajes WhatsApp a clientes en lotes. Actualmente se ejecuta manualmente, pero puede automatizarse.

**Archivos existentes**:
- Script lote: `/scripts/send-hotdays-batched.sh`
- Script rango: `/scripts/send-hotdays-range.sh`

### Opción A: Ejecutar Manualmente (Actual)

```bash
# Paso 1: Ejecutar script para obtener todos los destinatarios
bash /Users/juliancastro/Desktop/sewdle-co/scripts/send-hotdays-batched.sh

# Esto genera:
# - /tmp/hotdays_all_recipients.json (listado de clientes)
# - Envía mensajes en lotes de 20
# - Muestra reporte final
```

### Opción B: Automatizar Semanal (Recomendado)

**Prerequisitos**:
- Script `send-hotdays-batched.sh` debe ser ejecutable
- Token de Supabase válido en el script

**Paso 1**: Actualizar script para no requerir entrada interactiva
```bash
# Editar /scripts/send-hotdays-batched.sh
# Línea 7: cambiar token hardcodeado por variable de entorno
# De: AUTH_TOKEN="Bearer eyJ..."
# A: AUTH_TOKEN="Bearer ${WHATSAPP_TOKEN}"
```

**Paso 2**: Crear migración con cron
```bash
npx supabase migration create add_hotdays_campaign_weekly
```

**Paso 3**: Editar migración
```sql
-- Campaña HotDays cada jueves a las 6 AM UTC (1 AM Colombia)
SELECT cron.schedule(
  'hotdays-campaign-weekly',
  '0 6 * * 4',  -- Jueves a las 6 AM UTC
  $$
  SELECT net.http_post(
      url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/send-hotdays-campaign',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
      body:='{"scheduled": true, "action": "send_batched", "execution_time": "' || now() || '"}'::jsonb
  );
  $$
);
```

**Paso 4**: Desplegar
```bash
npx supabase db push
```

**Verificación**:
- Cada jueves a las 6 AM UTC, se inicia automáticamente
- Revisa logs: Supabase → Functions → `send-hotdays-campaign`

**Mantenimiento**:
- **Monitor de entregas**: Revisa tabla `hotdays_campaign_tracking` después de cada ejecución
- **Tasa de éxito**: Debería ser >95%. Si cae, revisa conectividad Meta/WhatsApp
- **Deduplicación**: Script automáticamente deduplica por teléfono

---

## 5. Sincronización de Cobertura Envía (Mensual)

**Descripción**: Actualizar automáticamente la cobertura de envía (zonas, ciudades, departamentos) desde la API de Envía.

**Función**: `populate-shipping-coverage`

**Paso 1**: Crear migración
```bash
npx supabase migration create add_envia_coverage_sync
```

**Paso 2**: Configurar cron mensual
```sql
-- Actualizar cobertura de Envía el 1º de cada mes a las 3 AM UTC
SELECT cron.schedule(
  'populate-envia-coverage-monthly',
  '0 3 1 * *',  -- Primer día de cada mes a las 3 AM UTC
  $$
  SELECT net.http_post(
      url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/populate-shipping-coverage',
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

**Verificación**:
- Primera del mes: revisa si se ejecutó en logs
- Tabla `shipping_coverage` debe tener datos actualizados

**Mantenimiento**:
- Si el costo de envío cambia: este cron lo actualiza automáticamente
- Si ves errores de conectividad: verifica API key de Envía en `.env`

---

## 6. Google Ads Sync (Cada 12 Horas)

**Descripción**: Sincronizar datos de Google Ads a dashboard financiero.

**Paso 1**: Crear migración
```bash
npx supabase migration create add_google_ads_sync
```

**Paso 2**: Configurar cron cada 12 horas
```sql
-- Sincronizar Google Ads cada 12 horas (mediodía y medianoche UTC)
SELECT cron.schedule(
  'sync-google-ads-12h',
  '0 */12 * * *',  -- Cada 12 horas
  $$
  SELECT net.http_post(
      url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-google-ads',
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

**Mantenimiento**:
- Verifica Google Ads API credentials si ves datos NULL
- Dashboard financiero debería mostrar datos cada 12 horas

---

## 7. Limpiar Órdenes Obsoletas (Trimestral)

**Descripción**: Archivar automáticamente órdenes completadas hace 90 días para mantener performance.

**Paso 1**: Crear migración
```bash
npx supabase migration create archive_old_orders
```

**Paso 2**: Crear función de archivo
```sql
-- Crear tabla de archivo
CREATE TABLE IF NOT EXISTS shopify_orders_archived AS
SELECT * FROM shopify_orders WHERE 1=0;  -- Estructura sin datos

-- Función para archivar
CREATE OR REPLACE FUNCTION archive_completed_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archived_count INT;
BEGIN
  -- Mover órdenes de 90+ días atrás a archivo
  INSERT INTO shopify_orders_archived
  SELECT * FROM shopify_orders
  WHERE status = 'completed'
    AND updated_at < NOW() - INTERVAL '90 days'
    ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  DELETE FROM shopify_orders
  WHERE status = 'completed'
    AND updated_at < NOW() - INTERVAL '90 days';

  RETURN jsonb_build_object(
    'success', true,
    'archived_count', archived_count,
    'timestamp', now()
  );
END;
$$;

-- Agendar para el 1º de cada trimestre a las 2 AM UTC
SELECT cron.schedule(
  'archive-old-orders-quarterly',
  '0 2 1 1,4,7,10 *',  -- 1º de ene, abr, jul, oct
  $$
  SELECT to_jsonb(archive_completed_orders());
  $$
);
```

**Paso 3**: Desplegar
```bash
npx supabase db push
```

---

## 8. Notificaciones de Stock Bajo (Diaria)

**Descripción**: Enviar notificación automática cuando el stock de un producto cae por debajo de umbral.

**Prerequisitos**:
- Función `send-hotdays-campaign` o similar para notificaciones
- Tabla `product_stock_alerts` con umbrales

**Paso 1**: Crear tabla de configuración
```sql
-- En una migración nueva
CREATE TABLE IF NOT EXISTS product_stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  alert_threshold INT NOT NULL,  -- Enviar alerta si stock < esto
  last_alert_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Paso 2**: Función para verificar y alertar
```sql
CREATE OR REPLACE FUNCTION check_stock_and_alert()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  low_stock_products RECORD;
  alert_count INT = 0;
BEGIN
  -- Buscar productos con stock bajo
  FOR low_stock_products IN
    SELECT pa.id, pa.product_id, pa.organization_id,
           COALESCE(SUM(iv.quantity), 0) as current_stock
    FROM product_stock_alerts pa
    LEFT JOIN inventory iv ON iv.product_id = pa.product_id
    WHERE COALESCE(SUM(iv.quantity), 0) < pa.alert_threshold
      AND (pa.last_alert_sent_at IS NULL
           OR pa.last_alert_sent_at < NOW() - INTERVAL '24 hours')
    GROUP BY pa.id, pa.product_id, pa.organization_id
  LOOP
    -- Aquí iría la lógica para enviar notificación
    -- Podría ser HTTP call a send-hotdays-campaign o email

    UPDATE product_stock_alerts
    SET last_alert_sent_at = NOW()
    WHERE id = low_stock_products.id;

    alert_count := alert_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'alerts_sent', alert_count,
    'timestamp', now()
  );
END;
$$;

-- Agendar diariamente a las 8 AM UTC
SELECT cron.schedule(
  'check-stock-alerts-daily',
  '0 8 * * *',
  $$SELECT to_jsonb(check_stock_and_alert());$$
);
```

---

## 9. Reporte Diario de Ventas (A Email)

**Descripción**: Enviar email automático cada mañana con resumen de ventas del día anterior.

**Prerequisitos**:
- Función edge que pueda enviar emails (o integración con SendGrid/Resend)
- Tabla `organization_settings` con emails configurados

**Paso 1**: Crear función de email
```sql
CREATE OR REPLACE FUNCTION send_daily_sales_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  yesterday_sales DECIMAL;
  yesterday_orders INT;
  result jsonb;
BEGIN
  -- Calcular vendas del día anterior
  SELECT
    SUM(current_total_price) as total,
    COUNT(*) as order_count
  INTO yesterday_sales, yesterday_orders
  FROM shopify_orders
  WHERE DATE(created_at) = CURRENT_DATE - 1;

  -- Aquí enviar por email usando pg_net
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/send-email',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'to', 'sales@sewdle.co',
      'subject', 'Reporte de Ventas - ' || CURRENT_DATE,
      'body', 'Ventas ayer: COP ' || COALESCE(yesterday_sales, 0) ||
              ' en ' || COALESCE(yesterday_orders, 0) || ' órdenes'
    )
  ) INTO result;

  RETURN jsonb_build_object(
    'success', true,
    'sales', yesterday_sales,
    'orders', yesterday_orders,
    'timestamp', now()
  );
END;
$$;

-- Agendar para todos los días a las 8 AM UTC (3 AM Colombia)
SELECT cron.schedule(
  'send-daily-sales-report',
  '0 8 * * *',
  $$SELECT to_jsonb(send_daily_sales_report());$$
);
```

---

## 10. Sincronización Inteligente de Etiquetas Shopify (Semanal)

**Descripción**: Sincronizar automáticamente etiquetas de órdenes desde Sewdle a Shopify.

**Status**: Ya existe función `sync-recent-shopify-tags` pero no está agendada.

**Paso 1**: Crear migración
```bash
npx supabase migration create schedule_shopify_tags_sync
```

**Paso 2**: Agendar semanal
```sql
-- Sincronizar etiquetas cada martes a las 7 AM UTC
SELECT cron.schedule(
  'sync-shopify-tags-weekly',
  '0 7 * * 2',  -- Martes a las 7 AM UTC
  $$
  SELECT net.http_post(
      url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-recent-shopify-tags',
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

---

## Tabla de Referencia Rápida

| Automatización | Frecuencia | Hora UTC | Timezone CO | Función |
|---|---|---|---|---|
| Órdenes Shopify | Diaria | 2:00 | 21:00 | `sync-shopify-sales` |
| Meta Ads | Cada 6h | 0,6,12,18 | 19,1,7,13 | `sync-meta-ad-performance` |
| Reposición | Semanal (Mié) | 8:00 | 3:00 | `intelligent-replenishment` |
| HotDays WhatsApp | Semanal (Jue) | 6:00 | 1:00 | `send-hotdays-campaign` |
| Cobertura Envía | Mensual (1º) | 3:00 | 22:00 | `populate-shipping-coverage` |
| Google Ads | Cada 12h | 0,12 | 19,7 | `sync-google-ads` |
| Stock Bajo | Diaria | 8:00 | 3:00 | `check-stock-and-alert()` |
| Reporte Ventas | Diaria | 8:00 | 3:00 | `send-daily-sales-report()` |
| Etiquetas Shopify | Semanal (Mar) | 7:00 | 2:00 | `sync-recent-shopify-tags` |

---

## Troubleshooting Común

### Problema: El cron no se ejecuta
**Solución**:
```sql
-- Verificar que existe
SELECT * FROM cron.job WHERE jobname = 'nombre-del-job';

-- Verificar logs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Problema: Token inválido en el cron
**Solución**:
```sql
-- Usar token de servicio, no anon
-- En migración, reemplazar con:
'Authorization': 'Bearer YOUR_SERVICE_ROLE_KEY'
```

### Problema: La función no existe
**Solución**:
```bash
# Verificar que la función esté deployada
npx supabase functions list

# Si no está, deployar manualmente
npx supabase functions deploy nombre-funcion
```

### Problema: La función se ejecuta pero no hace nada
**Solución**:
```bash
# Revisar logs
npx supabase functions logs nombre-funcion --limit 50

# Si ves errores, el cuerpo de la función necesita debug
```

---

## Mejores Prácticas

1. **Agrupar crons en horarios vacíos**: No ejecutes todos a las :00. Usa :15, :30, :45.
2. **Horarios UTC**: Siempre usa UTC en migraciones, convierte a Colombia según necesites.
3. **Idempotencia**: Asegúrate que ejecutar el cron 2 veces no causa duplicados.
4. **Reintentos**: Las funciones HTTP fallan a veces. Considera agregar reintentos en la función.
5. **Logs**: Siempre devuelve `{"success": true/false, "timestamp": ...}` de funciones.
6. **Testing**: Ejecuta la función manualmente primero antes de agendar.
7. **Monitoreo**: Revisa logs semanalmente, crea alerts si algún cron falla.

---

## Recursos

- **Supabase pg_cron docs**: https://supabase.com/docs/guides/database/functions#cron-jobs
- **Sintaxis cron**: `minute hour day month day_of_week` (0=domingo)
- **Cambiar zona horaria**: Todos los tiempos en Supabase son UTC. Convierte según tu zona.

---

**Última actualización**: 2026-03-27
**Proyecto**: Sewdle
**Responsable**: Equipo de Automatizaciones
