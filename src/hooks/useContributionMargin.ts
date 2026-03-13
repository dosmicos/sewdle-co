import { useMemo } from 'react';
import { getDaysInMonth, differenceInCalendarDays, startOfMonth } from 'date-fns';
import type { StoreMetricsResult } from './useStoreMetrics';
import type { AdMetricsResult } from './useAdMetrics';
import type { FinanceSettings } from './useFinanceSettings';
import type { MonthlyTarget } from './useMonthlyTargets';
import type { DateRange } from './useFinanceDateRange';

/** Pre-computed cost overrides from cost settings hooks (per-product, per-gateway, etc.) */
export interface CostOverrides {
  productCost?: number;        // from useProductCosts.computeCOGS()
  shippingCost?: number;       // from storeMetrics.totalShipping when mode='shopify_charges'
  paymentGatewayFees?: number; // from useGatewayCosts.computeGatewayFees()
  handlingCost?: number;       // included in productCost when per-product mode
  customExpenses?: number;     // from useFinanceExpenses.totalForPeriod()
}

export type Semaphore = 'green' | 'yellow' | 'red';

export interface DailyBreakdown {
  date: string;
  netSales: number;
  adSpend: number;
  cm: number;
  cumulativeCm: number;
  cumulativeNetSales: number;
}

export interface ContributionMarginData {
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

  // Results
  contributionMargin: number;
  cmPercent: number;

  // Four Quarters (percentages of net sales)
  costOfDeliveryPct: number;
  cacPct: number;
  opexPct: number;
  profitPct: number;

  // Four Quarters (absolute values)
  costOfDelivery: number;
  cacCost: number;
  opexCost: number;
  profit: number;

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

  // Daily breakdown
  dailyData: DailyBreakdown[];

  // MER
  mer: number;
}

function computeSemaphore(cmPercent: number, targetPercent: number): Semaphore {
  if (cmPercent >= targetPercent) return 'green';
  if (cmPercent >= targetPercent - 5) return 'yellow';
  return 'red';
}

export function useContributionMargin(
  storeMetrics: StoreMetricsResult,
  adMetrics: AdMetricsResult,
  settings: FinanceSettings | null,
  target: MonthlyTarget | null,
  currentRange: DateRange,
  costOverrides?: CostOverrides
): ContributionMarginData {
  return useMemo(() => {
    const s = settings ?? {
      cogs_percent: 20,
      shipping_cost_percent: 10,
      payment_gateway_percent: 3.5,
      handling_cost_percent: 2,
      monthly_opex: 0,
      return_rate_percent: 5,
      cm_target_percent: 25,
      cogs_mode: 'per_product' as const,
      shipping_mode: 'per_order_cost' as const,
      shipping_cost_per_order: 0,
      gateway_mode: 'percent' as const,
      handling_mode: 'per_order' as const,
      handling_fee_per_order: 0,
      handling_fee_per_item: 0,
    };

    // Revenue
    const grossRevenue = storeMetrics.current.totalSales;
    const returnsAccrual = grossRevenue * (s.return_rate_percent / 100);
    const netSales = grossRevenue - returnsAccrual;

    // Dual-mode cost calculation: use overrides when mode is not 'percent'
    const productCost = (s.cogs_mode === 'per_product' && costOverrides?.productCost !== undefined)
      ? costOverrides.productCost
      : netSales * (s.cogs_percent / 100);

    // Shipping: per_order_cost mode = (real_cost × orders) − shipping_collected
    const shippingCost = s.shipping_mode === 'per_order_cost'
      ? Math.max(0, (s.shipping_cost_per_order ?? 0) * storeMetrics.current.orders - storeMetrics.current.totalShipping)
      : (s.shipping_mode === 'shopify_charges' && costOverrides?.shippingCost !== undefined)
        ? costOverrides.shippingCost
        : netSales * (s.shipping_cost_percent / 100);

    const paymentGatewayFees = (s.gateway_mode === 'per_gateway' && costOverrides?.paymentGatewayFees !== undefined)
      ? costOverrides.paymentGatewayFees
      : netSales * (s.payment_gateway_percent / 100);

    // Handling: per_order = fee × orders, per_item = fee × units sold, percent = % of net sales
    const handlingCost = s.handling_mode === 'per_order'
      ? (s.handling_fee_per_order ?? 0) * storeMetrics.current.orders
      : s.handling_mode === 'per_item'
        ? (s.handling_fee_per_item ?? 0) * storeMetrics.current.unitsSold
        : netSales * (s.handling_cost_percent / 100);

    const variableExpenses = productCost + shippingCost + paymentGatewayFees + handlingCost;

    // Ad spend
    const adSpend = adMetrics.current.spend;

    // Contribution Margin
    const contributionMargin = netSales - variableExpenses - adSpend;
    const cmPercent = netSales > 0 ? (contributionMargin / netSales) * 100 : 0;

    // Four Quarters
    const costOfDelivery = variableExpenses;
    const costOfDeliveryPct = netSales > 0 ? (costOfDelivery / netSales) * 100 : 0;
    const cacCost = adSpend;
    const cacPct = netSales > 0 ? (cacCost / netSales) * 100 : 0;

    // OpEx: prorate from monthly total to the number of days in range
    // Use computed expenses total when available, otherwise fall back to flat monthly_opex
    const daysInPeriod = differenceInCalendarDays(currentRange.end, currentRange.start) + 1;
    const monthDaysTotal = getDaysInMonth(currentRange.start);
    const monthlyOpex = costOverrides?.customExpenses ?? s.monthly_opex;
    const opexCost = (monthlyOpex / monthDaysTotal) * daysInPeriod;
    const opexPct = netSales > 0 ? (opexCost / netSales) * 100 : 0;

    // Profit = what remains after CoD, CAC, OpEx
    const profit = netSales - costOfDelivery - cacCost - opexCost;
    const profitPct = netSales > 0 ? (profit / netSales) * 100 : 0;

    // MER
    const mer = adSpend > 0 ? grossRevenue / adSpend : 0;

    // Pace / Forecast
    const monthStart = startOfMonth(currentRange.start);
    const daysInMonth = getDaysInMonth(monthStart);
    const daysElapsed = differenceInCalendarDays(currentRange.end, monthStart) + 1;
    const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

    const revenueTarget = target?.revenue_target ?? 0;
    const cmTarget = target?.cm_target ?? 0;
    const dailyPaceTarget = revenueTarget > 0 ? revenueTarget / daysInMonth : 0;

    // Projected month-end revenue based on current pace
    const dailyActualPace = daysElapsed > 0 ? grossRevenue / daysElapsed : 0;
    const projectedMonthEnd = dailyActualPace * daysInMonth;

    // Gap per day to hit target
    const gapPerDay = daysRemaining > 0 && revenueTarget > 0
      ? Math.max(0, (revenueTarget - grossRevenue) / daysRemaining)
      : 0;

    // CM vs target
    const cmVsTarget = cmTarget > 0
      ? ((contributionMargin - cmTarget) / cmTarget) * 100
      : 0;

    // CM vs daily pace
    const expectedCmSoFar = cmTarget > 0 ? (cmTarget / daysInMonth) * daysElapsed : 0;
    const cmVsDailyPace = expectedCmSoFar > 0
      ? ((contributionMargin - expectedCmSoFar) / expectedCmSoFar) * 100
      : 0;

    const semaphore = computeSemaphore(cmPercent, s.cm_target_percent);

    // Daily breakdown (merge store + ad daily data)
    const storeDailyMap = new Map(
      storeMetrics.current.dailyData.map(d => [d.date, d.totalSales])
    );
    const adDailyMap = new Map(
      adMetrics.current.dailyData.map(d => [d.date, d.spend])
    );

    // Collect all dates
    const allDates = new Set([
      ...storeMetrics.current.dailyData.map(d => d.date),
      ...adMetrics.current.dailyData.map(d => d.date),
    ]);

    const sortedDates = Array.from(allDates).sort();
    let cumulativeCm = 0;
    let cumulativeNetSales = 0;

    // For daily breakdown, derive effective variable cost rate from period totals
    const effectiveVarRate = netSales > 0 ? variableExpenses / netSales : (
      (s.cogs_percent + s.shipping_cost_percent + s.payment_gateway_percent + s.handling_cost_percent) / 100
    );

    const dailyData: DailyBreakdown[] = sortedDates.map(date => {
      const dayGross = storeDailyMap.get(date) ?? 0;
      const dayReturns = dayGross * (s.return_rate_percent / 100);
      const dayNet = dayGross - dayReturns;
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
      contributionMargin,
      cmPercent,
      costOfDeliveryPct,
      cacPct,
      opexPct,
      profitPct,
      costOfDelivery,
      cacCost,
      opexCost,
      profit,
      cmVsTarget,
      cmVsDailyPace,
      semaphore,
      daysInMonth,
      daysElapsed,
      daysRemaining,
      dailyPaceTarget,
      projectedMonthEnd,
      gapPerDay,
      dailyData,
      mer,
    };
  }, [storeMetrics.current, adMetrics.current, settings, target, currentRange, costOverrides]);
}
