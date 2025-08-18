import React, { useState } from 'react';
import { OKRStatsCards } from '@/components/okr/OKRStatsCards';
import { TeamMemberProgress } from '@/components/okr/TeamMemberProgress';
import { QuarterSelector } from '@/components/okr/QuarterSelector';
import { AreaObjectivesList } from '@/components/okr/AreaObjectivesList';
import { TeamCheckinsTimeline } from '@/components/okr/TeamCheckinsTimeline';
import { OKRCoachingPanel } from '@/components/okr/OKRCoachingPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Settings, Target, MessageSquare, UserCheck } from 'lucide-react';

export const OKRAreaPage = () => {
  const [selectedQuarter, setSelectedQuarter] = useState<string>();

  return (
    <div className="space-y-6">
      {/* Quarter Selector */}
      <QuarterSelector 
        selectedQuarter={selectedQuarter}
        onQuarterChange={setSelectedQuarter}
      />
      
      {/* Area Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Mi Área</CardTitle>
                <p className="text-sm text-muted-foreground">Vista de equipo y colaboradores</p>
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
      
      {/* Tabs for different views */}
      <Tabs defaultValue="objectives" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="objectives" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Objetivos
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Equipo
          </TabsTrigger>
          <TabsTrigger value="checkins" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Check-ins
          </TabsTrigger>
          <TabsTrigger value="coaching" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Coaching
          </TabsTrigger>
        </TabsList>

        <TabsContent value="objectives" className="space-y-6">
          <AreaObjectivesList selectedQuarter={selectedQuarter} />
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <TeamMemberProgress />
        </TabsContent>

        <TabsContent value="checkins" className="space-y-6">
          <TeamCheckinsTimeline selectedQuarter={selectedQuarter} />
        </TabsContent>

        <TabsContent value="coaching" className="space-y-6">
          <OKRCoachingPanel selectedQuarter={selectedQuarter} />
        </TabsContent>
      </Tabs>
    </div>
  );
};