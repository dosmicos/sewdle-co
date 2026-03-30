import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  RefreshCw,
  BarChart3,
  TrendingUp,
  Bookmark,
  Eye,
  FileText,
  CalendarIcon,
  Instagram,
  AlertCircle,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMetaSocialAnalytics } from '@/hooks/useMetaSocialAnalytics';
import ContentTypeAnalysis from '@/components/social-analytics/ContentTypeAnalysis';
import PostPerformanceTable from '@/components/social-analytics/PostPerformanceTable';
import EngagementPatterns from '@/components/social-analytics/EngagementPatterns';

type PlatformFilter = 'all' | 'instagram' | 'facebook';

const SocialAnalyticsPage: React.FC = () => {
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 90),
    to: new Date(),
  });

  const startDate = format(dateRange.from, 'yyyy-MM-dd');
  const endDate = format(dateRange.to, 'yyyy-MM-dd');

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
  } = useMetaSocialAnalytics(platform, startDate, endDate);

  const handleSync = () => {
    const days = Math.ceil(
      (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
    );
    syncPosts(days);
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Instagram className="h-6 w-6 text-pink-500" />
              Social Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Analisis de contenido organico de Instagram y Facebook
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Platform selector */}
            <Select
              value={platform}
              onValueChange={(v) => setPlatform(v as PlatformFilter)}
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

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(dateRange.from, 'dd MMM', { locale: es })} -{' '}
                  {format(dateRange.to, 'dd MMM', { locale: es })}
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
                    ].map((preset) => (
                      <Button
                        key={preset.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() =>
                          setDateRange({
                            from: subDays(new Date(), preset.days),
                            to: new Date(),
                          })
                        }
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    locale={es}
                    numberOfMonths={2}
                  />
                </div>
              </PopoverContent>
            </Popover>

            {/* Sync Button */}
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
        </div>

        {/* Connection Warning */}
        {!isConnected && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Meta no esta conectado
                </p>
                <p className="text-xs text-amber-600">
                  Conecta tu cuenta de Meta Ads desde el Finance Dashboard para poder sincronizar posts organicos.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
              <p className="text-2xl font-bold">{Math.round(kpis.avgReach).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Content Type Analysis */}
        <ContentTypeAnalysis data={postsByType} isLoading={isLoading} />

        {/* Engagement Patterns */}
        <EngagementPatterns
          bestPostingTimes={bestPostingTimes}
          engagementTrend={engagementTrend}
          hashtagPerformance={hashtagPerformance}
          insights={insights}
          isLoading={isLoading}
        />

        {/* Post Performance Table */}
        <PostPerformanceTable posts={posts} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default SocialAnalyticsPage;
