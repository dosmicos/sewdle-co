import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  Heart,
  Share2,
  Bookmark,
  TrendingUp,
  Play,
  Music,
  Clock,
  RefreshCw,
  Loader2,
  Settings,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { useTikTokAnalytics } from '@/hooks/useTikTokAnalytics';
import { useTikTokConnection } from '@/hooks/useTikTokConnection';
import TikTokConnectionModal from './TikTokConnectionModal';

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('es-CO');
};

const COLORS = ['#00f2ea', '#ff0050', '#000000', '#69c9d0', '#ee1d52'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface TikTokDashboardProps {
  dateRange?: { from: Date; to: Date };
}

const TikTokDashboard: React.FC<TikTokDashboardProps> = ({ dateRange }) => {
  const { isConnected, syncing, syncPosts, isCheckingConnection } = useTikTokConnection();
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);

  const {
    totalVideos,
    avgViews,
    avgEngagementRate,
    bestCategory,
    totalViews,
    totalShares,
    totalSaves,
    videosByPerformance,
    contentPatterns,
    durationAnalysis,
    viralityAnalysis,
    bestPostingTimes,
    soundAnalysis,
    watchTimeFunnel,
    isLoading,
  } = useTikTokAnalytics(dateRange);

  if (isCheckingConnection) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="h-16 w-16 bg-black rounded-2xl flex items-center justify-center">
          <Play className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Conecta tu cuenta de TikTok</h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Analiza qué tipo de contenido funciona mejor, identifica patrones de viralidad
          y optimiza tu estrategia de awareness.
        </p>
        <Button
          onClick={() => setConnectionModalOpen(true)}
          className="bg-black hover:bg-gray-800 text-white"
        >
          Conectar TikTok
        </Button>
        <TikTokConnectionModal
          open={connectionModalOpen}
          onOpenChange={setConnectionModalOpen}
        />
      </div>
    );
  }

  // Posting times heatmap data (top 10 slots)
  const heatmapData = bestPostingTimes.slice(0, 10).map((slot) => ({
    name: `${DAYS[slot.day]} ${slot.hour}:00`,
    performance: Math.round(slot.avgPerformance),
    count: slot.count,
  }));

  // Watch funnel data
  const funnelData = [
    { name: 'Total', value: watchTimeFunnel.total, pct: 100 },
    { name: '25%', value: watchTimeFunnel.watched25, pct: watchTimeFunnel.total ? Math.round((watchTimeFunnel.watched25 / watchTimeFunnel.total) * 100) : 0 },
    { name: '50%', value: watchTimeFunnel.watched50, pct: watchTimeFunnel.total ? Math.round((watchTimeFunnel.watched50 / watchTimeFunnel.total) * 100) : 0 },
    { name: '75%', value: watchTimeFunnel.watched75, pct: watchTimeFunnel.total ? Math.round((watchTimeFunnel.watched75 / watchTimeFunnel.total) * 100) : 0 },
    { name: '100%', value: watchTimeFunnel.watched100, pct: watchTimeFunnel.total ? Math.round((watchTimeFunnel.watched100 / watchTimeFunnel.total) * 100) : 0 },
  ];

  // Sound pie data
  const soundPieData = [
    { name: 'Original', value: soundAnalysis.original.count },
    { name: 'Trending', value: soundAnalysis.trending.count },
  ];

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">TikTok Analytics</h2>
          <p className="text-sm text-gray-500">
            Canal de awareness — viralidad y conversión a follower
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncPosts()}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConnectionModalOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Conexión
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Play className="h-4 w-4" />
              Total Videos
            </div>
            <p className="text-2xl font-bold">{totalVideos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Eye className="h-4 w-4" />
              Promedio Views
            </div>
            <p className="text-2xl font-bold">{formatNumber(avgViews)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <TrendingUp className="h-4 w-4" />
              Avg Engagement
            </div>
            <p className="text-2xl font-bold">{avgEngagementRate.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <BarChart3 className="h-4 w-4" />
              Best Category
            </div>
            <p className="text-2xl font-bold capitalize">{bestCategory}</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Eye className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-gray-500">Total Views</p>
              <p className="text-lg font-bold">{formatNumber(totalViews)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Share2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-gray-500">Total Shares</p>
              <p className="text-lg font-bold">{formatNumber(totalShares)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Bookmark className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-xs text-gray-500">Total Saves</p>
              <p className="text-lg font-bold">{formatNumber(totalSaves)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Duration + Watch Time Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Performance por Duración
            </CardTitle>
          </CardHeader>
          <CardContent>
            {durationAnalysis.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={durationAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'avgViews' ? formatNumber(value) : `${value.toFixed(1)}%`,
                      name === 'avgViews' ? 'Avg Views' : name === 'avgWatchRate' ? 'Watch Rate' : 'Engagement',
                    ]}
                  />
                  <Bar dataKey="avgViews" name="avgViews" fill="#00f2ea" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 text-center py-10">Sin datos de duración</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Watch Time Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {watchTimeFunnel.total > 0 ? (
              <div className="space-y-3 pt-2">
                {funnelData.map((item, i) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.name === 'Total' ? 'Total Videos' : `Vio ${item.name}`}
                      </span>
                      <span className="font-medium">
                        {item.value} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${item.pct}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-10">Sin datos de watch time</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Videos Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Top Videos por Performance Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          {videosByPerformance.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videosByPerformance.slice(0, 6).map((video, i) => (
                <div
                  key={video.id}
                  className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="relative bg-gray-100 aspect-video flex items-center justify-center">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.caption}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Play className="h-10 w-10 text-gray-300" />
                    )}
                    <Badge className="absolute top-2 left-2 bg-black/70 text-white text-xs">
                      #{i + 1}
                    </Badge>
                    {video.durationSeconds > 0 && (
                      <Badge className="absolute bottom-2 right-2 bg-black/70 text-white text-xs">
                        {Math.round(video.durationSeconds)}s
                      </Badge>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-sm text-gray-800 line-clamp-2">
                      {video.caption || 'Sin caption'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {formatNumber(video.views)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {formatNumber(video.likes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="h-3 w-3" />
                        {formatNumber(video.shares)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bookmark className="h-3 w-3" />
                        {formatNumber(video.saves)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="text-xs capitalize"
                      >
                        {video.contentCategory}
                      </Badge>
                      <span className="text-xs font-bold text-emerald-600">
                        Score: {video.performanceScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">
              {isLoading ? 'Cargando videos...' : 'No hay videos sincronizados'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sound Analysis + Best Posting Times */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Music className="h-4 w-4" />
              Sound Analysis: Original vs Trending
            </CardTitle>
          </CardHeader>
          <CardContent>
            {soundAnalysis.original.count + soundAnalysis.trending.count > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={soundPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {soundPieData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#000000' : '#00f2ea'} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Original Sound</p>
                    <p className="font-bold">{formatNumber(soundAnalysis.original.avgViews)} avg views</p>
                    <p className="text-xs text-gray-500">{soundAnalysis.original.count} videos</p>
                  </div>
                  <div className="bg-cyan-50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Trending Sound</p>
                    <p className="font-bold">{formatNumber(soundAnalysis.trending.avgViews)} avg views</p>
                    <p className="text-xs text-gray-500">{soundAnalysis.trending.count} videos</p>
                  </div>
                </div>
                {soundAnalysis.topSounds.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Top Sounds</p>
                    <div className="space-y-1">
                      {soundAnalysis.topSounds.slice(0, 5).map((s) => (
                        <div key={s.name} className="flex items-center justify-between text-sm">
                          <span className="truncate max-w-[60%] text-gray-700">{s.name}</span>
                          <span className="text-gray-500 text-xs">{formatNumber(s.avgViews)} avg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-10">Sin datos de sonidos</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Mejores Horarios para Publicar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {heatmapData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={heatmapData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={80} />
                  <Tooltip
                    formatter={(value: number) => [`Score: ${value}`, 'Performance']}
                  />
                  <Bar dataKey="performance" fill="#ff0050" radius={[0, 4, 4, 0]}>
                    {heatmapData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 text-center py-10">Sin datos de horarios</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content Patterns */}
      {contentPatterns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Content Patterns por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Categoría</th>
                    <th className="pb-2 font-medium text-right">Videos</th>
                    <th className="pb-2 font-medium text-right">Avg Views</th>
                    <th className="pb-2 font-medium text-right">Avg Engagement</th>
                    <th className="pb-2 font-medium text-right">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {contentPatterns.map((pattern) => (
                    <tr key={pattern.category} className="border-b last:border-0">
                      <td className="py-2 capitalize font-medium">{pattern.category}</td>
                      <td className="py-2 text-right text-gray-600">{pattern.count}</td>
                      <td className="py-2 text-right text-gray-600">{formatNumber(pattern.avgViews)}</td>
                      <td className="py-2 text-right text-gray-600">{pattern.avgEngagement.toFixed(2)}%</td>
                      <td className="py-2 text-right">
                        <Badge
                          variant="outline"
                          className={
                            pattern.avgPerformance >= 50
                              ? 'border-green-300 text-green-700 bg-green-50'
                              : pattern.avgPerformance >= 25
                              ? 'border-yellow-300 text-yellow-700 bg-yellow-50'
                              : 'border-gray-300 text-gray-600'
                          }
                        >
                          {pattern.avgPerformance.toFixed(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Virality Insight */}
      <Card className="border-l-4 border-l-pink-500">
        <CardContent className="pt-4 pb-3">
          <p className="text-sm font-medium text-gray-900 mb-1">
            Insight: Viralidad
          </p>
          <p className="text-sm text-gray-600">
            Share Rate promedio: <strong>{(viralityAnalysis.avgShareRate * 100).toFixed(3)}%</strong>
            {' · '}
            View-to-Like Ratio: <strong>{(viralityAnalysis.avgViewToLikeRatio * 100).toFixed(2)}%</strong>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            TikTok es canal de AWARENESS — mide shares (viralidad) y profile visits (conversión a follower)
          </p>
        </CardContent>
      </Card>

      <TikTokConnectionModal
        open={connectionModalOpen}
        onOpenChange={setConnectionModalOpen}
      />
    </div>
  );
};

export default TikTokDashboard;
