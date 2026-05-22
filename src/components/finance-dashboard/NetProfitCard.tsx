import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import SparklineChart from './SparklineChart';
import { SemaphoreBadge } from './SemaphoreBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ContributionMarginData, Semaphore } from '@/hooks/useContributionMargin';

interface NetProfitCardProps {
  data: ContributionMarginData;
  formatCOP: (amount: number) => string;
}

const MiniStat: React.FC<{ label: string; value: string; negative?: boolean; emphasis?: boolean }> = ({
  label,
  value,
  negative,
  emphasis,
}) => (
  <div className="text-center">
    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
    <p
      className={`text-xs ${emphasis ? 'font-bold text-gray-900' : 'font-semibold'} ${
        negative ? 'text-red-500' : !emphasis ? 'text-gray-700' : ''
      }`}
    >
      {value}
    </p>
  </div>
);

/**
 * Net Profit semaphore:
 * - green: profit > 0 AND profitPct >= 15% (excellent bottom line)
 * - yellow: profit > 0 AND profitPct >= 5% (healthy)
 * - red: profit <= 0 OR profitPct < 5% (under water or thin)
 */
function computeProfitSemaphore(profit: number, profitPct: number): Semaphore {
  if (profit <= 0) return 'red';
  if (profitPct >= 15) return 'green';
  if (profitPct >= 5) return 'yellow';
  return 'red';
}

export const NetProfitCard: React.FC<NetProfitCardProps> = ({ data, formatCOP }) => {
  const semaphore = computeProfitSemaphore(data.profit, data.profitPct);
  const sparklineColor = semaphore === 'green' ? '#22c55e' : semaphore === 'yellow' ? '#f59e0b' : '#ef4444';

  // Daily Net Profit ≈ daily CM − prorated OpEx
  // We prorate opexCost equally across the period's days
  const dailyOpex = data.dailyData.length > 0 ? data.opexCost / data.dailyData.length : 0;
  let cumulativeProfit = 0;
  const sparklineData = data.dailyData.map(d => {
    cumulativeProfit += d.cm - dailyOpex;
    return cumulativeProfit;
  });

  const isPositive = data.profit > 0;
  const isProjectedPositive = data.projectedMonthlyProfit > 0;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-emerald-50/40 ring-1 ring-emerald-100">
      <CardContent className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Net Profit
              </h2>
              <SemaphoreBadge status={semaphore} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-gray-300 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                    <p className="font-medium mb-1">Bottom line del negocio</p>
                    <p>Net Profit = Net Sales − COGS − Shipping − Handling − Payment Gateways − Taxes − Ad Spend − OpEx</p>
                    <p className="text-gray-400 mt-1">
                      Salud: {'>'}5% ok · {'>'}15% excelente
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-baseline gap-3">
              <span className={`text-3xl font-bold ${isPositive ? 'text-gray-900' : 'text-red-600'}`}>
                {formatCOP(data.profit)}
              </span>
              <span
                className={`text-lg font-semibold ${
                  data.profitPct >= 15
                    ? 'text-emerald-600'
                    : data.profitPct >= 5
                    ? 'text-amber-500'
                    : 'text-red-500'
                }`}
              >
                {data.profitPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Sparkline (cumulative net profit) */}
          <div className="w-32 h-12">
            {sparklineData.length > 1 && (
              <SparklineChart data={sparklineData} color={sparklineColor} height={48} />
            )}
          </div>
        </div>

        {/* Projection */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          {isProjectedPositive ? (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span className={isProjectedPositive ? 'text-emerald-600' : 'text-red-500'}>
            Proyección mes: {formatCOP(data.projectedMonthlyProfit)}
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{data.daysRemaining}d restantes</span>
          {data.profitPct < 0 && (
            <>
              <span className="text-gray-400">·</span>
              <span className="text-red-500 font-medium">bajo el agua</span>
            </>
          )}
        </div>

        {/* Mini breakdown row: CM − OpEx = Net Profit */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3 gap-1">
          <MiniStat label="CM" value={formatCOP(data.contributionMargin)} />
          <span className="text-gray-300 text-xs">−</span>
          <MiniStat label="OpEx" value={formatCOP(data.opexCost)} negative />
          <span className="text-gray-300 text-xs">=</span>
          <MiniStat label="Net Profit" value={formatCOP(data.profit)} emphasis negative={!isPositive} />
        </div>

        {/* Secondary indicators */}
        <div className="flex items-center justify-start gap-5 border-t border-gray-100 pt-2.5 mt-2.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">Profit Margin</span>
                  <Info className="h-3 w-3 text-gray-300" />
                  <span
                    className={`text-xs font-semibold ${
                      data.profitPct >= 15
                        ? 'text-emerald-600'
                        : data.profitPct >= 5
                        ? 'text-amber-500'
                        : 'text-red-500'
                    }`}
                  >
                    {data.profitPct.toFixed(1)}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                <p>Net Profit / Net Sales</p>
                <p className="text-gray-400 mt-0.5">Benchmark: {'>'}5% ok, {'>'}15% excelente</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-gray-400">OpEx</span>
            <span
              className={`text-xs font-semibold ${
                data.opexPct < 15
                  ? 'text-emerald-600'
                  : data.opexPct < 25
                  ? 'text-amber-500'
                  : 'text-red-500'
              }`}
            >
              {data.opexPct.toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-gray-400">CM</span>
            <span className="text-xs font-semibold text-gray-600">
              {data.cmPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default React.memo(NetProfitCard);
