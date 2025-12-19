import React from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, PackageCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useShopifyOrderStats, DateRangeType } from '@/hooks/useShopifyOrderStats';
import { Skeleton } from '@/components/ui/skeleton';

const dateRangeOptions: { value: DateRangeType; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7days', label: 'Últimos 7 días' },
  { value: '30days', label: 'Últimos 30 días' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
];

const ShopifyOrderStatsCard: React.FC = () => {
  const { stats, loading, dateRange, setDateRange } = useShopifyOrderStats('7days');

  const efficiencyRate = stats.ordersReceived > 0 
    ? Math.round((stats.ordersPacked / stats.ordersReceived) * 100) 
    : 0;

  const getTrendIcon = () => {
    if (efficiencyRate >= 80) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (efficiencyRate >= 50) return <Minus className="w-4 h-4 text-yellow-600" />;
    return <TrendingDown className="w-4 h-4 text-red-600" />;
  };

  const getTrendColor = () => {
    if (efficiencyRate >= 80) return 'text-green-600';
    if (efficiencyRate >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold" style={{ color: 'rgb(29 29 31)' }}>
              Estadísticas de Pedidos Shopify
            </h3>
          </div>
          <Select value={dateRange} onValueChange={(value: DateRangeType) => setDateRange(value)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRangeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Orders Received */}
          <div className="p-4 bg-blue-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-600">Pedidos Entrantes</p>
                <p className="text-2xl font-bold text-blue-700">{stats.ordersReceived}</p>
              </div>
            </div>
          </div>

          {/* Orders Packed */}
          <div className="p-4 bg-green-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <PackageCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-600">Pedidos Empacados</p>
                <p className="text-2xl font-bold text-green-700">{stats.ordersPacked}</p>
              </div>
            </div>
          </div>

          {/* Efficiency Rate */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                {getTrendIcon()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Tasa de Eficiencia</p>
                <p className={`text-2xl font-bold ${getTrendColor()}`}>{efficiencyRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        {stats.dailyStats.length > 1 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="label" 
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#6b7280' }}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    color: 'rgb(29 29 31)'
                  }}
                  formatter={(value, name) => [
                    `${value} pedidos`, 
                    name === 'received' ? 'Entrantes' : 'Empacados'
                  ]}
                  labelStyle={{ color: 'rgb(99 99 102)' }}
                />
                <Legend 
                  formatter={(value) => value === 'received' ? 'Entrantes' : 'Empacados'}
                />
                <Bar 
                  dataKey="received" 
                  name="received"
                  fill="#3B82F6" 
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="packed" 
                  name="packed"
                  fill="#22C55E" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {stats.dailyStats.length <= 1 && (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>Selecciona un rango mayor para ver la tendencia</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ShopifyOrderStatsCard;
