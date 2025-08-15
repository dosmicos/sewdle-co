import React from 'react';
import { QuarterHistory } from '@/components/okr/QuarterHistory';
import { PerformanceAnalytics } from '@/components/okr/PerformanceAnalytics';
import { QuarterSelector } from '@/components/okr/QuarterSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, TrendingUp } from 'lucide-react';

export const OKRHistoryPage = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <History className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Historial y Análisis</CardTitle>
              <p className="text-sm text-muted-foreground">Revisa tu rendimiento histórico y obtén insights de mejora</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quarter Navigation */}
      <QuarterSelector showNavigation />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Quarter History - Takes 1 column */}
        <div className="xl:col-span-1">
          <QuarterHistory />
        </div>

        {/* Performance Analytics - Takes 2 columns */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Análisis de Rendimiento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceAnalytics />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};