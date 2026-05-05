# Plan: Clon de Triple Whale → finance.sewdle.co

## Resumen
Crear un dashboard de analytics e-commerce tipo Triple Whale integrado en la app existente de Sewdle, accesible desde `finance.sewdle.co`. Jala datos automáticamente de Shopify (ya integrado), Meta Ads API, Google Ads API y Google Analytics 4.

---

## Fase 1: UI Foundation + Datos de Shopify (Valor inmediato)

### 1.1 Configurar subdomain routing
- **Archivo**: `src/App.tsx` — Detectar hostname `finance.sewdle.co` y renderizar layout independiente (como WhatsApp AI)
- **Archivo**: `vercel.json` — Agregar dominio `finance.sewdle.co` (config manual en Vercel Dashboard)
- **Nuevo**: `src/components/finance-dashboard/FinanceDashboardLayout.tsx` — Layout propio con sidebar de navegación estilo Triple Whale

### 1.2 Crear componentes reutilizables del dashboard
- **Nuevo**: `src/components/finance-dashboard/MetricCard.tsx` — Card con: icono, nombre, valor COP, % cambio (verde/rojo), sparkline mini-chart (recharts)
- **Nuevo**: `src/components/finance-dashboard/MetricSection.tsx` — Sección con header, acciones (export, grid toggle), grid 3 columnas de MetricCards
- **Nuevo**: `src/components/finance-dashboard/SparklineChart.tsx` — Mini gráfico de línea usando Recharts (ya instalado)
- **Nuevo**: `src/components/finance-dashboard/FinanceDatePicker.tsx` — Selector de fecha con opciones: Hoy, Ayer, 7d, 30d, Custom + "Previous period"
- **Nuevo**: `src/components/finance-dashboard/AttributionTable.tsx` — Tabla de atribución (Meta vs Google Ads) con columnas: Source, Budget, Spend, CV, ROAS, Clicks, Impressions

### 1.3 Crear página principal del dashboard
- **Nuevo**: `src/pages/FinanceDashboardPage.tsx` — Página principal que orquesta todas las secciones:
  - **Pins** (métricas favoritas fijadas)
  - **Custom Metrics** (Net Profit, ROAS, MER, Net Margin, Ads, NCPA)
  - **Attribution** (tabla Meta vs Google)
  - **Web Analytics** (Conversion Rate, Users, Sessions, Add to Cart %, etc.)
  - **Store** (Order Revenue, Orders, Returns, Taxes, AOV, etc.)
  - **Meta Ads** (Facebook Ads, ROAS, CPC, CPM, Purchases, CPA, etc.)
  - **Google Ads** (Google Ads, Conv Value, ROAS, Conversions, CPA)
  - **Expenses** (Payment Gateways, COGS, Handling, Shipping, Custom)

### 1.4 Hook de datos de Store (Shopify)
- **Nuevo**: `src/hooks/useStoreMetrics.ts` — Query `shopify_orders` + `shopify_order_line_items` filtrado por fecha para calcular:
  - Total Sales, Orders, Returns, Taxes, AOV, Discounts
  - New vs Returning Customer Revenue (basado en si el email tiene órdenes previas)
  - Sale Taxes, Total Sales
  - Comparación con período anterior (% change)
  - Datos diarios para sparklines

### 1.5 Tabla de base de datos para métricas calculadas
- **Nuevo SQL Migration**: `supabase/migrations/XXXX_finance_dashboard_tables.sql`
  ```sql
  -- Credenciales de cuentas de ads
  CREATE TABLE ad_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    platform TEXT NOT NULL CHECK (platform IN ('meta', 'google_ads', 'google_analytics')),
    account_id TEXT,
    access_token TEXT, -- encrypted
    refresh_token TEXT, -- encrypted
    token_expires_at TIMESTAMPTZ,
    account_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Métricas diarias de ads (Meta + Google)
  CREATE TABLE ad_metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    platform TEXT NOT NULL,
    date DATE NOT NULL,
    spend DECIMAL(12,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    conversion_value DECIMAL(12,2) DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    cpc DECIMAL(8,2) DEFAULT 0,
    cpm DECIMAL(8,2) DEFAULT 0,
    ctr DECIMAL(6,4) DEFAULT 0,
    roas DECIMAL(8,2) DEFAULT 0,
    cpa DECIMAL(8,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, platform, date)
  );

  -- Métricas diarias de Google Analytics
  CREATE TABLE analytics_metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    date DATE NOT NULL,
    users INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    conversion_rate DECIMAL(6,4) DEFAULT 0,
    add_to_cart_rate DECIMAL(6,4) DEFAULT 0,
    bounce_rate DECIMAL(6,4) DEFAULT 0,
    avg_session_duration DECIMAL(8,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, date)
  );

  -- Gastos manuales
  CREATE TABLE finance_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    date DATE NOT NULL,
    category TEXT NOT NULL, -- 'cogs', 'shipping', 'handling_fees', 'payment_gateways', 'custom'
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

---

## Fase 2: Integración Meta Ads API

### 2.1 OAuth Flow para Meta
- **Nuevo**: `supabase/functions/meta-ads-auth/index.ts` — Edge function para OAuth2 flow con Meta Marketing API
- **Nuevo**: `src/components/finance-dashboard/settings/MetaAdsConnect.tsx` — UI para conectar cuenta de Meta Ads

### 2.2 Sync de datos de Meta Ads
- **Nuevo**: `supabase/functions/sync-meta-ads/index.ts` — Fetch daily metrics desde Meta Marketing API:
  - Endpoint: `/{ad-account-id}/insights`
  - Métricas: spend, impressions, clicks, actions (purchases), action_values, cpc, cpm, ctr
  - Guarda en `ad_metrics_daily` con platform='meta'

### 2.3 Hook de Meta Ads
- **Nuevo**: `src/hooks/useMetaAdsMetrics.ts` — Query `ad_metrics_daily WHERE platform='meta'` para:
  - Facebook Ads spend, ROAS, CPC, CPM, CTR, Purchases, CPA, CPOC, Revenue Per Link Click
  - Comparison con período anterior
  - Datos diarios para sparklines

---

## Fase 3: Integración Google Ads API

### 3.1 OAuth Flow para Google
- **Nuevo**: `supabase/functions/google-ads-auth/index.ts` — Edge function para OAuth2 flow con Google Ads API
- **Nuevo**: `src/components/finance-dashboard/settings/GoogleAdsConnect.tsx` — UI para conectar cuenta

### 3.2 Sync de datos de Google Ads
- **Nuevo**: `supabase/functions/sync-google-ads/index.ts` — Fetch daily metrics desde Google Ads API:
  - Métricas: cost, impressions, clicks, conversions, conversions_value, cpc, all_conversions
  - Guarda en `ad_metrics_daily` con platform='google_ads'

### 3.3 Hook de Google Ads
- **Nuevo**: `src/hooks/useGoogleAdsMetrics.ts` — Query `ad_metrics_daily WHERE platform='google_ads'`

---

## Fase 4: Integración Google Analytics 4

### 4.1 OAuth Flow para GA4
- Reutilizar el OAuth de Google (mismo token con scope adicional)
- **Nuevo**: `src/components/finance-dashboard/settings/GoogleAnalyticsConnect.tsx`

### 4.2 Sync de datos de GA4
- **Nuevo**: `supabase/functions/sync-google-analytics/index.ts` — Fetch desde GA4 Data API:
  - Métricas: activeUsers, sessions, screenPageViews, conversions, addToCarts, bounceRate
  - Guarda en `analytics_metrics_daily`

### 4.3 Hook de Analytics
- **Nuevo**: `src/hooks/useAnalyticsMetrics.ts` — Query `analytics_metrics_daily`

---

## Fase 5: Gastos y Métricas Calculadas

### 5.1 Gestión de gastos
- **Nuevo**: `src/components/finance-dashboard/ExpenseManager.tsx` — Modal para CRUD de gastos manuales
- **Nuevo**: `src/hooks/useFinanceExpenses.ts` — CRUD hook para `finance_expenses`
- Gastos de Shopify: COGS desde `shopify_order_line_items`, Shipping desde `shopify_orders`

### 5.2 Métricas calculadas
- **Nuevo**: `src/hooks/useCalculatedMetrics.ts` — Combina todos los hooks para calcular:
  - **Net Profit** = Total Sales - Total Ads Spend - COGS - Shipping - Handling - Custom Expenses
  - **ROAS** = Revenue / Total Ad Spend
  - **MER** = Total Ad Spend / Revenue × 100
  - **Net Margin** = Net Profit / Revenue × 100
  - **NCPA** = Total Ad Spend / New Customers
  - **Frequency** = Total Orders / Unique Customers

### 5.3 Settings page
- **Nuevo**: `src/components/finance-dashboard/settings/FinanceSettings.tsx` — Configuración:
  - Conectar/desconectar Meta Ads, Google Ads, GA4
  - Configurar categorías de gastos
  - Configurar COGS por producto
  - Configurar Payment Gateway fees (% por transacción)

---

## Archivos que se MODIFICAN (existentes):
1. `src/App.tsx` — Agregar ruta `/finance-dashboard/*` y detección de subdomain
2. `src/components/AppSidebar.tsx` — Agregar link "Finance Dashboard" en el menú
3. `vercel.json` — Puede necesitar rewrites para el subdomain (config principal en Vercel Dashboard)

## Archivos NUEVOS (resumen):
- ~8 componentes en `src/components/finance-dashboard/`
- ~6 hooks en `src/hooks/`
- ~5 edge functions en `supabase/functions/`
- 1 migration SQL
- 1 página principal

## Stack técnico:
- **Charts**: Recharts (ya instalado)
- **UI**: shadcn/ui + Tailwind (ya instalado)
- **Fechas**: date-fns (ya instalado)
- **Data**: Supabase + React Query (ya instalado)
- **APIs**: Meta Marketing API, Google Ads API, GA4 Data API

---

## Orden de implementación sugerido:
1. ✅ Fase 1 completa (UI + Shopify) — Dashboard funcional con datos reales de tienda
2. ✅ Fase 2 (Meta Ads) — Datos de Facebook/Instagram Ads
3. ✅ Fase 3 (Google Ads) — Datos de Google Ads
4. ✅ Fase 4 (Google Analytics) — Web analytics
5. ✅ Fase 5 (Expenses) — P&L completo
