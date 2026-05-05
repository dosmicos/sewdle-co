import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { ContributionMarginData } from '@/hooks/useContributionMargin';
import type { MonthlyTarget } from '@/hooks/useMonthlyTargets';

interface AdSpendPaceChartProps {
  cmData: ContributionMarginData;
  target: MonthlyTarget | null;
  formatCOP: (amount: number) => string;
}

export const AdSpendPaceChart: React.FC<AdSpendPaceChartProps> = ({ cmData, target, formatCOP }) => {
  const adSpendBudget = target?.ad_spend_budget ?? 0;

  if (adSpendBudget <= 0) {
    return null;
  }

  // Calculate cumulative ad spend from daily data
  let cumulative = 0;
  const chartData = cmData.dailyData.map((d, idx) => {
    cumulative += d.adSpend;
    const dayNum = idx + 1;
    const linearPace = (adSpendBudget / cmData.daysInMonth) * dayNum;
    return {
      date: d.date.substring(5),
      actual: cumulative,
      pace: linearPace,
    };
  });

  const totalSpend = cumulative;

  // Project remaining days pace line
  const lastActualDay = chartData.length;
  for (let i = lastActualDay + 1; i <= cmData.daysInMonth; i++) {
    const dayStr = String(i).padStart(2, '0');
    chartData.push({
      date: `${dayStr}`,
      actual: undefined as unknown as number,
      pace: (adSpendBudget / cmData.daysInMonth) * i,
    });
  }

  // Projected month-end spend
  const projectedMonthEnd = cmData.daysElapsed > 0
    ? (totalSpend / cmData.daysElapsed) * cmData.daysInMonth
    : 0;

  // Gap per day to hit budget
  const gapPerDay = cmData.daysRemaining > 0
    ? Math.max(0, (adSpendBudget - totalSpend) / cmData.daysRemaining)
    : 0;

  // Under budget = green, over budget = red
  const isUnderBudget = totalSpend <= (adSpendBudget / cmData.daysInMonth) * cmData.daysElapsed;
  const diff = Math.abs(projectedMonthEnd - adSpendBudget);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Ad Spend Pace to Budget</p>
            <p className="text-xs text-gray-400">
              Budget: {formatCOP(adSpendBudget)} · Projected: {formatCOP(projectedMonthEnd)}
            </p>
          </div>
          <div className="text-right">
            <span className={`text-sm font-semibold ${isUnderBudget ? 'text-emerald-600' : 'text-red-500'}`}>
              {isUnderBudget ? 'Under' : 'Over'} by {formatCOP(diff)}
            </span>
            {cmData.daysRemaining > 0 && gapPerDay > 0 && (
              <p className="text-[10px] text-gray-400">
                {formatCOP(gapPerDay)}/day for remaining {cmData.daysRemaining} days
              </p>
            )}
          </div>
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
              />
              <Tooltip
                formatter={(value: number | undefined, name: string) => [
                  value !== undefined ? formatCOP(value) : '—',
                  name === 'actual' ? 'Actual' : 'Budget Pace',
                ]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <ReferenceLine
                y={adSpendBudget}
                stroke="#6b7280"
                strokeDasharray="4 4"
                label={{ value: 'Budget', position: 'right', fontSize: 10, fill: '#6b7280' }}
              />
              <Line
                type="monotone"
                dataKey="pace"
                stroke="#d1d5db"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                isAnimationActive={false}
                name="pace"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke={isUnderBudget ? '#22c55e' : '#ef4444'}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
                name="actual"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default React.memo(AdSpendPaceChart);
