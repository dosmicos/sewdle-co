import React from 'react';
import { AlertTriangle, Lightbulb, Loader2, TrendingDown, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { type AngleWinnerRow, useAngleWinners } from '@/hooks/useAngleWinners';
import { getAngleDecisionLabel } from '@/lib/angleIntelligence';

const formatCOP = (amount: number) =>
  `COP ${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;

const statusConfig = {
  winner: {
    icon: <Trophy className="h-3.5 w-3.5" />,
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  promising: {
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  needs_data: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  loser: {
    icon: <TrendingDown className="h-3.5 w-3.5" />,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
} as const;

const AngleCard: React.FC<{ angle: AngleWinnerRow }> = ({ angle }) => {
  const config = statusConfig[angle.status];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.className}`}>
              <span className="inline-flex items-center gap-1">
                {config.icon}
                {getAngleDecisionLabel(angle.status)}
              </span>
            </Badge>
            {angle.product && (
              <span className="text-[10px] text-gray-400 truncate">{angle.product}</span>
            )}
          </div>
          <h3 className="mt-1 text-sm font-semibold text-gray-900 truncate">{angle.label}</h3>
          {angle.best_hook && (
            <p className="text-xs text-gray-500 line-clamp-2">Hook: “{angle.best_hook}”</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${angle.roas >= 2 ? 'text-green-600' : angle.roas >= 1 ? 'text-amber-600' : 'text-red-600'}`}>
            {angle.roas.toFixed(2)}x
          </p>
          <p className="text-[10px] text-gray-400">ROAS</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <p className="text-gray-400">Spend</p>
          <p className="font-medium text-gray-700 truncate">{formatCOP(angle.total_spend)}</p>
        </div>
        <div>
          <p className="text-gray-400">Purch</p>
          <p className="font-medium text-gray-700">{angle.total_purchases}</p>
        </div>
        <div>
          <p className="text-gray-400">CPA</p>
          <p className="font-medium text-gray-700 truncate">{angle.total_purchases > 0 ? formatCOP(angle.cpa) : '-'}</p>
        </div>
        <div>
          <p className="text-gray-400">Ads</p>
          <p className="font-medium text-gray-700">{angle.ad_count}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {angle.creative_type && <Badge variant="outline" className="text-[10px] px-1 py-0">{angle.creative_type}</Badge>}
        {angle.hook_pattern && <Badge variant="outline" className="text-[10px] px-1 py-0">{angle.hook_pattern.replace(/_/g, ' ')}</Badge>}
        {angle.best_creator && <Badge variant="outline" className="text-[10px] px-1 py-0">{angle.best_creator}</Badge>}
      </div>

      <p className="text-xs text-gray-600 bg-gray-50 rounded-md p-2">{angle.recommendation}</p>
    </div>
  );
};

const AngleWinnersPanel: React.FC<{ periodType: '7d' | '30d' }> = ({ periodType }) => {
  const { angles, winners, promising, losers, isLoading } = useAngleWinners(periodType);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculando ángulos...
      </div>
    );
  }

  if (angles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-purple-200 bg-purple-50/40 p-4">
        <p className="text-sm font-medium text-purple-900">Angle Winners todavía no tiene datos</p>
        <p className="text-xs text-purple-700 mt-1">
          Corre Sync Tags con AngleOS y luego Compute Intelligence para llenar specific_angle, hook_pattern y buyer_problem.
        </p>
      </div>
    );
  }

  const topAngles = angles.slice(0, 6);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Angle Winners</h2>
          <p className="text-xs text-gray-400">Ángulos específicos por performance, no solo sales_angle genérico.</p>
        </div>
        <div className="flex gap-1 text-[10px]">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{winners.length} winners</Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{promising.length} promising</Badge>
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{losers.length} losers</Badge>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {topAngles.map((angle) => (
          <AngleCard key={angle.specific_angle} angle={angle} />
        ))}
      </div>
    </div>
  );
};

export default AngleWinnersPanel;
