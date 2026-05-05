import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
}

const SparklineChart: React.FC<SparklineChartProps> = React.memo(({
  data,
  color = '#22c55e',
  height = 40
}) => {
  const chartData = React.useMemo(() => data.map((value, index) => ({ value, index })), [data]);

  if (chartData.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

SparklineChart.displayName = 'SparklineChart';

export default SparklineChart;
