import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RefreshCw, BarChart3, TrendingUp, Bookmark, Eye, FileText, CalendarIcon, Instagram, AlertCircle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMetaSocialAnalytics } from '@/hooks/useMetaSocialAnalytics';
import ContentTypeAnalysis from '@/components/social-analytics/ContentTypeAnalysis';
import PostPerformanceTable from '@/components/social-analytics/PostPerformanceTable';
import EngagementPatterns from '@/components/social-analytics/EngagementPatterns';
import TikTokDashboard from '@/components/social-analytics/TikTokDashboard';
import FinanceSidebar from '@/components/finance-dashboard/FinanceSidebar';
import FinanceDatePicker from '@/components/finance-dashboard/FinanceDatePicker';
import { useFinanceDateRange } from '@/hooks/useFinanceDateRange';

type PlatformFilter = 'all' | 'instagram' | 'facebook';

const SocialAnalyticsPage: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { dateRange, setDateRange, preset, setPreset } = useFinanceDateRange();
  const [metaPlatform, setMetaPlatform] = useState<PlatformFilter>('all');
  const [metaDateRange, setMetaDateRange] = useState({
    from: subDays(new Date(), 90),
    to: new Date(),
  });

  const startDate = format(metaDateRange.from, 'yyyy-MM-dd');
  const endDate = format(metaDateRange.to, 'yyyy-MM-dd');

  const {
    posts,
    isLoading,
    syncing,
    syncPosts,
    postsByType,
    topPosts,
    engagementTrend,
    bestPostingTimes,
    hashtagPerformance,
    kpis,
    insights,
    isConnected,
  } = useMetaSocialAnalytics(metaPlatform, startDate, endDate);

  const handleSync = () => {
    const days = Math.ceil(
      (metaDateRange.to.getTime() - metaDateRange.from.getTime()) / (1000 * 60 * 60 * 24)
    );
    syncPosts(days);
  };

  return (
    <div className="flex h-dvh bg-gray-50">
      <FinanceSidebar
        activeSection="social-analytics"
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Social Analytics</h1>
              <p className="text-sm text-gray-500">
                Analiza el rendimiento de tu contenido en redes sociales
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="instagram" className="space-y-6">
            <TabsList className="bg-white border">
              <TabsTrigger
                value="instagram"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
              >
                Instagram / Facebook
              </TabsTrigger>
              <TabsTrigger
                value="tiktok"
                className="data-[state=active]:bg-black data-[state=active]:text-white"
              >
                TikTok
              </TabsTrigger>
            </TabsList>

            {/* Instagram / Facebook Tab */}
            <TabsContent value="instagram">
              <div className="space-y-6">
                {/* Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={metaPlatform}
                    onValueChange={(v) => setMetaPlatform(v as PlatformFilter)}
                  >
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {format(metaDateRange.from, 'dd MMM', { locale: es })} -{' '}
                        {format(metaDateRange.to, 'dd MMM', { locale: es })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <div className="flex flex-col gap-2 p-3">
                        <div className="flex gap-1">
                          {[
                            { label: '30d', days: 30 },
                            { label: '60d', days: 60 },
                            { label: '90d', days: 90 },
                            { label: '180d', days: 180 },
                          ].map((p) => (
                            <Button
                              key={p.label}
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() =>
                                setMetaDateRange({
                                  from: subDays(new Date(), p.days),
                                  to: new Date(),
                                })
                              }
                            >
                              {p.label}
                            </Button>
                          ))}
                        </div>
                        <Calendar
                          mode="range"
                          selected={{ from: metaDateRange.from, to: metaDateRange.to }}
                          onSelect={(range) => {
                            if (range?.from && range?.to) {
                              setMetaDateRange({ from: range.from, to: range.to });
                            }
                          }}
                          locale={es}
                          numberOfMonths={2}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Button
                    onClick={handleSync}
                    disabled={syncing || !isConnected}
                    size="sm"
                    className="h-9 gap-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Sincronizando...' : 'Sync Posts'}
                  </Button>
                </div>

                {/* Connection Warning */}
                {!isConnected && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-4 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Meta no esta conectado</p>
                        <p className="text-xs text-amber-600">
                          Conecta tu cuenta de Meta Ads desde el Finance Dashboard para sincronizar posts organicos.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-muted-foreground">Total Posts</span>
                      </div>
                      <p className="text-2xl font-bold">{kpis.totalPosts}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-4 w-4 text-violet-400" />
                        <span className="text-xs text-muted-foreground">Avg Engagement</span>
                      </div>
                      <p className="text-2xl font-bold">
                        {(kpis.avgEngagementRate * 100).toFixed(2)}%
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs text-muted-foreground">Mejor Tipo</span>
                      </div>
                      <p className="text-2xl font-bold capitalize">{kpis.bestPostType}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Eye className="h-4 w-4 text-blue-400" />
                        <span className="text-xs text-muted-foreground">Total Reach</span>
                      </div>
                      <p className="text-2xl font-bold">{kpis.totalReach.toLocaleString()}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Bookmark className="h-4 w-4 text-amber-400" />
                        <span className="text-xs text-muted-foreground">Avg Saves</span>
                      </div>
                      <p className="text-2xl font-bold">{kpis.avgSaves.toFixed(1)}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Eye className="h-4 w-4 text-purple-400" />
                        <span className="text-xs text-muted-foreground">Avg Reach</span>
                      </div>
                      <p className="text-2xl font-bold">
                        {Math.round(kpis.avgReach).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <ContentTypeAnalysis data={postsByType} isLoading={isLoading} />

                <EngagementPatterns
                  bestPostingTimes={bestPostingTimes}
                  engagementTrend={engagementTrend}
                  hashtagPerformance={hashtagPerformance}
                  insights={insights}
                  isLoading={isLoading}
                />

                <PostPerformanceTable posts={posts} isLoading={isLoading} />
              </div>
            </TabsContent>

            {/* TikTok Tab */}
            <TabsContent value="tiktok">
              <TikTokDashboard dateRange={dateRange} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default SocialAnalyticsPage;
