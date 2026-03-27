import React from 'react';
import MetricCard from './MetricCard';
import type { ContributionMarginData } from '@/hooks/useContributionMargin';
import type { StoreMetricsResult } from '@/hooks/useStoreMetrics';
import type { AdMetricsResult } from '@/hooks/useAdMetrics';

interface BusinessMetricsRowProps {
  cmData: ContributionMarginData;
  storeMetrics: StoreMetricsResult;
  adMetrics: AdMetricsResult;
  formatCOP: (amount: number) => string;
}

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Revenue"
          value={formatCOP(cmData.grossRevenue)}
          changePercent={storeMetrics.changes.totalSales}
          sparklineData={dailySales}
        />
        <MetricCard
          label="Ad Spend"
          value={formatCOP(cmData.adSpend)}
          changePercent={adMetrics.changes.spend}
          sparklineData={dailyAdSpend}
        />
        <MetricCard
          label="MER"
          value={cmData.mer.toFixed(2)}
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
