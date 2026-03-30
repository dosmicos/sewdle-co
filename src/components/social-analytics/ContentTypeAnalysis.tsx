import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Trophy, Image, Film, Layers, Play, Type, MessageCircle } from 'lucide-react';
import type { PostTypeAnalysis } from '@/hooks/useMetaSocialAnalytics';

interface ContentTypeAnalysisProps {
  data: PostTypeAnalysis[];
  isLoading?: boolean;
}

const typeIcons: Record<string, React.ReactNode> = {
  image: <Image className="h-4 w-4" />,
  reel: <Film className="h-4 w-4" />,
  carousel: <Layers className="h-4 w-4" />,
  video: <Play className="h-4 w-4" />,
  story: <MessageCircle className="h-4 w-4" />,
  text: <Type className="h-4 w-4" />,
};

const typeLabels: Record<string, string> = {
  image: 'Imagen',
  reel: 'Reel',
  carousel: 'Carousel',
  video: 'Video',
  story: 'Story',
  text: 'Texto',
};

const ContentTypeAnalysis: React.FC<ContentTypeAnalysisProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-64 bg-gray-100 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rendimiento por Tipo de Contenido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay datos suficientes. Sincroniza tus posts primero.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: typeLabels[d.post_type] || d.post_type,
    'Engagement Rate': Number((d.avg_engagement_rate * 100).toFixed(2)),
    'Avg Saves': Math.round(d.avg_saves),
    'Avg Reach': Math.round(d.avg_reach),
    posts: d.count,
  }));

  const winner = data[0];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Rendimiento por Tipo de Contenido</CardTitle>
          {winner && (
            <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
              <Trophy className="h-3 w-3" />
              {typeLabels[winner.post_type] || winner.post_type} gana
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bar Chart */}
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar
                yAxisId="left"
                dataKey="Engagement Rate"
                fill="#8b5cf6"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="Avg Saves"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detail Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Tipo</th>
                <th className="pb-2 font-medium text-right">Posts</th>
                <th className="pb-2 font-medium text-right">Eng. Rate</th>
                <th className="pb-2 font-medium text-right">Avg Reach</th>
                <th className="pb-2 font-medium text-right">Avg Saves</th>
                <th className="pb-2 font-medium text-right">Avg Shares</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={row.post_type}
                  className={`border-b last:border-0 ${i === 0 ? 'bg-amber-50/50' : ''}`}
                >
                  <td className="py-2.5 flex items-center gap-2">
                    {typeIcons[row.post_type]}
                    <span className="font-medium">
                      {typeLabels[row.post_type] || row.post_type}
                    </span>
                    {i === 0 && (
                      <Trophy className="h-3 w-3 text-amber-500" />
                    )}
                  </td>
                  <td className="py-2.5 text-right">{row.count}</td>
                  <td className="py-2.5 text-right font-medium">
                    {(row.avg_engagement_rate * 100).toFixed(2)}%
                  </td>
                  <td className="py-2.5 text-right">
                    {Math.round(row.avg_reach).toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right font-medium text-amber-600">
                    {Math.round(row.avg_saves).toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right">
                    {Math.round(row.avg_shares).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContentTypeAnalysis;
