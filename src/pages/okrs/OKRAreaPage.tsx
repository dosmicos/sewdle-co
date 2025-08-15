import React from 'react';
import { OKRStatsCards } from '@/components/okr/OKRStatsCards';
import { TeamMemberProgress } from '@/components/okr/TeamMemberProgress';
import { QuarterSelector } from '@/components/okr/QuarterSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Settings } from 'lucide-react';

export const OKRAreaPage = () => {
  return (
    <div className="space-y-6">
      {/* Quarter Selector */}
      <QuarterSelector />
      
      {/* Area Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Área de Producción</CardTitle>
                <p className="text-sm text-muted-foreground">8 colaboradores • Trimestre actual</p>
              </div>
            </div>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Area Stats */}
      <OKRStatsCards variant="area" />
      
      {/* Team Progress */}
      <TeamMemberProgress />
    </div>
  );
};