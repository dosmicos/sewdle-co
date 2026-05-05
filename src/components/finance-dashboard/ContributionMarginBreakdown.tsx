import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SemaphoreBadge } from './SemaphoreBadge';
import type { ContributionMarginData, Semaphore } from '@/hooks/useContributionMargin';

interface ContributionMarginBreakdownProps {
  data: ContributionMarginData;
  targetPercents?: {
    cogs: number;
    shipping: number;
    gateway: number;
    handling: number;
    adSpend: number;
  };
  formatCOP: (amount: number) => string;
}

interface RowData {
  label: string;
  value: number;
  pctOfNetSales: number;
  targetPct?: number;
  isSubtract?: boolean;
  isTotal?: boolean;
  semaphore?: Semaphore;
}

function getRowSemaphore(actual: number, target: number | undefined, isSubtract: boolean): Semaphore | undefined {
  if (target === undefined) return undefined;
  if (isSubtract) {
    // For costs: below target = green, near = yellow, above = red
    if (actual <= target) return 'green';
    if (actual <= target + 3) return 'yellow';
    return 'red';
  }
  // For CM: above = green
  if (actual >= target) return 'green';
  if (actual >= target - 5) return 'yellow';
  return 'red';
}

export const ContributionMarginBreakdown: React.FC<ContributionMarginBreakdownProps> = ({
  data,
  targetPercents,
  formatCOP,
}) => {
  const [expanded, setExpanded] = useState(false);

  const cogsTarget = targetPercents?.cogs;
  const shippingTarget = targetPercents?.shipping;
  const gatewayTarget = targetPercents?.gateway;
  const handlingTarget = targetPercents?.handling;
  const adTarget = targetPercents?.adSpend;

  const rows: RowData[] = [
    {
      label: 'Gross Revenue',
      value: data.grossRevenue,
      pctOfNetSales: data.netSales > 0 ? (data.grossRevenue / data.netSales) * 100 : 0,
    },
    {
      label: '− Returns Accrual',
      value: data.returnsAccrual,
      pctOfNetSales: data.netSales > 0 ? (data.returnsAccrual / data.netSales) * 100 : 0,
      isSubtract: true,
    },
    {
      label: 'Net Sales',
      value: data.netSales,
      pctOfNetSales: 100,
      isTotal: true,
    },
    {
      label: '− Product Cost (COGS)',
      value: data.productCost,
      pctOfNetSales: data.netSales > 0 ? (data.productCost / data.netSales) * 100 : 0,
      isSubtract: true,
      targetPct: cogsTarget,
      semaphore: getRowSemaphore(data.netSales > 0 ? (data.productCost / data.netSales) * 100 : 0, cogsTarget, true),
    },
    {
      label: '− Shipping Cost',
      value: data.shippingCost,
      pctOfNetSales: data.netSales > 0 ? (data.shippingCost / data.netSales) * 100 : 0,
      isSubtract: true,
      targetPct: shippingTarget,
      semaphore: getRowSemaphore(data.netSales > 0 ? (data.shippingCost / data.netSales) * 100 : 0, shippingTarget, true),
    },
    {
      label: '− Payment Gateway',
      value: data.paymentGatewayFees,
      pctOfNetSales: data.netSales > 0 ? (data.paymentGatewayFees / data.netSales) * 100 : 0,
      isSubtract: true,
      targetPct: gatewayTarget,
      semaphore: getRowSemaphore(data.netSales > 0 ? (data.paymentGatewayFees / data.netSales) * 100 : 0, gatewayTarget, true),
    },
    {
      label: '− Handling',
      value: data.handlingCost,
      pctOfNetSales: data.netSales > 0 ? (data.handlingCost / data.netSales) * 100 : 0,
      isSubtract: true,
      targetPct: handlingTarget,
      semaphore: getRowSemaphore(data.netSales > 0 ? (data.handlingCost / data.netSales) * 100 : 0, handlingTarget, true),
    },
    {
      label: '− Ad Spend',
      value: data.adSpend,
      pctOfNetSales: data.cacPct,
      isSubtract: true,
      targetPct: adTarget,
      semaphore: getRowSemaphore(data.cacPct, adTarget, true),
    },
    {
      label: 'Contribution Margin',
      value: data.contributionMargin,
      pctOfNetSales: data.cmPercent,
      isTotal: true,
      semaphore: data.semaphore,
    },
  ];

  return (
    <Card className="border border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">P&L Breakdown</span>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <CardContent className="px-5 pb-4 pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 font-medium text-gray-500 text-xs uppercase">Component</th>
                <th className="text-right py-2 font-medium text-gray-500 text-xs uppercase">COP</th>
                <th className="text-right py-2 font-medium text-gray-500 text-xs uppercase">% Net Sales</th>
                <th className="text-right py-2 font-medium text-gray-500 text-xs uppercase">Target %</th>
                <th className="text-center py-2 font-medium text-gray-500 text-xs uppercase w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`${row.isTotal ? 'border-t border-gray-200 font-semibold' : ''} ${row.isSubtract && !row.isTotal ? 'text-gray-600' : ''}`}
                >
                  <td className="py-1.5">{row.label}</td>
                  <td className={`text-right py-1.5 ${row.isSubtract ? 'text-red-500' : ''}`}>
                    {row.isSubtract ? `−${formatCOP(row.value)}` : formatCOP(row.value)}
                  </td>
                  <td className="text-right py-1.5">{row.pctOfNetSales.toFixed(1)}%</td>
                  <td className="text-right py-1.5 text-gray-400">
                    {row.targetPct !== undefined ? `${row.targetPct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="text-center py-1.5">
                    {row.semaphore && <SemaphoreBadge status={row.semaphore} size="sm" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      )}
    </Card>
  );
};

export default ContributionMarginBreakdown;
