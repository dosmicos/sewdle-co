import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Pin } from 'lucide-react';
import SparklineChart from './SparklineChart';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
  changePercent?: number;
  sparklineData?: number[];
  isPinned?: boolean;
  onPin?: () => void;
  format?: 'currency' | 'percent' | 'number' | 'decimal' | 'time';
}

const MetricCard: React.FC<MetricCardProps> = React.memo(({
  icon,
  label,
  value,
  changePercent,
  sparklineData,
  isPinned,
  onPin,
}) => {
  const isPositive = changePercent !== undefined && changePercent >= 0;
  const changeColor = isPositive ? 'text-emerald-500' : 'text-red-500';
  const sparklineColor = isPositive ? '#22c55e' : '#ef4444';

  return (
    <Card className="relative group hover:shadow-md transition-shadow cursor-default">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {icon && <span className="text-base">{icon}</span>}
            <span className="text-sm font-medium text-gray-500">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {changePercent !== undefined && (
              <div className={cn('flex items-center gap-0.5 text-xs font-medium', changeColor)}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(changePercent).toFixed(2)}%
              </div>
            )}
            {isPinned && (
              <Pin className="h-3.5 w-3.5 text-blue-500 fill-blue-500" />
            )}
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 mb-3">{value}</div>
        {sparklineData && sparklineData.length > 1 && (
          <SparklineChart data={sparklineData} color={sparklineColor} height={40} />
        )}
      </CardContent>
    </Card>
  );
});

MetricCard.displayName = 'MetricCard';

export default MetricCard;
