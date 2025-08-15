import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useOKRProgress } from '@/hooks/useOKRProgress';
import { useOKRStats } from '@/hooks/useOKRStats';

interface OKRProgressChartProps {
  variant?: 'line' | 'area' | 'bar' | 'pie';
  dataType?: 'progress' | 'distribution' | 'areas' | 'trends';
  height?: number;
  title?: string;
}

export const OKRProgressChart: React.FC<OKRProgressChartProps> = ({
  variant = 'line',
  dataType = 'progress',
  height = 300,
  title
}) => {
  const { progressData, progressByArea, riskDistribution } = useOKRProgress();
  const { objectivesByArea } = useOKRStats();

  // Generate mock time series data (in real app, this would come from analytics)
  const generateTimeSeriesData = () => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    return months.map((month, index) => ({
      month,
      progress: Math.round(30 + (index * 8) + Math.random() * 10),
      objectives: Math.round(8 + Math.random() * 4),
      completed: Math.round((30 + (index * 8)) / 100 * (8 + Math.random() * 4))
    }));
  };

  const timeSeriesData = generateTimeSeriesData();

  const getAreaDistributionData = () => {
    return Object.entries(progressByArea).map(([area, progress]) => {
      const safe = Number.isFinite(progress as number) ? (progress as number) : 0;
      return {
        area: area === 'sin_area' ? 'Sin Área' : area.replace('_', ' ').toUpperCase(),
        progress: Math.round(safe),
        objectives: objectivesByArea[area] || 0
      };
    });
  };

  const getRiskDistributionData = () => {
    const colors = ['#ef4444', '#f59e0b', '#10b981'];
    return Object.entries(riskDistribution).map(([risk, count], index) => ({
      name: risk === 'high' ? 'Alto Riesgo' : risk === 'medium' ? 'Riesgo Medio' : 'Bajo Riesgo',
      value: count,
      color: colors[index % colors.length]
    }));
  };

  const renderChart = () => {
    switch (dataType) {
      case 'trends':
        if (variant === 'area') {
          return (
            <ResponsiveContainer width="100%" height={height}>
              <AreaChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} ticks={[0,20,40,60,80,100]} allowDecimals={false} />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="progress" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          );
        }
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} ticks={[0,20,40,60,80,100]} allowDecimals={false} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="progress" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'areas':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={getAreaDistributionData()}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="area" />
              <YAxis domain={[0, 100]} ticks={[0,20,40,60,80,100]} allowDecimals={false} />
              <Tooltip />
              <Bar 
                dataKey="progress" 
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'distribution':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={getRiskDistributionData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => {
                  const p = Number.isFinite(percent as number) ? (percent as number) : 0;
                  return `${name} ${Math.round(p * 100)}%`;
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {getRiskDistributionData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default: // progress
        const progressOverviewData = progressData.slice(0, 10).map(obj => {
          const val = Number(obj.overallProgress);
          const safe = Number.isFinite(val) ? val : 0;
          return {
            name: obj.objectiveTitle.substring(0, 20) + '...',
            progress: Math.round(safe),
            risk: obj.riskLevel
          };
        });

        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={progressOverviewData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" domain={[0, 100]} ticks={[0,20,40,60,80,100]} allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip />
              <Bar 
                dataKey="progress" 
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  const getDefaultTitle = () => {
    switch (dataType) {
      case 'trends': return 'Tendencia de Progreso';
      case 'areas': return 'Progreso por Área';
      case 'distribution': return 'Distribución de Riesgo';
      default: return 'Progreso de Objetivos';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || getDefaultTitle()}</CardTitle>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
};