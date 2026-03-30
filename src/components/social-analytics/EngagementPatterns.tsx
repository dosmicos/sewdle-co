import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Clock, Hash, Lightbulb } from 'lucide-react';
import type {
  PostingTimeAnalysis,
  EngagementTrend,
  HashtagPerformance,
} from '@/hooks/useMetaSocialAnalytics';

interface EngagementPatternsProps {
  bestPostingTimes: PostingTimeAnalysis[];
  engagementTrend: EngagementTrend[];
  hashtagPerformance: HashtagPerformance[];
  insights: string[];
  isLoading?: boolean;
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const EngagementPatterns: React.FC<EngagementPatternsProps> = ({
  bestPostingTimes,
  engagementTrend,
  hashtagPerformance,
  insights,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse h-48 bg-gray-100 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Build heatmap data
  const heatmapData = useMemo(() => {
    const maxEng = Math.max(...bestPostingTimes.map((t) => t.avg_engagement_rate), 0.001);
    const grid: { day: number; hour: number; value: number; count: number }[][] = [];
    for (let d = 0; d < 7; d++) {
      grid[d] = [];
      for (let h = 0; h < 24; h++) {
        const entry = bestPostingTimes.find((t) => t.day === d && t.hour === h);
        grid[d][h] = {
          day: d,
          hour: h,
          value: entry ? entry.avg_engagement_rate / maxEng : 0,
          count: entry?.count || 0,
        };
      }
    }
    return grid;
  }, [bestPostingTimes]);

  const getHeatColor = (value: number): string => {
    if (value === 0) return 'bg-gray-50';
    if (value < 0.25) return 'bg-violet-100';
    if (value < 0.5) return 'bg-violet-200';
    if (value < 0.75) return 'bg-violet-400';
    return 'bg-violet-600';
  };

  const trendData = engagementTrend.map((t) => ({
    week: t.week.slice(5), // MM-DD
    'Engagement %': Number((t.avg_engagement_rate * 100).toFixed(2)),
    Posts: t.total_posts,
    Reach: t.total_reach,
    Saves: t.total_saves,
  }));

  return (
    <div className="space-y-4">
      {/* Auto Insights */}
      {insights.length > 0 && (
        <Card className="border-violet-200 bg-violet-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-violet-600" />
              Insights Automaticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-violet-500 font-bold mt-0.5">-</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Engagement Trend */}
      {trendData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Tendencia de Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Engagement %"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posting Time Heatmap */}
      {bestPostingTimes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Mejor Hora para Publicar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Hour labels */}
                <div className="flex items-center mb-1">
                  <div className="w-10" />
                  {HOURS.filter((h) => h % 3 === 0).map((h) => (
                    <div
                      key={h}
                      className="text-[10px] text-muted-foreground"
                      style={{ width: `${(100 / 24) * 3}%`, textAlign: 'center' }}
                    >
                      {h}:00
                    </div>
                  ))}
                </div>

                {/* Heatmap grid */}
                {DAYS.map((day, dayIdx) => (
                  <div key={day} className="flex items-center gap-0.5 mb-0.5">
                    <div className="w-10 text-xs text-muted-foreground font-medium">
                      {day}
                    </div>
                    <div className="flex flex-1 gap-[1px]">
                      {HOURS.map((hour) => {
                        const cell = heatmapData[dayIdx]?.[hour];
                        return (
                          <div
                            key={hour}
                            className={`flex-1 h-6 rounded-sm ${getHeatColor(cell?.value || 0)} transition-colors`}
                            title={`${DAYS[dayIdx]} ${hour}:00 — ${cell?.count || 0} posts, eng: ${((cell?.value || 0) * 100).toFixed(0)}%`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Legend */}
                <div className="flex items-center gap-2 mt-3 justify-end">
                  <span className="text-[10px] text-muted-foreground">Menos</span>
                  {['bg-gray-50', 'bg-violet-100', 'bg-violet-200', 'bg-violet-400', 'bg-violet-600'].map(
                    (color) => (
                      <div key={color} className={`w-4 h-4 rounded-sm ${color}`} />
                    )
                  )}
                  <span className="text-[10px] text-muted-foreground">Mas</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Hashtags */}
      {hashtagPerformance.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Top Hashtags por Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {hashtagPerformance.slice(0, 12).map((tag, i) => (
                <div
                  key={tag.hashtag}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-4">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{tag.hashtag}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {tag.count}x
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">
                      {(tag.avg_engagement_rate * 100).toFixed(2)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      reach: {Math.round(tag.avg_reach).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EngagementPatterns;
