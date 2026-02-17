import { useState, useEffect, useCallback } from 'react';
import { useOKR } from '@/contexts/OKRContext';
import { useOKRQuarter } from './useOKRQuarter';

export interface HistoricalMetric {
  quarter: string;
  objectivesCount: number;
  completedObjectives: number;
  averageProgress: number;
  totalKeyResults: number;
  completedKeyResults: number;
  score: number;
}

export interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  description: string;
}

export interface PerformanceInsight {
  type: 'success' | 'warning' | 'info';
  title: string;
  description: string;
  metric?: number;
}

export const useOKRHistory = () => {
  const { objectives, keyResults } = useOKR();
  const { availableQuarters } = useOKRQuarter();
  const [historicalData, setHistoricalData] = useState<HistoricalMetric[]>([]);
  const [trends, setTrends] = useState<Record<string, TrendAnalysis>>({});
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const calculateHistoricalMetrics = useCallback(() => {
    const metrics: HistoricalMetric[] = [];
    
    // Generate historical data for each quarter
    availableQuarters.forEach(quarter => {
      // Filter objectives and key results for this quarter
      const quarterObjectives = objectives.filter(obj => {
        const objStart = new Date(obj.period_start);
        const objEnd = new Date(obj.period_end);
        return objStart >= quarter.startDate && objEnd <= quarter.endDate;
      });

      const quarterKeyResults = keyResults.filter(kr => {
        const objective = objectives.find(obj => obj.id === kr.objective_id);
        return objective && quarterObjectives.includes(objective);
      });

      const completedObjectives = quarterObjectives.filter(obj => {
        const objKeyResults = quarterKeyResults.filter(kr => kr.objective_id === obj.id);
        const avgProgress = objKeyResults.length > 0 
          ? objKeyResults.reduce((sum, kr) => sum + (kr.progress_pct || 0), 0) / objKeyResults.length
          : 0;
        return avgProgress >= 70; // Consider 70%+ as completed
      }).length;

      const completedKeyResults = quarterKeyResults.filter(kr => (kr.progress_pct || 0) >= 100).length;
      
      const averageProgress = quarterKeyResults.length > 0
        ? quarterKeyResults.reduce((sum, kr) => sum + (kr.progress_pct || 0), 0) / quarterKeyResults.length
        : 0;

      // Calculate score (0.0 - 1.0)
      const score = quarterKeyResults.length > 0
        ? quarterKeyResults.reduce((sum, kr) => {
            const progress = kr.progress_pct || 0;
            if (progress >= 100) return sum + 1.0;
            if (progress >= 70) return sum + 0.7 + ((progress - 70) * 0.3 / 30);
            if (progress >= 40) return sum + 0.4 + ((progress - 40) * 0.3 / 30);
            return sum + (progress * 0.4 / 40);
          }, 0) / quarterKeyResults.length
        : 0;

      metrics.push({
        quarter: quarter.label,
        objectivesCount: quarterObjectives.length,
        completedObjectives,
        averageProgress: Math.round(averageProgress),
        totalKeyResults: quarterKeyResults.length,
        completedKeyResults,
        score: Math.round(score * 100) / 100
      });
    });

    return metrics.sort((a, b) => a.quarter.localeCompare(b.quarter));
  }, [availableQuarters, keyResults, objectives]);

  const calculateTrends = useCallback((metrics: HistoricalMetric[]) => {
    const trends: Record<string, TrendAnalysis> = {};
    
    if (metrics.length < 2) return trends;

    const latest = metrics[metrics.length - 1];
    const previous = metrics[metrics.length - 2];

    // Progress trend
    const progressDiff = latest.averageProgress - previous.averageProgress;
    trends.progress = {
      direction: progressDiff > 5 ? 'up' : progressDiff < -5 ? 'down' : 'stable',
      percentage: Math.abs(progressDiff),
      description: progressDiff > 5 
        ? `Mejora de ${progressDiff.toFixed(1)}% en progreso promedio`
        : progressDiff < -5 
        ? `Descenso de ${Math.abs(progressDiff).toFixed(1)}% en progreso promedio`
        : 'Progreso estable'
    };

    // Completion trend
    const completionRate = latest.totalKeyResults > 0 
      ? (latest.completedKeyResults / latest.totalKeyResults) * 100 
      : 0;
    const prevCompletionRate = previous.totalKeyResults > 0 
      ? (previous.completedKeyResults / previous.totalKeyResults) * 100 
      : 0;
    const completionDiff = completionRate - prevCompletionRate;

    trends.completion = {
      direction: completionDiff > 10 ? 'up' : completionDiff < -10 ? 'down' : 'stable',
      percentage: Math.abs(completionDiff),
      description: completionDiff > 10 
        ? `Mejora de ${completionDiff.toFixed(1)}% en tasa de completitud`
        : completionDiff < -10 
        ? `Descenso de ${Math.abs(completionDiff).toFixed(1)}% en tasa de completitud`
        : 'Tasa de completitud estable'
    };

    return trends;
  }, []);

  const generateInsights = useCallback((metrics: HistoricalMetric[], trends: Record<string, TrendAnalysis>) => {
    const insights: PerformanceInsight[] = [];

    if (metrics.length === 0) return insights;

    const latest = metrics[metrics.length - 1];
    const average = metrics.reduce((sum, m) => sum + m.averageProgress, 0) / metrics.length;

    // Performance vs average
    if (latest.averageProgress > average + 10) {
      insights.push({
        type: 'success',
        title: 'Rendimiento Superior',
        description: `Tu progreso actual está ${(latest.averageProgress - average).toFixed(1)}% por encima de tu promedio histórico`,
        metric: latest.averageProgress
      });
    } else if (latest.averageProgress < average - 10) {
      insights.push({
        type: 'warning',
        title: 'Oportunidad de Mejora',
        description: `Tu progreso actual está ${(average - latest.averageProgress).toFixed(1)}% por debajo de tu promedio histórico`,
        metric: latest.averageProgress
      });
    }

    // Consistency analysis
    const consistency = 100 - (Math.max(...metrics.map(m => m.averageProgress)) - Math.min(...metrics.map(m => m.averageProgress)));
    if (consistency > 80) {
      insights.push({
        type: 'success',
        title: 'Alto Nivel de Consistencia',
        description: `Mantienes un rendimiento consistente con ${consistency.toFixed(1)}% de estabilidad`,
        metric: consistency
      });
    }

    // Trend insights
    if (trends.progress?.direction === 'up') {
      insights.push({
        type: 'success',
        title: 'Tendencia Positiva',
        description: trends.progress.description,
        metric: trends.progress.percentage
      });
    }

    return insights;
  }, []);

  const exportHistoricalData = () => {
    const csvContent = [
      ['Trimestre', 'Objetivos', 'Objetivos Completados', 'Progreso Promedio', 'Key Results', 'KRs Completados', 'Score'],
      ...historicalData.map(metric => [
        metric.quarter,
        metric.objectivesCount,
        metric.completedObjectives,
        `${metric.averageProgress}%`,
        metric.totalKeyResults,
        metric.completedKeyResults,
        metric.score
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `okr-historico-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (objectives.length > 0 && keyResults.length > 0 && availableQuarters.length > 0) {
      setLoading(true);
      const metrics = calculateHistoricalMetrics();
      const trendAnalysis = calculateTrends(metrics);
      const performanceInsights = generateInsights(metrics, trendAnalysis);

      setHistoricalData(metrics);
      setTrends(trendAnalysis);
      setInsights(performanceInsights);
      setLoading(false);
    }
  }, [availableQuarters, calculateHistoricalMetrics, calculateTrends, generateInsights, keyResults, objectives]);

  return {
    historicalData,
    trends,
    insights,
    loading,
    exportHistoricalData
  };
};
