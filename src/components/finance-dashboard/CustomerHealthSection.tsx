import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react';
import type { CustomerHealthData } from '@/hooks/useCustomerHealth';

interface CustomerHealthSectionProps {
  data: CustomerHealthData;
  isLoading: boolean;
  formatCOP: (amount: number) => string;
}

const TrendIcon: React.FC<{ trend: 'growing' | 'shrinking' | 'stable' }> = ({ trend }) => {
  if (trend === 'growing') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (trend === 'shrinking') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
};

const MiniMetric: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div>
    <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
    <p className="text-base font-semibold text-gray-800">{value}</p>
    {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
  </div>
);

export const CustomerHealthSection: React.FC<CustomerHealthSectionProps> = ({
  data,
  isLoading,
  formatCOP,
}) => {
  const layerCakeData = data.monthlyLayers.map(l => ({
    month: l.month.substring(5), // "MM"
    new: l.newRevenue,
    returning: l.returningRevenue,
  }));

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-40 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
        Customer Health
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Revenue Layer Cake */}
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-gray-700 mb-3">Revenue Layer Cake</p>
            <div className="h-56">
              {layerCakeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={layerCakeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCOP(value),
                        name === 'returning' ? 'Returning' : 'New',
                      ]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="returning"
                      stackId="1"
                      fill="#22c55e"
                      fillOpacity={0.6}
                      stroke="#16a34a"
                      name="Returning"
                    />
                    <Area
                      type="monotone"
                      dataKey="new"
                      stackId="1"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                      stroke="#2563eb"
                      name="New"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">
                  Sin datos suficientes
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Customer Metrics Grid */}
        <div className="space-y-4">
          {/* Active File */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-medium text-gray-700">Active Customer File</p>
                </div>
                <TrendIcon trend={data.activeFileTrend} />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-gray-900">
                  {data.activeCustomers.toLocaleString()}
                </span>
                <span className={`text-sm font-medium ${data.activeFileChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {data.activeFileChange >= 0 ? '+' : ''}{data.activeFileChange.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-400">vs 30d ago</span>
              </div>
            </CardContent>
          </Card>

          {/* NC Metrics */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                New Customer Acquisition
              </p>
              <div className="grid grid-cols-2 gap-4">
                <MiniMetric
                  label="NC Revenue"
                  value={formatCOP(data.newCustomerRevenue)}
                  sub={`${data.newCustomerPct.toFixed(0)}% of total`}
                />
                <MiniMetric
                  label="NCPA"
                  value={formatCOP(data.ncpa)}
                  sub="Cost per new customer"
                />
                <MiniMetric
                  label="AMER / NC-ROAS"
                  value={data.amer.toFixed(2)}
                  sub="NC Revenue / Ad Spend"
                />
                <MiniMetric
                  label="New Customers"
                  value={data.newCustomerCount.toLocaleString()}
                />
              </div>
            </CardContent>
          </Card>

          {/* Returning Metrics */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Returning Customers
              </p>
              <div className="grid grid-cols-2 gap-4">
                <MiniMetric
                  label="Returning Revenue"
                  value={formatCOP(data.returningCustomerRevenue)}
                  sub={`${data.returningCustomerPct.toFixed(0)}% of total`}
                />
                <MiniMetric
                  label="Returning Orders"
                  value={data.returningCustomerCount.toLocaleString()}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CustomerHealthSection);
