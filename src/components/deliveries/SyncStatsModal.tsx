import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Zap, Package, Clock, TrendingUp, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useSyncStats } from '@/hooks/useSyncStats';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface SyncStatsModalProps {
  open: boolean;
  onClose: () => void;
}

const COLORS = {
  items: '#22c55e',
  errors: '#ef4444',
  thisMonth: '#6366f1',
  prevMonth: '#94a3b8',
};

// Custom tooltip style for all charts
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-md shadow-md p-2 text-xs space-y-1">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export const SyncStatsModal: React.FC<SyncStatsModalProps> = ({ open, onClose }) => {
  const { todayStats, hourlyData, dailyData, monthComparison, avgItemsPerDay, syncedOrders, loading } = useSyncStats();

  const [activeTab, setActiveTab] = useState('today');
  const [ordersFilter, setOrdersFilter] = useState<'today' | 'all'>('all');

  const now = new Date();
  const todayIso = format(now, 'yyyy-MM-dd');
  const thisMonthLabel = format(now, 'MMMM', { locale: es });
  const prevMonthLabel = format(subMonths(now, 1), 'MMMM', { locale: es });

  // Only render hours 5-22 for the hourly chart (less empty space)
  const hourlyFiltered = hourlyData.filter(h => h.hour >= 5 && h.hour <= 22);

  // Filter monthly data to days that have some data in either series
  const monthData = monthComparison.filter(d => d.day <= 31);

  // Orders filtered by today or all
  const ordersToShow = ordersFilter === 'today'
    ? syncedOrders.filter(o => o.syncedAt.startsWith(todayIso))
    : syncedOrders;

  const goToOrders = (filter: 'today' | 'all') => {
    setOrdersFilter(filter);
    setActiveTab('orders');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-500" />
            Estadísticas de Sincronización Shopify
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card
                className="cursor-pointer hover:bg-muted/50 transition-colors group"
                onClick={() => goToOrders('today')}
              >
                <CardContent className="p-3 flex items-center gap-2">
                  <Zap className="h-7 w-7 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold">{todayStats.itemsToday}</p>
                    <p className="text-xs text-muted-foreground leading-tight">artículos hoy</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:bg-muted/50 transition-colors group"
                onClick={() => goToOrders('today')}
              >
                <CardContent className="p-3 flex items-center gap-2">
                  <Package className="h-7 w-7 text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold">{todayStats.ordersToday}</p>
                    <p className="text-xs text-muted-foreground leading-tight">
                      {todayStats.ordersToday === 1 ? 'orden hoy' : 'órdenes hoy'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 flex items-center gap-2">
                  <Clock className="h-7 w-7 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">
                      {todayStats.avgMinsBetweenSyncs != null ? `~${todayStats.avgMinsBetweenSyncs}` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground leading-tight">min entre syncs</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 flex items-center gap-2">
                  <TrendingUp className="h-7 w-7 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{avgItemsPerDay}</p>
                    <p className="text-xs text-muted-foreground leading-tight">art. prom/día (L–S)</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs with charts */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="today" className="flex-1">Hoy</TabsTrigger>
                <TabsTrigger value="30days" className="flex-1">Últimos 30 días</TabsTrigger>
                <TabsTrigger value="compare" className="flex-1">Comparar meses</TabsTrigger>
                <TabsTrigger value="orders" className="flex-1">Órdenes</TabsTrigger>
              </TabsList>

              {/* ── Tab Hoy ──────────────────────────────────────────────── */}
              <TabsContent value="today" className="mt-4 space-y-3">
                {todayStats.itemsToday === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Zap className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">No hay sincronizaciones registradas hoy</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Artículos sincronizados por hora — hoy
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={hourlyFiltered} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="items" name="Artículos" fill={COLORS.items} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="errors" name="Errores" fill={COLORS.errors} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-center text-muted-foreground">
                      {todayStats.syncsToday} operaciones de sync · {todayStats.errorsToday} errores
                    </p>
                  </>
                )}
              </TabsContent>

              {/* ── Tab 30 días ──────────────────────────────────────────── */}
              <TabsContent value="30days" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Artículos sincronizados por día — últimos 30 días
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      interval={4}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="items" name="Artículos" fill={COLORS.items} radius={[3, 3, 0, 0]} stackId="a" />
                    <Bar dataKey="errors" name="Errores" fill={COLORS.errors} radius={[3, 3, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
                {/* Tiny per-day table for recent days with orders info */}
                {dailyData.some(d => d.orders > 0) && (
                  <div className="text-xs text-muted-foreground text-center">
                    Promedio días con actividad: <span className="font-semibold text-foreground">{avgItemsPerDay} artículos/día</span>
                  </div>
                )}
              </TabsContent>

              {/* ── Tab Comparar meses ────────────────────────────────── */}
              <TabsContent value="compare" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Artículos sincronizados por día del mes —{' '}
                  <span className="capitalize">{thisMonthLabel}</span> vs{' '}
                  <span className="capitalize">{prevMonthLabel}</span>
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={monthData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="thisMonth"
                      name={thisMonthLabel.charAt(0).toUpperCase() + thisMonthLabel.slice(1)}
                      stroke={COLORS.thisMonth}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="prevMonth"
                      name={prevMonthLabel.charAt(0).toUpperCase() + prevMonthLabel.slice(1)}
                      stroke={COLORS.prevMonth}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>

              {/* ── Tab Órdenes ──────────────────────────────────────── */}
              <TabsContent value="orders" className="mt-4 space-y-3">
                {/* Filter toggle */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {ordersToShow.length} {ordersToShow.length === 1 ? 'operación' : 'operaciones'} de sync
                    {ordersFilter === 'today' ? ' — hoy' : ' — últimos 30 días'}
                  </p>
                  <div className="flex gap-1 p-0.5 bg-muted rounded-md">
                    <Button
                      size="sm"
                      variant={ordersFilter === 'today' ? 'default' : 'ghost'}
                      className="h-6 px-2 text-xs"
                      onClick={() => setOrdersFilter('today')}
                    >
                      Hoy
                    </Button>
                    <Button
                      size="sm"
                      variant={ordersFilter === 'all' ? 'default' : 'ghost'}
                      className="h-6 px-2 text-xs"
                      onClick={() => setOrdersFilter('all')}
                    >
                      30 días
                    </Button>
                  </div>
                </div>

                {ordersToShow.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-md">
                    <Package className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">
                      {ordersFilter === 'today'
                        ? 'No hay sincronizaciones registradas hoy'
                        : 'No hay órdenes sincronizadas en los últimos 30 días'}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px] rounded-md border">
                    <div className="divide-y">
                      {ordersToShow.map((order, idx) => (
                        <div key={`${order.deliveryId}-${order.syncedAt}-${idx}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                          {/* Date */}
                          <span className="text-xs text-muted-foreground font-mono w-28 shrink-0">
                            {order.dateLabel}
                          </span>
                          {/* Order / tracking info */}
                          <div className="flex-1 min-w-0">
                            {order.orderNumber ? (
                              <p className="text-xs font-semibold truncate">#{order.orderNumber}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground truncate">{order.deliveryId}</p>
                            )}
                            {order.trackingNumber && (
                              <p className="text-xs text-muted-foreground font-mono truncate">{order.trackingNumber}</p>
                            )}
                          </div>
                          {/* Items synced */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold text-green-600">
                              +{order.itemsSynced}
                            </span>
                            {order.errors > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-red-500">
                                <AlertCircle className="h-3 w-3" />
                                {order.errors}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
