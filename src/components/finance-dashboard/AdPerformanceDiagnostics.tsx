import React from 'react';
import { Trophy, AlertTriangle, BarChart3, XCircle } from 'lucide-react';
import { type AdPerformanceRow } from '@/hooks/useAdPerformance';

interface Props {
  ads: AdPerformanceRow[];
  formatCurrency: (n: number) => string;
}

const MIN_SPEND_FOR_WORST = 20000;

const AdPerformanceDiagnostics: React.FC<Props> = ({ ads, formatCurrency }) => {
  if (ads.length === 0) return null;

  // Top ad by ROAS (must have spend > 0)
  const adsWithSpend = ads.filter((a) => a.spend > 0);
  const topAd = adsWithSpend.length > 0
    ? adsWithSpend.reduce((best, a) => (a.roas > best.roas ? a : best))
    : null;

  // Worst ad by ROAS with significant spend
  const adsWithMinSpend = adsWithSpend.filter((a) => a.spend >= MIN_SPEND_FOR_WORST);
  const worstAd = adsWithMinSpend.length > 0
    ? adsWithMinSpend.reduce((worst, a) => (a.roas < worst.roas ? a : worst))
    : null;

  const activeCount = ads.length;
  const problemCount = adsWithSpend.filter((a) => a.roas < 1.5).length;

  const cards = [
    {
      icon: <Trophy className="h-4 w-4 text-green-600" />,
      label: 'Top Ad',
      value: topAd ? `${topAd.roas.toFixed(2)}x` : '-',
      detail: topAd?.ad_name || '',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
    },
    {
      icon: <XCircle className="h-4 w-4 text-red-600" />,
      label: 'Peor Ad',
      value: worstAd ? `${worstAd.roas.toFixed(2)}x` : '-',
      detail: worstAd?.ad_name || `Sin ads con gasto > ${formatCurrency(MIN_SPEND_FOR_WORST)}`,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
    },
    {
      icon: <BarChart3 className="h-4 w-4 text-blue-600" />,
      label: 'Ads Activos',
      value: activeCount.toString(),
      detail: '',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
    },
    {
      icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
      label: 'Ads Problema',
      value: problemCount.toString(),
      detail: 'ROAS < 1.5x',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bgColor} ${card.borderColor} border rounded-lg p-3`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {card.icon}
            <span className="text-xs font-medium text-gray-600">
              {card.label}
            </span>
          </div>
          <div className={`text-lg font-bold ${card.textColor}`}>
            {card.value}
          </div>
          {card.detail && (
            <p className="text-xs text-gray-500 truncate mt-0.5" title={card.detail}>
              {card.detail}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdPerformanceDiagnostics;
