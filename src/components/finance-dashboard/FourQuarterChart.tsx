import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import type { ContributionMarginData } from '@/hooks/useContributionMargin';

interface FourQuarterChartProps {
  data: ContributionMarginData;
  formatCOP: (amount: number) => string;
}

const QUARTER_COLORS = {
  delivery: '#f59e0b',  // amber — Cost of Delivery
  marketing: '#3b82f6', // blue — CAC / Marketing
  opex: '#8b5cf6',      // purple — OpEx
  profit: '#22c55e',     // green — Profit
};

const QUARTER_LABELS = {
  delivery: 'Cost of Delivery',
  marketing: 'Marketing (CAC)',
  opex: 'OpEx',
  profit: 'Profit',
};

interface QuarterBadgeProps {
  label: string;
  pct: number;
  color: string;
  amount: number;
  formatCOP: (v: number) => string;
}

const QuarterBadge: React.FC<QuarterBadgeProps> = ({ label, pct, color, amount, formatCOP }) => (
  <div className="flex items-center gap-2">
    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500 truncate">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{pct.toFixed(1)}%</p>
      <p className="text-[10px] text-gray-400">{formatCOP(amount)}</p>
    </div>
  </div>
);

export const FourQuarterChart: React.FC<FourQuarterChartProps> = ({ data, formatCOP }) => {
  // Ensure all values are non-negative for the chart
  const deliveryPct = Math.max(0, data.costOfDeliveryPct);
  const marketingPct = Math.max(0, data.cacPct);
  const opexPct = Math.max(0, data.opexPct);
  // Profit can be negative — clamp to 0 for the chart, show actual in badge
  const profitPctForChart = Math.max(0, data.profitPct);

  const chartData = [
    { name: QUARTER_LABELS.delivery, value: deliveryPct, color: QUARTER_COLORS.delivery },
    { name: QUARTER_LABELS.marketing, value: marketingPct, color: QUARTER_COLORS.marketing },
    { name: QUARTER_LABELS.opex, value: opexPct, color: QUARTER_COLORS.opex },
    { name: QUARTER_LABELS.profit, value: profitPctForChart, color: QUARTER_COLORS.profit },
  ].filter(d => d.value > 0);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Four Quarter View
        </h3>
        <div className="flex items-center gap-6">
          {/* Donut */}
          <div className="relative w-40 h-40 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-gray-400">Total</span>
              <span className="text-sm font-bold text-gray-800">{total.toFixed(0)}%</span>
            </div>
          </div>

          {/* Badges */}
          <div className="grid grid-cols-2 gap-3 flex-1">
            <QuarterBadge
              label={QUARTER_LABELS.delivery}
              pct={data.costOfDeliveryPct}
              color={QUARTER_COLORS.delivery}
              amount={data.costOfDelivery}
              formatCOP={formatCOP}
            />
            <QuarterBadge
              label={QUARTER_LABELS.marketing}
              pct={data.cacPct}
              color={QUARTER_COLORS.marketing}
              amount={data.cacCost}
              formatCOP={formatCOP}
            />
            <QuarterBadge
              label={QUARTER_LABELS.opex}
              pct={data.opexPct}
              color={QUARTER_COLORS.opex}
              amount={data.opexCost}
              formatCOP={formatCOP}
            />
            <QuarterBadge
              label={QUARTER_LABELS.profit}
              pct={data.profitPct}
              color={data.profitPct >= 0 ? QUARTER_COLORS.profit : '#ef4444'}
              amount={data.profit}
              formatCOP={formatCOP}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FourQuarterChart;
