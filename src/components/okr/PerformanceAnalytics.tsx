import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Download, Lightbulb, Award, AlertCircle, CheckCircle } from 'lucide-react';
import { useOKRHistory } from '@/hooks/useOKRHistory';

export const PerformanceAnalytics = () => {
  const { historicalData, trends, insights, loading, exportHistoricalData } = useOKRHistory();

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="animate-pulse h-6 bg-muted rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse h-48 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (historicalData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Análisis de Rendimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay suficientes datos para mostrar análisis</p>
            <p className="text-sm">Completa al menos un trimestre para ver tus métricas de rendimiento</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const progressChartData = historicalData.map(metric => ({
    quarter: metric.quarter,
    progreso: metric.averageProgress,
    objetivos: (metric.completedObjectives / metric.objectivesCount) * 100 || 0,
    keyResults: (metric.completedKeyResults / metric.totalKeyResults) * 100 || 0
  }));

  const scoreDistributionData = historicalData.map(metric => ({
    quarter: metric.quarter,
    score: metric.score * 100
  }));

  // Performance distribution
  const performanceDistribution = [
    { name: 'Excelente (80%+)', value: historicalData.filter(m => m.score >= 0.8).length, color: '#10b981' },
    { name: 'Bueno (60-79%)', value: historicalData.filter(m => m.score >= 0.6 && m.score < 0.8).length, color: '#3b82f6' },
    { name: 'Regular (40-59%)', value: historicalData.filter(m => m.score >= 0.4 && m.score < 0.6).length, color: '#f59e0b' },
    { name: 'Necesita Mejora (<40%)', value: historicalData.filter(m => m.score < 0.4).length, color: '#ef4444' }
  ].filter(item => item.value > 0);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Lightbulb className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Performance Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Insights de Rendimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    insight.type === 'success' 
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                      : insight.type === 'warning'
                      ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30'
                      : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      {insight.metric && (
                        <Badge variant="secondary" className="mt-2">
                          {insight.metric.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Evolución del Progreso</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={progressChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarter" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, '']} />
                <Line 
                  type="monotone" 
                  dataKey="progreso" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Progreso Promedio"
                />
                <Line 
                  type="monotone" 
                  dataKey="objetivos" 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                  name="Objetivos Completados"
                />
                <Line 
                  type="monotone" 
                  dataKey="keyResults" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={2}
                  name="Key Results Completados"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Puntuaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarter" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                <Bar 
                  dataKey="score" 
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Distribution Pie Chart */}
        {performanceDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Rendimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={performanceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {performanceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {performanceDistribution.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <Badge variant="secondary">{item.value}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Métricas Clave</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportHistoricalData}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Average Performance */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Progreso Promedio General</span>
                <Badge variant="secondary">
                  {Math.round(historicalData.reduce((sum, m) => sum + m.averageProgress, 0) / historicalData.length)}%
                </Badge>
              </div>

              {/* Best Quarter */}
              {(() => {
                const bestQuarter = historicalData.reduce((best, current) => 
                  current.score > best.score ? current : best
                );
                return (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Mejor Trimestre</span>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        {bestQuarter.quarter}
                      </Badge>
                      <span className="text-sm font-medium">
                        {(bestQuarter.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Total Objectives */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Objetivos Completados</span>
                <Badge variant="secondary">
                  {historicalData.reduce((sum, m) => sum + m.completedObjectives, 0)}
                </Badge>
              </div>

              {/* Total Key Results */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Key Results Completados</span>
                <Badge variant="secondary">
                  {historicalData.reduce((sum, m) => sum + m.completedKeyResults, 0)}
                </Badge>
              </div>

              {/* Consistency Score */}
              {(() => {
                const scores = historicalData.map(m => m.averageProgress);
                const consistency = scores.length > 1 
                  ? 100 - (Math.max(...scores) - Math.min(...scores))
                  : 100;
                return (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Índice de Consistencia</span>
                    <Badge 
                      className={
                        consistency > 80 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                          : consistency > 60 
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                      }
                    >
                      {consistency.toFixed(0)}%
                    </Badge>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};