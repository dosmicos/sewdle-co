import React from 'react';
import MetricCard from './MetricCard';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContributionMarginData } from '@/hooks/useContributionMargin';
import type { StoreMetricsResult } from '@/hooks/useStoreMetrics';
import type { AdMetricsResult } from '@/hooks/useAdMetrics';

interface BusinessMetricsRowProps {
  cmData: ContributionMarginData;
  storeMetrics: StoreMetricsResult;
  adMetrics: AdMetricsResult;
  formatCOP: (amount: number) => string;
}

/** Semaphore badge for MER/AMER health status */
const SemaphoreBadge: React.FC<{
  value: number;
  thresholds: { green: number; yellow: number };
}> = ({ value, thresholds }) => {
  const isGreen = value >= thresholds.green;
  const isYellow = !isGreen && value >= thresholds.yellow;

  const color = isGreen
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : isYellow
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-red-100 text-red-700 border-red-200';

  const dot = isGreen ? 'bg-emerald-500' : isYellow ? 'bg-amber-500' : 'bg-red-500';
  const label = isGreen ? 'Saludable' : isYellow ? 'Atencion' : 'Critico';

  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full border', color)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  );
};

/** Highlighted metric card for MER and AMER */
const EfficiencyMetricCard: React.FC<{
  label: string;
  value: number;
  tooltip: string;
  thresholds: { green: number; yellow: number };
}> = ({ label, value, tooltip, thresholds }) => {
  const isGreen = value >= thresholds.green;
  const isYellow = !isGreen && value >= thresholds.yellow;
  const ringClass = isGreen
    ? 'ring-emerald-200'
    : isYellow
      ? 'ring-amber-200'
      : 'ring-red-200';

  return (
    <Card className={cn('relative hover:shadow-md transition-shadow ring-2', ringClass)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-700">{label}</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <SemaphoreBadge value={value} thresholds={thresholds} />
        </div>
        <div className="text-2xl font-bold text-gray-900">{value.toFixed(2)}x</div>
      </CardContent>
    </Card>
  );
};

export const BusinessMetricsRow: React.FC<BusinessMetricsRowProps> = ({
  cmData,
  storeMetrics,
  adMetrics,
  formatCOP,
}) => {
  const dailySales = React.useMemo(() => storeMetrics.current.dailyData.map(d => d.totalSales), [storeMetrics.current.dailyData]);
  const dailyOrders = React.useMemo(() => storeMetrics.current.dailyData.map(d => d.orders), [storeMetrics.current.dailyData]);
  const dailyAdSpend = React.useMemo(() => adMetrics.current.dailyData.map(d => d.spend), [adMetrics.current.dailyData]);

  // Net Shipping Cost = Shipping Revenue (from Shopify) - Estimated shipping cost
  const shippingRevenue = storeMetrics.current.totalShipping;
  const estimatedShippingCost = cmData.shippingCost;
  const netShippingCost = shippingRevenue - estimatedShippingCost;
  const prevShippingRevenue = storeMetrics.previous.totalShipping;
  // current_total_price already accounts for refunds, no need for return rate adjustment
  const prevNetSales = storeMetrics.previous.totalSales;
  const prevEstimatedCost = prevNetSales * (cmData.shippingCost / (cmData.netSales || 1));
  const prevNetShipping = prevShippingRevenue - prevEstimatedCost;
  const netShippingChange = prevNetShipping !== 0
    ? ((netShippingCost - prevNetShipping) / Math.abs(prevNetShipping)) * 100
    : (netShippingCost > 0 ? 100 : 0);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
        Business Metrics
      </h3>

      {/* Row 1: MER & AMER — primary efficiency metrics (Prophit System) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <EfficiencyMetricCard
          label="MER"
          value={cmData.mer}
          tooltip="Marketing Efficiency Ratio = Total Revenue / Total Ad Spend. La metrica mas honesta de eficiencia de marketing. Objetivo: >4x."
          thresholds={{ green: 4, yellow: 2.5 }}
        />
        <EfficiencyMetricCard
          label="AMER"
          value={cmData.amer}
          tooltip="Acquisition MER = New Customer Revenue / Ad Spend. Eficiencia de adquisicion de clientes nuevos. Metrica #1 segun Prophit System (Taylor Holiday / CTC)."
          thresholds={{ green: 2, yellow: 1.5 }}
        />
      </div>

      {/* Row 2: Revenue & cost metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Revenue"
          value={formatCOP(cmData.grossRevenue)}
          changePercent={storeMetrics.changes.totalSales}
          sparklineData={dailySales}
        />
        <MetricCard
          label="Gross Margin"
          value={`${cmData.grossMarginPct.toFixed(1)}%`}
          changePercent={undefined}
          sparklineData={[]}
        />
        <MetricCard
          label="AOV"
          value={formatCOP(storeMetrics.current.aov)}
          changePercent={storeMetrics.changes.aov}
          sparklineData={[]}
        />
        <MetricCard
          label="Orders"
          value={new Intl.NumberFormat('es-CO').format(storeMetrics.current.orders)}
          changePercent={storeMetrics.changes.orders}
          sparklineData={dailyOrders}
        />
      </div>

      {/* Row 3: Spend & operational */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Ad Spend"
          value={formatCOP(cmData.adSpend)}
          changePercent={adMetrics.changes.spend}
          sparklineData={dailyAdSpend}
        />
        <MetricCard
          label="Costo Diario"
          value={`${formatCOP(cmData.dailyBurn)}/dia`}
          changePercent={undefined}
          sparklineData={[]}
        />
        <MetricCard
          label="Net Shipping"
          value={formatCOP(netShippingCost)}
          changePercent={netShippingChange}
          sparklineData={[]}
        />
      </div>
    </div>
  );
};

export default React.memo(BusinessMetricsRow);
