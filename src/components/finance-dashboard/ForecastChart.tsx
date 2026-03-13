import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { ContributionMarginData } from '@/hooks/useContributionMargin';
import type { MonthlyTarget } from '@/hooks/useMonthlyTargets';

interface ForecastChartProps {
  cmData: ContributionMarginData;
  target: MonthlyTarget | null;
  formatCOP: (amount: number) => string;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({ cmData, target, formatCOP }) => {
  const revenueTarget = target?.revenue_target ?? 0;

  // If no target set, don't show chart
  if (revenueTarget <= 0) {
    return null;
  }

  // Build chart data: cumulative net sales + linear pace
  const chartData = cmData.dailyData.map((d, idx) => {
    const dayNum = idx + 1;
    const linearPace = (revenueTarget / cmData.daysInMonth) * dayNum;
    return {
      date: d.date.substring(5), // "MM-DD"
      actual: d.cumulativeNetSales,
      pace: linearPace,
    };
  });

  // Project remaining days pace line
  const lastActualDay = chartData.length;
  for (let i = lastActualDay + 1; i <= cmData.daysInMonth; i++) {
    const dayStr = String(i).padStart(2, '0');
    chartData.push({
      date: `${dayStr}`,
      actual: undefined as unknown as number,
      pace: (revenueTarget / cmData.daysInMonth) * i,
    });
  }

  const isAhead = cmData.dailyData.length > 0 &&
    cmData.dailyData[cmData.dailyData.length - 1].cumulativeNetSales >=
    (revenueTarget / cmData.daysInMonth) * cmData.daysElapsed;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Revenue Pace to Target</p>
            <p className="text-xs text-gray-400">
              Target: {formatCOP(revenueTarget)} · Projected: {formatCOP(cmData.projectedMonthEnd)}
            </p>
          </div>
          <div className="text-right">
            <span className={`text-sm font-semibold ${isAhead ? 'text-emerald-600' : 'text-red-500'}`}>
              {isAhead ? 'Ahead' : 'Behind'} by {formatCOP(Math.abs(cmData.projectedMonthEnd - revenueTarget))}
            </span>
            {cmData.daysRemaining > 0 && cmData.gapPerDay > 0 && (
              <p className="text-[10px] text-gray-400">
                Need {formatCOP(cmData.gapPerDay)}/day for remaining {cmData.daysRemaining} days
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
                  name === 'actual' ? 'Actual' : 'Pace',
                ]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <ReferenceLine
                y={revenueTarget}
                stroke="#6b7280"
                strokeDasharray="4 4"
                label={{ value: 'Target', position: 'right', fontSize: 10, fill: '#6b7280' }}
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
                stroke={isAhead ? '#22c55e' : '#ef4444'}
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

export default ForecastChart;
