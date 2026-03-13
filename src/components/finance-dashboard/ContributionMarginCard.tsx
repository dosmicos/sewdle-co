import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import SparklineChart from './SparklineChart';
import { SemaphoreBadge } from './SemaphoreBadge';
import type { ContributionMarginData } from '@/hooks/useContributionMargin';

interface ContributionMarginCardProps {
  data: ContributionMarginData;
  formatCOP: (amount: number) => string;
}

const MiniStat: React.FC<{ label: string; value: string; negative?: boolean }> = ({ label, value, negative }) => (
  <div className="text-center">
    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
    <p className={`text-xs font-semibold ${negative ? 'text-red-500' : 'text-gray-700'}`}>{value}</p>
  </div>
);

export const ContributionMarginCard: React.FC<ContributionMarginCardProps> = ({ data, formatCOP }) => {
  const sparklineData = data.dailyData.map(d => d.cm);
  const sparklineColor = data.semaphore === 'green' ? '#22c55e' : data.semaphore === 'yellow' ? '#f59e0b' : '#ef4444';

  const paceText = data.daysRemaining > 0 && data.dailyPaceTarget > 0
    ? `${formatCOP(data.gapPerDay)}/día necesario`
    : null;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
      <CardContent className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Contribution Margin
              </h2>
              <SemaphoreBadge status={data.semaphore} />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-gray-900">
                {formatCOP(data.contributionMargin)}
              </span>
              <span className={`text-lg font-semibold ${data.cmPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {data.cmPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Sparkline */}
          <div className="w-32 h-12">
            {sparklineData.length > 1 && (
              <SparklineChart data={sparklineData} color={sparklineColor} height={48} />
            )}
          </div>
        </div>

        {/* Pace info */}
        {paceText && (
          <div className="flex items-center gap-2 mb-4 text-sm">
            {data.cmVsDailyPace >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={data.cmVsDailyPace >= 0 ? 'text-emerald-600' : 'text-red-500'}>
              {data.cmVsDailyPace >= 0 ? '+' : ''}{data.cmVsDailyPace.toFixed(1)}% vs pace
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">{paceText}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">{data.daysRemaining}d restantes</span>
          </div>
        )}

        {/* Mini breakdown row */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3 gap-1">
          <MiniStat label="Net Sales" value={formatCOP(data.netSales)} />
          <span className="text-gray-300 text-xs">−</span>
          <MiniStat label="COGS" value={formatCOP(data.productCost)} negative />
          <span className="text-gray-300 text-xs">−</span>
          <MiniStat label="Shipping" value={formatCOP(data.shippingCost)} negative />
          <span className="text-gray-300 text-xs">−</span>
          <MiniStat label="Variables" value={formatCOP(data.paymentGatewayFees + data.handlingCost)} negative />
          <span className="text-gray-300 text-xs">−</span>
          <MiniStat label="Ad Spend" value={formatCOP(data.adSpend)} negative />
          <span className="text-gray-300 text-xs">=</span>
          <MiniStat label="CM" value={formatCOP(data.contributionMargin)} />
        </div>
      </CardContent>
    </Card>
  );
};

export default ContributionMarginCard;
