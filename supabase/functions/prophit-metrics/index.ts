// ─── Prophit Metrics Endpoint ───────────────────────────────────────
// Single source of truth for Net Sales, Ad Spend, Contribution Margin,
// MER, AMER, Pacing and all derived financial metrics.
//
// Consumed by:
//   - The Prophit Dashboard UI (via useProphitMetrics hook)
//   - The Growth Manager agent in Paperclip (via REST POST)
//   - Future consumers (Librarian, mobile, email reports, Telegram bot)
//
// This function ports the logic of the following React hooks:
//   - useStoreMetrics        → shopify_orders + shopify_order_line_items
//   - useAdMetrics           → ad_metrics_daily (Meta + Google)
//   - useFinanceSettings     → finance_settings
//   - useMonthlyTargets      → monthly_targets
//   - useProductCosts        → product_costs  (for per-product COGS override)
//   - useGatewayCosts        → gateway_cost_settings  (for per-gateway fees)
//   - useFinanceExpenses     → finance_expenses  (for OpEx override)
//   - useContributionMargin  → pure calculation
//
// Request:
//   POST /functions/v1/prophit-metrics
//   Authorization: Bearer <service_role_key>  OR  Bearer <anon_key> (dashboard)
//   Body: {
//     organizationId: string,
//     currentRange:  { start: ISO8601, end: ISO8601 },
//     previousRange?: { start: ISO8601, end: ISO8601 }
//   }
//
// Response: { current: ProphitMetrics, previous: ProphitMetrics | null,
//             changes: Record<string, number>, metadata: {...} }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ═══════════════════════════════════════════════════════════════════
// TYPES — mirror src/hooks/useContributionMargin.ts
// ═══════════════════════════════════════════════════════════════════

type CostMode = "percent" | "per_product";
type ShippingMode = "percent" | "shopify_charges" | "per_order_cost";
type GatewayMode = "percent" | "per_gateway";
type HandlingMode = "percent" | "per_order" | "per_item";
type Semaphore = "green" | "yellow" | "red";

interface FinanceSettings {
  cogs_percent: number;
  shipping_cost_percent: number;
  payment_gateway_percent: number;
  handling_cost_percent: number;
  monthly_opex: number;
  return_rate_percent: number;
  cm_target_percent: number;
  cogs_mode: CostMode;
  shipping_mode: ShippingMode;
  gateway_mode: GatewayMode;
  handling_mode: HandlingMode;
  shipping_cost_per_order: number;
  handling_fee_per_order: number;
  handling_fee_per_item: number;
}

interface MonthlyTarget {
  revenue_target: number;
  cm_target: number;
  ad_spend_budget: number;
  new_customers_target: number;
}

interface ProductCost {
  product_id: number;
  variant_id: number | null;
  product_cost: number;
  handling_fee: number;
}

interface GatewayCostSetting {
  gateway_name: string;
  percent_fee: number;
  flat_fee: number;
  is_active: boolean;
}

interface FinanceExpense {
  date: string;
  amount: number;
  recurrence: "monthly" | "weekly" | "daily" | "one_time";
  start_date: string | null;
  end_date: string | null;
  is_ad_spend: boolean;
}

interface StoreMetricsInternal {
  totalSales: number;
  grossRevenueBeforeRefunds: number;
  orders: number;
  returns: number;
  taxes: number;
  aov: number;
  discounts: number;
  newCustomerRevenue: number;
  returningCustomerRevenue: number;
  newCustomerOrders: number;
  unitsSold: number;
  totalShipping: number;
  lineItemCogs: number; // Computed from product_costs (per_product mode)
  gatewayFees: number;  // Computed from gateway_cost_settings
  dailyData: Array<{ date: string; totalSales: number; orders: number }>;
}

interface AdMetricsInternal {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  purchases: number;
  metaSpend: number;
  googleSpend: number;
  dailyData: Array<{ date: string; spend: number; purchases: number }>;
}

interface ProphitMetrics {
  // Revenue
  grossRevenue: number;
  returnsAccrual: number;
  netSales: number;

  // Costs
  productCost: number;
  shippingCost: number;
  paymentGatewayFees: number;
  handlingCost: number;
  variableExpenses: number;
  adSpend: number;
  metaSpend: number;
  googleSpend: number;

  // Results
  contributionMargin: number;
  cmPercent: number;

  // Four Quarters
  costOfDelivery: number;
  costOfDeliveryPct: number;
  cacCost: number;
  cacPct: number;
  opexCost: number;
  opexPct: number;
  profit: number;
  profitPct: number;

  // Comparison
  cmVsTarget: number;
  cmVsDailyPace: number;
  semaphore: Semaphore;

  // Pace / Forecast
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyPaceTarget: number;
  projectedMonthEnd: number;
  gapPerDay: number;

  // MER / AMER
  mer: number;
  amer: number;
  newCustomerRevenuePct: number;

  // Margins & burn
  grossMargin: number;
  grossMarginPct: number;
  shippingCostPct: number;
  dailyBurn: number;
  projectedMonthlyProfit: number;

  // Order-level
  orders: number;
  unitsSold: number;
  aov: number;
  purchases: number;

  // Daily breakdown
  dailyData: Array<{
    date: string;
    netSales: number;
    adSpend: number;
    cm: number;
    cumulativeCm: number;
    cumulativeNetSales: number;
  }>;

  // Period
  periodStart: string;
  periodEnd: string;
  periodDays: number;
}

// ═══════════════════════════════════════════════════════════════════
// DATE HELPERS — minimal, no date-fns to keep bundle small
// ═══════════════════════════════════════════════════════════════════

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}
function parseDate(s: string): Date {
  return new Date(s);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function diffCalendarDays(later: Date, earlier: Date): number {
  const a = new Date(Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate()));
  const b = new Date(Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate()));
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function getDaysInMonth(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}
function diffCalendarMonths(later: Date, earlier: Date): number {
  return (later.getUTCFullYear() - earlier.getUTCFullYear()) * 12 +
         (later.getUTCMonth() - earlier.getUTCMonth());
}
function diffCalendarWeeks(later: Date, earlier: Date): number {
  return Math.floor(diffCalendarDays(later, earlier) / 7);
}
function isWithinInterval(d: Date, { start, end }: { start: Date; end: Date }): boolean {
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}
function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ═══════════════════════════════════════════════════════════════════
// QUERIES — Supabase
// ═══════════════════════════════════════════════════════════════════

async function fetchAllOrders(
  sb: SupabaseClient,
  orgId: string,
  startISO: string,
  endISO: string
): Promise<Array<any>> {
  const pageSize = 1000;
  let all: any[] = [];
  let from = 0;
  // Loop until page returns fewer than pageSize rows
  while (true) {
    const { data, error } = await sb
      .from("shopify_orders")
      .select(
        "shopify_order_id, total_price, raw_data, total_tax, total_discounts, total_shipping, customer_email, customer_orders_count, created_at_shopify, financial_status, cancelled_at"
      )
      .eq("organization_id", orgId)
      .gte("created_at_shopify", startISO)
      .lte("created_at_shopify", endISO)
      .not("financial_status", "eq", "voided")
      .is("cancelled_at", null)
      .order("created_at_shopify", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`shopify_orders: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchLineItemsForOrders(
  sb: SupabaseClient,
  orgId: string,
  orderIds: string[]
): Promise<Array<{ shopify_order_id: string; product_id: number | null; variant_id: number | null; quantity: number }>> {
  if (orderIds.length === 0) return [];
  const batchSize = 500;
  let all: any[] = [];
  for (let i = 0; i < orderIds.length; i += batchSize) {
    const batch = orderIds.slice(i, i + batchSize);
    const { data, error } = await sb
      .from("shopify_order_line_items")
      .select("shopify_order_id, product_id, variant_id, quantity")
      .eq("organization_id", orgId)
      .in("shopify_order_id", batch);
    if (error) throw new Error(`shopify_order_line_items: ${error.message}`);
    if (data) all = all.concat(data);
  }
  return all;
}

async function fetchReturningEmails(
  sb: SupabaseClient,
  orgId: string,
  emails: string[],
  beforeISO: string
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const returning = new Set<string>();
  const batchSize = 200;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const { data, error } = await sb
      .from("shopify_orders")
      .select("customer_email")
      .eq("organization_id", orgId)
      .lt("created_at_shopify", beforeISO)
      .in("customer_email", batch)
      .is("cancelled_at", null)
      .not("financial_status", "eq", "voided")
      .limit(batch.length);
    if (error) throw new Error(`shopify_orders (returning): ${error.message}`);
    for (const o of data || []) {
      if (o.customer_email) returning.add(o.customer_email.toLowerCase());
    }
  }
  return returning;
}

async function fetchAdMetricsByPlatform(
  sb: SupabaseClient,
  orgId: string,
  startDate: string,
  endDate: string
): Promise<AdMetricsInternal> {
  const { data, error } = await sb
    .from("ad_metrics_daily")
    .select("spend, impressions, clicks, conversions, conversion_value, purchases, platform, date")
    .eq("organization_id", orgId)
    .in("platform", ["meta", "google_ads"])
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (error) throw new Error(`ad_metrics_daily: ${error.message}`);

  let spend = 0, impressions = 0, clicks = 0, conversions = 0, conversionValue = 0, purchases = 0;
  let metaSpend = 0, googleSpend = 0;
  const dailyMap = new Map<string, { spend: number; purchases: number }>();

  for (const row of data || []) {
    const rSpend = Number(row.spend) || 0;
    const rImp = Number(row.impressions) || 0;
    const rClicks = Number(row.clicks) || 0;
    const rConv = Number(row.conversions) || 0;
    const rConvVal = Number(row.conversion_value) || 0;
    const rPurch = Number(row.purchases) || 0;

    spend += rSpend;
    impressions += rImp;
    clicks += rClicks;
    conversions += rConv;
    conversionValue += rConvVal;
    purchases += rPurch;
    if (row.platform === "meta") metaSpend += rSpend;
    else if (row.platform === "google_ads") googleSpend += rSpend;

    const existing = dailyMap.get(row.date) ?? { spend: 0, purchases: 0 };
    existing.spend += rSpend;
    existing.purchases += rPurch;
    dailyMap.set(row.date, existing);
  }

  const dailyData = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, spend: v.spend, purchases: v.purchases }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    spend, impressions, clicks, conversions, conversionValue, purchases,
    metaSpend, googleSpend, dailyData,
  };
}

async function fetchOrCreateSettings(
  sb: SupabaseClient,
  orgId: string
): Promise<FinanceSettings> {
  const { data, error } = await sb
    .from("finance_settings")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(`finance_settings: ${error.message}`);
  if (data) return data as unknown as FinanceSettings;
  // If no row, return defaults — do NOT insert from a read-only endpoint
  return {
    cogs_percent: 20,
    shipping_cost_percent: 10,
    payment_gateway_percent: 3.5,
    handling_cost_percent: 2,
    monthly_opex: 0,
    return_rate_percent: 5,
    cm_target_percent: 25,
    cogs_mode: "per_product",
    shipping_mode: "per_order_cost",
    gateway_mode: "percent",
    handling_mode: "per_order",
    shipping_cost_per_order: 0,
    handling_fee_per_order: 0,
    handling_fee_per_item: 0,
  };
}

async function fetchMonthlyTarget(
  sb: SupabaseClient,
  orgId: string,
  monthStr: string
): Promise<MonthlyTarget | null> {
  const { data, error } = await sb
    .from("monthly_targets")
    .select("revenue_target, cm_target, ad_spend_budget, new_customers_target")
    .eq("organization_id", orgId)
    .eq("month", monthStr)
    .maybeSingle();
  if (error) throw new Error(`monthly_targets: ${error.message}`);
  return (data as unknown as MonthlyTarget) ?? null;
}

async function fetchProductCosts(
  sb: SupabaseClient,
  orgId: string
): Promise<ProductCost[]> {
  const { data, error } = await sb
    .from("product_costs")
    .select("product_id, variant_id, product_cost, handling_fee")
    .eq("organization_id", orgId);
  if (error) throw new Error(`product_costs: ${error.message}`);
  return (data as unknown as ProductCost[]) || [];
}

async function fetchGatewayCosts(
  sb: SupabaseClient,
  orgId: string
): Promise<GatewayCostSetting[]> {
  const { data, error } = await sb
    .from("gateway_cost_settings")
    .select("gateway_name, percent_fee, flat_fee, is_active")
    .eq("organization_id", orgId);
  if (error) throw new Error(`gateway_cost_settings: ${error.message}`);
  return (data as unknown as GatewayCostSetting[]) || [];
}

async function fetchFinanceExpenses(
  sb: SupabaseClient,
  orgId: string
): Promise<FinanceExpense[]> {
  const { data, error } = await sb
    .from("finance_expenses")
    .select("date, amount, recurrence, start_date, end_date, is_ad_spend")
    .eq("organization_id", orgId);
  if (error) throw new Error(`finance_expenses: ${error.message}`);
  return (data as unknown as FinanceExpense[]) || [];
}

// ═══════════════════════════════════════════════════════════════════
// COST COMPUTATION — port of computeCOGS / computeGatewayFees / totalForPeriod
// ═══════════════════════════════════════════════════════════════════

function computeCOGSFromLineItems(
  lineItems: Array<{ product_id: number | null; variant_id: number | null; quantity: number }>,
  productCosts: ProductCost[]
): number {
  let total = 0;
  for (const li of lineItems) {
    if (!li.product_id) continue;
    const match =
      productCosts.find(p => p.product_id === li.product_id && p.variant_id === li.variant_id) ||
      productCosts.find(p => p.product_id === li.product_id && !p.variant_id);
    if (match) {
      total += (match.product_cost + match.handling_fee) * li.quantity;
    }
  }
  return total;
}

function computeGatewayFeesFromOrders(
  orders: Array<any>,
  gateways: GatewayCostSetting[]
): number {
  const map = new Map(gateways.map(g => [g.gateway_name, g]));
  let total = 0;
  for (const o of orders) {
    const raw = o.raw_data as any;
    if (!raw) continue;
    const names = (raw.payment_gateway_names as string[]) || [];
    const effective = names.length > 0 ? names[names.length - 1] : null;
    if (!effective) continue;
    const setting = map.get(effective);
    if (setting && setting.is_active) {
      total += (o.total_price || 0) * (setting.percent_fee / 100) + setting.flat_fee;
    }
  }
  return total;
}

function computeExpensesForPeriod(
  expenses: FinanceExpense[],
  start: Date,
  end: Date
): { total: number; adSpendTotal: number } {
  let total = 0;
  let adSpendTotal = 0;

  for (const e of expenses) {
    let contribution = 0;

    if (e.recurrence === "one_time") {
      const expDate = parseDate(e.date);
      if (isWithinInterval(expDate, { start, end })) contribution = e.amount;
    } else if (e.recurrence === "daily") {
      const expStart = parseDate(e.start_date ?? e.date);
      const expEnd = e.end_date ? parseDate(e.end_date) : end;
      const effStart = expStart > start ? expStart : start;
      const effEnd = expEnd < end ? expEnd : end;
      if (effStart <= effEnd) {
        const days = diffCalendarDays(effEnd, effStart) + 1;
        contribution = e.amount * days;
      }
    } else if (e.recurrence === "weekly") {
      const expStart = parseDate(e.start_date ?? e.date);
      const expEnd = e.end_date ? parseDate(e.end_date) : end;
      const effStart = expStart > start ? expStart : start;
      const effEnd = expEnd < end ? expEnd : end;
      if (effStart <= effEnd) {
        const weeks = diffCalendarWeeks(effEnd, effStart) + 1;
        contribution = e.amount * weeks;
      }
    } else {
      // monthly (default)
      const expStart = parseDate(e.start_date ?? e.date);
      const expEnd = e.end_date ? parseDate(e.end_date) : end;
      const effStart = expStart > start ? expStart : start;
      const effEnd = expEnd < end ? expEnd : end;
      if (effStart <= effEnd) {
        const months = diffCalendarMonths(effEnd, effStart) + 1;
        contribution = e.amount * months;
      }
    }

    total += contribution;
    if (e.is_ad_spend) adSpendTotal += contribution;
  }

  return { total, adSpendTotal };
}

// ═══════════════════════════════════════════════════════════════════
// STORE METRICS — port of useStoreMetrics.fetchMetrics
// ═══════════════════════════════════════════════════════════════════

async function fetchStoreMetrics(
  sb: SupabaseClient,
  orgId: string,
  start: Date,
  end: Date,
  productCosts: ProductCost[],
  gateways: GatewayCostSetting[]
): Promise<StoreMetricsInternal> {
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const orders = await fetchAllOrders(sb, orgId, startISO, endISO);

  const emptyResult: StoreMetricsInternal = {
    totalSales: 0, grossRevenueBeforeRefunds: 0, orders: 0, returns: 0, taxes: 0, aov: 0,
    discounts: 0, newCustomerRevenue: 0, returningCustomerRevenue: 0,
    newCustomerOrders: 0, unitsSold: 0, totalShipping: 0, lineItemCogs: 0, gatewayFees: 0,
    dailyData: [],
  };
  if (orders.length === 0) return emptyResult;

  // Net price helper (same as useStoreMetrics.getNetPrice)
  const getNetPrice = (o: any): number => {
    const current = o.raw_data?.current_total_price;
    if (current != null) {
      const net = typeof current === "string" ? parseFloat(current) : current;
      return isNaN(net) ? (o.total_price || 0) : net;
    }
    return o.total_price || 0;
  };

  const validOrders = orders.filter(o => o.financial_status !== "refunded");
  const refundedOrders = orders.filter(o => o.financial_status === "refunded");

  const totalSales = validOrders.reduce((sum, o) => sum + getNetPrice(o), 0);
  const grossRevenueBeforeRefunds = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const totalOrders = validOrders.length;
  const returns = refundedOrders.length;
  const taxes = validOrders.reduce((sum, o) => sum + (o.total_tax || 0), 0);
  const discounts = validOrders.reduce((sum, o) => sum + (o.total_discounts || 0), 0);
  const shipping = validOrders.reduce((sum, o) => sum + (o.total_shipping || 0), 0);
  const aov = totalOrders > 0 ? totalSales / totalOrders : 0;

  // Line items → units sold + per-product COGS
  const orderIds = validOrders.map(o => o.shopify_order_id);
  const lineItems = await fetchLineItemsForOrders(sb, orgId, orderIds);
  const unitsSold = lineItems.reduce((sum, li) => sum + (li.quantity || 0), 0);
  const lineItemCogs = computeCOGSFromLineItems(lineItems, productCosts);

  // Gateway fees (per-gateway mode) — computed on valid orders
  const gatewayFees = computeGatewayFeesFromOrders(validOrders, gateways);

  // New vs returning — query all emails that had prior orders
  const periodEmails = Array.from(
    new Set(validOrders.map(o => o.customer_email?.toLowerCase()).filter(Boolean) as string[])
  );
  const returningEmails = await fetchReturningEmails(sb, orgId, periodEmails, startISO);

  const newOrders = validOrders.filter(o =>
    !o.customer_email || !returningEmails.has(o.customer_email.toLowerCase())
  );
  const returningOrders = validOrders.filter(o =>
    o.customer_email && returningEmails.has(o.customer_email.toLowerCase())
  );

  const newCustomerRevenue = newOrders.reduce((sum, o) => sum + getNetPrice(o), 0);
  const returningCustomerRevenue = returningOrders.reduce((sum, o) => sum + getNetPrice(o), 0);

  // Daily breakdown
  const dayCount = diffCalendarDays(end, start) + 1;
  const dailyMap = new Map<string, { totalSales: number; orders: number }>();
  for (let i = 0; i < dayCount; i++) {
    const d = toISODate(addDays(start, i));
    dailyMap.set(d, { totalSales: 0, orders: 0 });
  }
  for (const o of validOrders) {
    const dayStr = (o.created_at_shopify as string).split("T")[0];
    const entry = dailyMap.get(dayStr);
    if (entry) {
      entry.totalSales += getNetPrice(o);
      entry.orders += 1;
    }
  }
  const dailyData = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, totalSales: v.totalSales, orders: v.orders }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalSales,
    grossRevenueBeforeRefunds,
    orders: totalOrders,
    returns,
    taxes,
    aov,
    discounts,
    newCustomerRevenue,
    returningCustomerRevenue,
    newCustomerOrders: newOrders.length,
    unitsSold,
    totalShipping: shipping,
    lineItemCogs,
    gatewayFees,
    dailyData,
  };
}

// ═══════════════════════════════════════════════════════════════════
// CONTRIBUTION MARGIN — port of useContributionMargin
// ═══════════════════════════════════════════════════════════════════

function computeSemaphore(cmPercent: number, targetPercent: number): Semaphore {
  if (cmPercent >= targetPercent) return "green";
  if (cmPercent >= targetPercent - 5) return "yellow";
  return "red";
}

function computeProphitMetrics(
  store: StoreMetricsInternal,
  ad: AdMetricsInternal,
  settings: FinanceSettings,
  target: MonthlyTarget | null,
  customExpensesTotal: number | null,
  start: Date,
  end: Date
): ProphitMetrics {
  const grossRevenue = store.totalSales;
  const returnsAccrual = 0;
  const netSales = grossRevenue - returnsAccrual;

  // Dual-mode cost calculation
  const productCost = settings.cogs_mode === "per_product" && store.lineItemCogs > 0
    ? store.lineItemCogs
    : netSales * (settings.cogs_percent / 100);

  const shippingCost = settings.shipping_mode === "per_order_cost"
    ? Math.max(0, (settings.shipping_cost_per_order ?? 0) * store.orders - store.totalShipping)
    : settings.shipping_mode === "shopify_charges"
      ? store.totalShipping
      : netSales * (settings.shipping_cost_percent / 100);

  const paymentGatewayFees = settings.gateway_mode === "per_gateway" && store.gatewayFees > 0
    ? store.gatewayFees
    : netSales * (settings.payment_gateway_percent / 100);

  const handlingCost = settings.handling_mode === "per_order"
    ? (settings.handling_fee_per_order ?? 0) * store.orders
    : settings.handling_mode === "per_item"
      ? (settings.handling_fee_per_item ?? 0) * store.unitsSold
      : netSales * (settings.handling_cost_percent / 100);

  const variableExpenses = productCost + shippingCost + paymentGatewayFees + handlingCost;
  const adSpend = ad.spend;

  const contributionMargin = netSales - variableExpenses - adSpend;
  const cmPercent = netSales > 0 ? (contributionMargin / netSales) * 100 : 0;

  const costOfDelivery = variableExpenses;
  const costOfDeliveryPct = netSales > 0 ? (costOfDelivery / netSales) * 100 : 0;
  const cacCost = adSpend;
  const cacPct = netSales > 0 ? (cacCost / netSales) * 100 : 0;

  // OpEx prorated
  const daysInPeriod = diffCalendarDays(end, start) + 1;
  const monthDaysTotal = getDaysInMonth(start);
  const monthlyOpex = customExpensesTotal ?? settings.monthly_opex;
  const opexCost = (monthlyOpex / monthDaysTotal) * daysInPeriod;
  const opexPct = netSales > 0 ? (opexCost / netSales) * 100 : 0;

  const profit = netSales - costOfDelivery - cacCost - opexCost;
  const profitPct = netSales > 0 ? (profit / netSales) * 100 : 0;

  // MER / AMER
  const mer = adSpend > 0 ? grossRevenue / adSpend : 0;
  const newCustomerRevenue = store.newCustomerRevenue;
  const newCustomerRevenuePct = grossRevenue > 0 ? newCustomerRevenue / grossRevenue : 0;
  const amer = adSpend > 0 ? newCustomerRevenue / adSpend : 0;

  // Pace / Forecast
  const monthStart = startOfMonth(start);
  const daysInMonth = getDaysInMonth(monthStart);
  const daysElapsed = diffCalendarDays(end, monthStart) + 1;
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  const revenueTarget = target?.revenue_target ?? 0;
  const cmTarget = target?.cm_target ?? 0;
  const dailyPaceTarget = revenueTarget > 0 ? revenueTarget / daysInMonth : 0;

  const dailyActualPace = daysElapsed > 0 ? grossRevenue / daysElapsed : 0;
  const projectedMonthEnd = dailyActualPace * daysInMonth;

  const gapPerDay = daysRemaining > 0 && revenueTarget > 0
    ? Math.max(0, (revenueTarget - grossRevenue) / daysRemaining)
    : 0;

  const cmVsTarget = cmTarget > 0
    ? ((contributionMargin - cmTarget) / cmTarget) * 100
    : 0;
  const expectedCmSoFar = cmTarget > 0 ? (cmTarget / daysInMonth) * daysElapsed : 0;
  const cmVsDailyPace = expectedCmSoFar > 0
    ? ((contributionMargin - expectedCmSoFar) / expectedCmSoFar) * 100
    : 0;

  const semaphore = computeSemaphore(cmPercent, settings.cm_target_percent);

  // Daily breakdown merging store + ad
  const storeDailyMap = new Map(store.dailyData.map(d => [d.date, d.totalSales]));
  const adDailyMap = new Map(ad.dailyData.map(d => [d.date, d.spend]));
  const allDates = new Set([...storeDailyMap.keys(), ...adDailyMap.keys()]);
  const sortedDates = Array.from(allDates).sort();

  const effectiveVarRate = netSales > 0
    ? variableExpenses / netSales
    : (settings.cogs_percent + settings.shipping_cost_percent +
       settings.payment_gateway_percent + settings.handling_cost_percent) / 100;

  let cumulativeCm = 0;
  let cumulativeNetSales = 0;
  const dailyData = sortedDates.map(date => {
    const dayNet = storeDailyMap.get(date) ?? 0;
    const dayVariable = dayNet * effectiveVarRate;
    const dayAd = adDailyMap.get(date) ?? 0;
    const dayCm = dayNet - dayVariable - dayAd;
    cumulativeCm += dayCm;
    cumulativeNetSales += dayNet;
    return {
      date,
      netSales: dayNet,
      adSpend: dayAd,
      cm: dayCm,
      cumulativeCm,
      cumulativeNetSales,
    };
  });

  const grossMargin = netSales - productCost - shippingCost;
  const grossMarginPct = netSales > 0 ? (grossMargin / netSales) * 100 : 0;
  const shippingCostPct = netSales > 0 ? (shippingCost / netSales) * 100 : 0;
  const dailyBurn = daysInPeriod > 0
    ? (productCost + shippingCost + paymentGatewayFees + handlingCost + adSpend + opexCost) / daysInPeriod
    : 0;
  const projectedMonthlyProfit = daysElapsed > 0
    ? (profit / daysElapsed) * daysInMonth
    : 0;

  return {
    grossRevenue,
    returnsAccrual,
    netSales,
    productCost,
    shippingCost,
    paymentGatewayFees,
    handlingCost,
    variableExpenses,
    adSpend,
    metaSpend: ad.metaSpend,
    googleSpend: ad.googleSpend,
    contributionMargin,
    cmPercent,
    costOfDelivery,
    costOfDeliveryPct,
    cacCost,
    cacPct,
    opexCost,
    opexPct,
    profit,
    profitPct,
    cmVsTarget,
    cmVsDailyPace,
    semaphore,
    daysInMonth,
    daysElapsed,
    daysRemaining,
    dailyPaceTarget,
    projectedMonthEnd,
    gapPerDay,
    mer,
    amer,
    newCustomerRevenuePct,
    grossMargin,
    grossMarginPct,
    shippingCostPct,
    dailyBurn,
    projectedMonthlyProfit,
    orders: store.orders,
    unitsSold: store.unitsSold,
    aov: store.aov,
    purchases: ad.purchases,
    dailyData,
    periodStart: toISODate(start),
    periodEnd: toISODate(end),
    periodDays: daysInPeriod,
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER — combines all the above
// ═══════════════════════════════════════════════════════════════════

async function computeRange(
  sb: SupabaseClient,
  orgId: string,
  start: Date,
  end: Date,
  sharedCaches: {
    settings: FinanceSettings;
    expenses: FinanceExpense[];
    productCosts: ProductCost[];
    gateways: GatewayCostSetting[];
  }
): Promise<ProphitMetrics> {
  // Target for the month of the range start
  const monthStr = toISODate(startOfMonth(start));
  const [store, ad, target] = await Promise.all([
    fetchStoreMetrics(sb, orgId, start, end, sharedCaches.productCosts, sharedCaches.gateways),
    fetchAdMetricsByPlatform(sb, orgId, toISODate(start), toISODate(end)),
    fetchMonthlyTarget(sb, orgId, monthStr),
  ]);
  const expenseTotals = computeExpensesForPeriod(sharedCaches.expenses, start, end);
  return computeProphitMetrics(
    store,
    ad,
    sharedCaches.settings,
    target,
    expenseTotals.total > 0 ? expenseTotals.total : null,
    start,
    end,
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { organizationId, currentRange, previousRange } = body ?? {};
    if (!organizationId || !currentRange?.start || !currentRange?.end) {
      return new Response(
        JSON.stringify({ error: "organizationId + currentRange {start,end} required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the authenticated client so RLS is applied when called from the UI with anon key.
    // For service role key, it bypasses RLS — intentional for agent use.
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const startCur = parseDate(currentRange.start);
    const endCur = parseDate(currentRange.end);

    // Shared caches: settings, expenses, products, gateways — don't depend on date range
    const [settings, expenses, productCosts, gateways] = await Promise.all([
      fetchOrCreateSettings(sb, organizationId),
      fetchFinanceExpenses(sb, organizationId),
      fetchProductCosts(sb, organizationId),
      fetchGatewayCosts(sb, organizationId),
    ]);

    const caches = { settings, expenses, productCosts, gateways };
    const current = await computeRange(sb, organizationId, startCur, endCur, caches);

    let previous: ProphitMetrics | null = null;
    let changes: Record<string, number> = {};
    if (previousRange?.start && previousRange?.end) {
      const startPrev = parseDate(previousRange.start);
      const endPrev = parseDate(previousRange.end);
      previous = await computeRange(sb, organizationId, startPrev, endPrev, caches);

      // Changes: percent deltas on the most useful fields
      changes = {
        netSales: calcChange(current.netSales, previous.netSales),
        adSpend: calcChange(current.adSpend, previous.adSpend),
        contributionMargin: calcChange(current.contributionMargin, previous.contributionMargin),
        mer: calcChange(current.mer, previous.mer),
        orders: calcChange(current.orders, previous.orders),
        aov: calcChange(current.aov, previous.aov),
      };
    }

    return new Response(
      JSON.stringify({
        current,
        previous,
        changes,
        metadata: {
          computed_at: new Date().toISOString(),
          organization_id: organizationId,
          source_tables: [
            "shopify_orders", "shopify_order_line_items", "ad_metrics_daily",
            "finance_settings", "monthly_targets", "product_costs",
            "gateway_cost_settings", "finance_expenses",
          ],
          settings_mode: {
            cogs: settings.cogs_mode,
            shipping: settings.shipping_mode,
            gateway: settings.gateway_mode,
            handling: settings.handling_mode,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[prophit-metrics] Fatal:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
