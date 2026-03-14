import React, { useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  TrendingUp,
  Target,
  Palette,
  Video,
  CalendarDays,
  MessageSquare,
  ShoppingCart,
  Mail,
  MousePointerClick,
  Eye,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyActivity, ActivitySummary } from '@/hooks/useMarketingActivity';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ActivityRevenueChartProps {
  dailyData: DailyActivity[];
  summary: ActivitySummary;
  isLoading: boolean;
}

const formatCOP = (value: number) =>
  `COP ${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value))}`;

const formatCompact = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
};

// Activity channel configs
const CHANNELS = [
  {
    key: 'activeAds' as const,
    label: 'Ads activos',
    color: '#3b82f6',
    icon: <Target className="h-3.5 w-3.5" />,
  },
  {
    key: 'newCreatives' as const,
    label: 'Creativos nuevos',
    color: '#8b5cf6',
    icon: <Palette className="h-3.5 w-3.5" />,
  },
  {
    key: 'ugcVideos' as const,
    label: 'Videos UGC',
    color: '#ec4899',
    icon: <Video className="h-3.5 w-3.5" />,
  },
  {
    key: 'marketingEvents' as const,
    label: 'Eventos mkt',
    color: '#f59e0b',
    icon: <CalendarDays className="h-3.5 w-3.5" />,
  },
  {
    key: 'emailCampaigns' as const,
    label: 'Email campaigns',
    color: '#ef4444',
    icon: <Mail className="h-3.5 w-3.5" />,
  },
  {
    key: 'messagesSent' as const,
    label: 'Mensajes',
    color: '#10b981',
    icon: <MessageSquare className="h-3.5 w-3.5" />,
  },
];

const SUMMARY_KEYS: {
  key: keyof ActivitySummary;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    key: 'totalOrders',
    label: 'Órdenes',
    icon: <ShoppingCart className="h-4 w-4" />,
    color: 'text-blue-600 bg-blue-50',
  },
  {
    key: 'totalActiveAds',
    label: 'Ads activos',
    icon: <Target className="h-4 w-4" />,
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    key: 'totalNewCreatives',
    label: 'Creativos nuevos',
    icon: <Palette className="h-4 w-4" />,
    color: 'text-purple-600 bg-purple-50',
  },
  {
    key: 'totalUgcVideos',
    label: 'Videos UGC',
    icon: <Video className="h-4 w-4" />,
    color: 'text-pink-600 bg-pink-50',
  },
  {
    key: 'totalEmailCampaigns',
    label: 'Emails enviados',
    icon: <Mail className="h-4 w-4" />,
    color: 'text-red-600 bg-red-50',
  },
  {
    key: 'totalMarketingEvents',
    label: 'Eventos',
    icon: <CalendarDays className="h-4 w-4" />,
    color: 'text-amber-600 bg-amber-50',
  },
  {
    key: 'totalMessagesSent',
    label: 'Mensajes',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-emerald-600 bg-emerald-50',
  },
];

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const dateStr = label
    ? format(new Date(label + 'T12:00:00'), "d 'de' MMM", { locale: es })
    : '';

  // Find revenue entry
  const revEntry = payload.find((p: any) => p.dataKey === 'revenue');
  const ordersEntry = payload.find((p: any) => p.dataKey === 'orders');

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm max-w-[220px]">
      <p className="font-semibold text-gray-700 mb-1.5">{dateStr}</p>
      {revEntry && (
        <div className="flex justify-between gap-4 mb-1">
          <span className="text-gray-500">Revenue</span>
          <span className="font-medium">{formatCOP(revEntry.value)}</span>
        </div>
      )}
      {ordersEntry && ordersEntry.value > 0 && (
        <div className="flex justify-between gap-4 mb-1.5">
          <span className="text-gray-500">Órdenes</span>
          <span className="font-medium">{ordersEntry.value}</span>
        </div>
      )}
      <div className="border-t border-gray-100 pt-1.5 space-y-0.5">
        {payload
          .filter(
            (p: any) => p.dataKey !== 'revenue' && p.dataKey !== 'orders' && p.value > 0
          )
          .map((p: any) => {
            const ch = CHANNELS.find((c) => c.key === p.dataKey);
            return (
              <div key={p.dataKey} className="flex justify-between gap-4">
                <span className="text-gray-500">{ch?.label || p.dataKey}</span>
                <span className="font-medium" style={{ color: p.color }}>
                  {p.value}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
};

const ActivityRevenueChart: React.FC<ActivityRevenueChartProps> = ({
  dailyData,
  summary,
  isLoading,
}) => {
  const [visibleChannels, setVisibleChannels] = useState<Set<string>>(
    new Set(CHANNELS.map((c) => c.key))
  );

  const toggleChannel = (key: string) => {
    setVisibleChannels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Correlation strength label
  const corrLabel = (corr: number) => {
    const abs = Math.abs(corr);
    if (abs >= 0.78) return { text: 'Fuerte', color: 'bg-green-100 text-green-700' };
    if (abs >= 0.5) return { text: 'Moderada', color: 'bg-yellow-100 text-yellow-700' };
    if (abs >= 0.3) return { text: 'Débil', color: 'bg-orange-100 text-orange-700' };
    return { text: 'Sin correlación', color: 'bg-gray-100 text-gray-600' };
  };

  const corr = corrLabel(summary.correlation);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-400">
          Cargando actividad de marketing...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {SUMMARY_KEYS.map((item) => {
          const value = summary[item.key] as number;
          return (
            <div
              key={item.key}
              className="border rounded-lg p-2.5 flex flex-col items-center gap-1"
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  item.color
                )}
              >
                {item.icon}
              </div>
              <span className="text-lg font-bold">{value}</span>
              <span className="text-[10px] text-gray-500 text-center leading-tight">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base">
                Actividad vs Revenue
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Correlación:</span>
              <Badge
                variant="secondary"
                className={cn('text-xs', corr.color)}
              >
                {summary.correlation >= 0 ? '+' : ''}
                {(summary.correlation * 100).toFixed(0)}% — {corr.text}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Taylor Holiday: &quot;Registra cada acción para entender qué acciones
            crean qué resultados. La correlación &gt;0.78 indica fuerte relación.&quot;
          </p>
        </CardHeader>
        <CardContent>
          {/* Channel toggles */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {CHANNELS.map((ch) => {
              const active = visibleChannels.has(ch.key);
              return (
                <button
                  key={ch.key}
                  onClick={() => toggleChannel(ch.key)}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all',
                    active
                      ? 'border-current opacity-100'
                      : 'border-gray-200 opacity-40'
                  )}
                  style={{ color: ch.color }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ch.color }}
                  />
                  {ch.label}
                </button>
              );
            })}
          </div>

          {/* Chart */}
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dailyData}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) =>
                    format(new Date(v + 'T12:00:00'), 'd', { locale: es })
                  }
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                {/* Left: Revenue */}
                <YAxis
                  yAxisId="revenue"
                  orientation="left"
                  tickFormatter={formatCompact}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  width={55}
                />
                {/* Right: Activity count */}
                <YAxis
                  yAxisId="activity"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Activity bars (stacked) */}
                {CHANNELS.map((ch) =>
                  visibleChannels.has(ch.key) ? (
                    <Bar
                      key={ch.key}
                      yAxisId="activity"
                      dataKey={ch.key}
                      stackId="activity"
                      fill={ch.color}
                      fillOpacity={0.7}
                      barSize={16}
                      radius={
                        ch.key === CHANNELS[CHANNELS.length - 1].key
                          ? [2, 2, 0, 0]
                          : undefined
                      }
                    />
                  ) : null
                )}

                {/* Revenue line */}
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#111827"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#111827' }}
                />

                {/* Hidden orders dataKey for tooltip */}
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="orders"
                  stroke="transparent"
                  dot={false}
                  activeDot={false}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Insight */}
          {summary.correlation >= 0.5 && (
            <div className="mt-3 p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              <TrendingUp className="h-3.5 w-3.5 inline mr-1" />
              Los días con más acciones de marketing correlacionan con más revenue.
              Señal para escalar actividad.
            </div>
          )}
          {summary.correlation < 0.3 && summary.correlation > -0.3 && summary.totalActions > 10 && (
            <div className="mt-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
              <Activity className="h-3.5 w-3.5 inline mr-1" />
              Baja correlación entre actividad y revenue. Revisa si las acciones
              están generando impacto real o necesitas cambiar de estrategia (stories, no iteración).
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Campaign Details */}
      {summary.emailCampaignDetails.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-red-500" />
              <CardTitle className="text-base">
                Email Campaigns — Emailmark
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">
                      Fecha
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">
                      Campaña
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">
                      <div className="flex items-center justify-end gap-1">
                        <Send className="h-3 w-3" /> Enviados
                      </div>
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">
                      <div className="flex items-center justify-end gap-1">
                        <Eye className="h-3 w-3" /> Abiertos
                      </div>
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-20">
                      Open %
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">
                      <div className="flex items-center justify-end gap-1">
                        <MousePointerClick className="h-3 w-3" /> Clicks
                      </div>
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-20">
                      CTR
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.emailCampaignDetails
                    .sort(
                      (a, b) =>
                        new Date(a.date).getTime() -
                        new Date(b.date).getTime()
                    )
                    .map((campaign, idx) => {
                      const openRate =
                        campaign.totalSent > 0
                          ? (campaign.totalOpened / campaign.totalSent) * 100
                          : 0;
                      const ctr =
                        campaign.totalSent > 0
                          ? (campaign.totalClicked / campaign.totalSent) * 100
                          : 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500 text-xs">
                            {format(
                              new Date(campaign.date + 'T12:00:00'),
                              'd MMM',
                              { locale: es }
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-sm truncate max-w-[250px]">
                              {campaign.name}
                            </div>
                            <div className="text-xs text-gray-400 truncate max-w-[250px]">
                              {campaign.subject}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {campaign.totalSent.toLocaleString('es-CO')}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {campaign.totalOpened.toLocaleString('es-CO')}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] px-1.5 tabular-nums',
                                openRate >= 20
                                  ? 'bg-green-100 text-green-700'
                                  : openRate >= 10
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-700'
                              )}
                            >
                              {openRate.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {campaign.totalClicked.toLocaleString('es-CO')}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] px-1.5 tabular-nums',
                                ctr >= 3
                                  ? 'bg-green-100 text-green-700'
                                  : ctr >= 1
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-700'
                              )}
                            >
                              {ctr.toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Email totals */}
            <div className="mt-3 flex gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Total enviados</p>
                  <p className="font-semibold text-sm">
                    {summary.totalEmailsSent.toLocaleString('es-CO')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Total abiertos</p>
                  <p className="font-semibold text-sm">
                    {summary.totalEmailOpened.toLocaleString('es-CO')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Total clicks</p>
                  <p className="font-semibold text-sm">
                    {summary.totalEmailClicked.toLocaleString('es-CO')}
                  </p>
                </div>
              </div>
              {summary.totalEmailsSent > 0 && (
                <>
                  <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                    <div>
                      <p className="text-xs text-gray-500">Open rate</p>
                      <p className="font-semibold text-sm">
                        {(
                          (summary.totalEmailOpened / summary.totalEmailsSent) *
                          100
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-xs text-gray-500">CTR</p>
                      <p className="font-semibold text-sm">
                        {(
                          (summary.totalEmailClicked /
                            summary.totalEmailsSent) *
                          100
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ActivityRevenueChart;
