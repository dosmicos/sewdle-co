import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, TrendingDown, Minus, Award, Target } from 'lucide-react';
import { useOKRHistory } from '@/hooks/useOKRHistory';
import { useOKRQuarter } from '@/hooks/useOKRQuarter';

export const QuarterHistory = () => {
  const { historicalData, trends, loading } = useOKRHistory();
  const { availableQuarters, selectQuarter, selectedQuarter } = useOKRQuarter();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historial de Trimestres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trendKey: string) => {
    const trend = trends[trendKey];
    if (!trend) return <Minus className="h-4 w-4 text-muted-foreground" />;
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Excelente</Badge>;
    if (score >= 0.6) return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">Bueno</Badge>;
    if (score >= 0.4) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">Regular</Badge>;
    return <Badge variant="outline">Necesita Mejora</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de Trimestres
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {/* Export functionality could be added here */}}
          >
            Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {historicalData.map((metric, index) => {
            const quarter = availableQuarters.find(q => q.label === metric.quarter);
            const isSelected = selectedQuarter?.label === metric.quarter;
            const completionRate = metric.totalKeyResults > 0 
              ? Math.round((metric.completedKeyResults / metric.totalKeyResults) * 100)
              : 0;

            return (
              <div
                key={metric.quarter}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => quarter && selectQuarter(quarter.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{metric.quarter}</h3>
                      {quarter?.isCurrent && (
                        <Badge variant="secondary">Actual</Badge>
                      )}
                      {quarter && new Date() > quarter.endDate && (
                        <Badge variant="outline">Finalizado</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {quarter ? `${quarter.startDate.toLocaleDateString()} - ${quarter.endDate.toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getScoreBadge(metric.score)}
                    <span className="text-sm font-medium">
                      {(metric.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Objetivos</span>
                    </div>
                    <div className="font-semibold">
                      {metric.completedObjectives}/{metric.objectivesCount}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Key Results</span>
                    </div>
                    <div className="font-semibold">
                      {metric.completedKeyResults}/{metric.totalKeyResults}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {getTrendIcon('progress')}
                      <span className="text-sm text-muted-foreground">Progreso</span>
                    </div>
                    <div className="font-semibold">{metric.averageProgress}%</div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {getTrendIcon('completion')}
                      <span className="text-sm text-muted-foreground">Completitud</span>
                    </div>
                    <div className="font-semibold">{completionRate}%</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progreso General</span>
                    <span>{metric.averageProgress}%</span>
                  </div>
                  <Progress value={metric.averageProgress} className="h-2" />
                </div>

                {trends.progress && index === historicalData.length - 1 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      {getTrendIcon('progress')}
                      <span className="text-muted-foreground">
                        {trends.progress.description}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {historicalData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay datos históricos disponibles</p>
              <p className="text-sm">Los datos aparecerán cuando tengas objetivos en trimestres pasados</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};