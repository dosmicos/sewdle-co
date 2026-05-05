import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';
import type { PaymentGatewayBreakdownRow } from '@/hooks/usePaymentGatewayBreakdown';

interface PaymentGatewayChartProps {
  rows: PaymentGatewayBreakdownRow[];
  totalOrders: number;
  totalRevenue: number;
  isLoading: boolean;
  formatCOP: (amount: number) => string;
}

const GATEWAY_PALETTE = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#ef4444', // red
  '#14b8a6', // teal
  '#a855f7', // violet
];

interface GatewayTooltipPayload {
  payload: PaymentGatewayBreakdownRow & { color: string };
}

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: GatewayTooltipPayload[];
  formatCOP: (v: number) => string;
}> = ({ active, payload, formatCOP }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: row.color }} />
        <span className="font-semibold text-gray-800">{row.label}</span>
      </div>
      <div className="text-gray-600">
        {row.orders} {row.orders === 1 ? 'orden' : 'ordenes'} · {row.orderPct.toFixed(1)}%
      </div>
      <div className="text-gray-800 font-medium mt-0.5">{formatCOP(row.revenue)}</div>
    </div>
  );
};

const GatewayBadge: React.FC<{
  label: string;
  pct: number;
  color: string;
  amount: number;
  formatCOP: (v: number) => string;
}> = ({ label, pct, color, amount, formatCOP }) => (
  <div className="flex items-center gap-2">
    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500 truncate">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{pct.toFixed(1)}%</p>
      <p className="text-[10px] text-gray-400 truncate">{formatCOP(amount)}</p>
    </div>
  </div>
);

export const PaymentGatewayChart: React.FC<PaymentGatewayChartProps> = ({
  rows,
  totalOrders,
  totalRevenue,
  isLoading,
  formatCOP,
}) => {
  const chartData = rows.map((row, idx) => ({
    ...row,
    color: GATEWAY_PALETTE[idx % GATEWAY_PALETTE.length],
  }));

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Metodos de Pago
          </h3>
        </div>

        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-xs text-gray-400">
            Cargando...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-xs text-gray-400">
            Sin ordenes en el periodo seleccionado
          </div>
        ) : (
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
                    dataKey="orderPct"
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip formatCOP={formatCOP} />}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-gray-400">Ordenes</span>
                <span className="text-sm font-bold text-gray-800">{totalOrders}</span>
              </div>
            </div>

            {/* Badges */}
            <div className="grid grid-cols-2 gap-3 flex-1">
              {chartData.map((row) => (
                <GatewayBadge
                  key={row.gateway}
                  label={row.label}
                  pct={row.orderPct}
                  color={row.color}
                  amount={row.revenue}
                  formatCOP={formatCOP}
                />
              ))}
            </div>
          </div>
        )}

        {chartData.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
            <span>Total ordenes: {totalOrders}</span>
            <span>Total ventas: {formatCOP(totalRevenue)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(PaymentGatewayChart);
