import React from 'react';
import { DollarSign, TrendingUp, ShoppingCart, Target, Banknote } from 'lucide-react';
import { type AdPerformanceRow } from '@/hooks/useAdPerformance';

interface Props {
  ads: AdPerformanceRow[];
  formatCurrency: (n: number) => string;
}

const AdPerformanceDiagnostics: React.FC<Props> = ({ ads, formatCurrency }) => {
  if (ads.length === 0) return null;

  const adsWithSpend = ads.filter((a) => a.spend > 0);

  // Portfolio-level metrics (Taylor Holiday style)
  const totalSpend = adsWithSpend.reduce((sum, a) => sum + a.spend, 0);
  const totalRevenue = adsWithSpend.reduce((sum, a) => sum + a.revenue, 0);
  const totalPurchases = adsWithSpend.reduce((sum, a) => sum + a.purchases, 0);
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const avgCpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;

  const cards = [
    {
      icon: <Banknote className="h-4 w-4 text-blue-600" />,
      label: 'Ad Spend',
      value: formatCurrency(totalSpend),
      detail: `${adsWithSpend.length} ads con gasto`,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
    },
    {
      icon: <DollarSign className="h-4 w-4 text-green-600" />,
      label: 'Revenue',
      value: formatCurrency(totalRevenue),
      detail: '',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
    },
    {
      icon: <TrendingUp className="h-4 w-4 text-emerald-600" />,
      label: 'Blended ROAS',
      value: `${blendedRoas.toFixed(2)}x`,
      detail: 'Revenue / Ad Spend',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-700',
    },
    {
      icon: <ShoppingCart className="h-4 w-4 text-purple-600" />,
      label: 'Purchases',
      value: totalPurchases.toLocaleString(),
      detail: '',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
    },
    {
      icon: <Target className="h-4 w-4 text-orange-600" />,
      label: 'CPA Promedio',
      value: formatCurrency(avgCpa),
      detail: 'Costo por compra',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
