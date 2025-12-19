import React from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, PackageCheck, TrendingUp, TrendingDown, Minus, Clock, Zap, Timer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell } from 'recharts';
import { useShopifyOrderStats, DateRangeType } from '@/hooks/useShopifyOrderStats';
import { Skeleton } from '@/components/ui/skeleton';

const dateRangeOptions: { value: DateRangeType; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7days', label: 'Últimos 7 días' },
  { value: '30days', label: 'Últimos 30 días' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
];

const formatTime = (seconds: number | null): string => {
  if (seconds === null) return '--';
  if (seconds < 60) return `${seconds} seg`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes} min ${remainingSeconds} seg` : `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
};

const ShopifyOrderStatsCard: React.FC = () => {
  const { stats, loading, dateRange, setDateRange } = useShopifyOrderStats('today');

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

  // Find the most productive hour
  const mostProductiveHour = stats.hourlyStats.reduce(
    (max, current) => (current.packed > max.packed ? current : max),
    { hour: 0, label: '00:00', packed: 0 }
  );

  // Filter hourly stats to only show hours with activity (or business hours 8-20)
  const filteredHourlyStats = stats.hourlyStats.filter(
    h => h.packed > 0 || (h.hour >= 8 && h.hour <= 20)
  );

  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Orders Received */}
          <div className="p-4 bg-blue-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-600">Entrantes</p>
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
                <p className="text-sm font-medium text-green-600">Empacados</p>
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
                <p className="text-sm font-medium text-gray-600">Eficiencia</p>
                <p className={`text-2xl font-bold ${getTrendColor()}`}>{efficiencyRate}%</p>
              </div>
            </div>
          </div>

          {/* Packing Velocity */}
          <div className="p-4 bg-purple-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-600">Velocidad</p>
                <p className="text-2xl font-bold text-purple-700">{stats.productivity.packingVelocity}/hr</p>
              </div>
            </div>
          </div>
        </div>

        {/* Productivity Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Average Time Between Packing */}
          <div className="p-4 bg-orange-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-600">Tiempo promedio entre empaques</p>
                <p className="text-xl font-bold text-orange-700">
                  {formatTime(stats.productivity.avgTimeBetweenPacking)}
                </p>
              </div>
            </div>
          </div>

          {/* Fastest Packing */}
          <div className="p-4 bg-emerald-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Timer className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-600">Empaque más rápido</p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatTime(stats.productivity.fastestPacking)}
                </p>
              </div>
            </div>
          </div>

          {/* Slowest Packing */}
          <div className="p-4 bg-rose-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-lg">
                <Timer className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-rose-600">Empaque más lento</p>
                <p className="text-xl font-bold text-rose-700">
                  {formatTime(stats.productivity.slowestPacking)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Chart */}
        {filteredHourlyStats.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Pedidos Empacados por Hora</h4>
              {mostProductiveHour.packed > 0 && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  Hora más productiva: {mostProductiveHour.label} ({mostProductiveHour.packed} pedidos)
                </span>
              )}
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredHourlyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="label" 
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    fontSize={11}
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
                    formatter={(value) => [`${value} pedidos`, 'Empacados']}
                    labelStyle={{ color: 'rgb(99 99 102)' }}
                  />
                  <Bar dataKey="packed" radius={[4, 4, 0, 0]}>
                    {filteredHourlyStats.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.hour === mostProductiveHour.hour && entry.packed > 0 ? '#9333EA' : '#A855F7'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Daily Chart */}
        {stats.dailyStats.length > 1 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Tendencia Diaria</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="label" 
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    fontSize={11}
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
          </div>
        )}

        {stats.ordersPacked === 0 && (
          <div className="text-center py-6 text-gray-500">
            <Package className="w-10 h-10 mx-auto mb-2 text-gray-400" />
            <p>No hay pedidos empacados en este período</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ShopifyOrderStatsCard;
