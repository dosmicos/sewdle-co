import React from 'react';
import { PointsTracker } from '@/components/okr/PointsTracker';
import { IncentiveCard } from '@/components/okr/IncentiveCard';
import { LeaderboardTable } from '@/components/okr/LeaderboardTable';
import { RewardCatalog } from '@/components/okr/RewardCatalog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { useOKRIncentives } from '@/hooks/useOKRIncentives';

export const OKRIncentivesPage = () => {
  const { incentives } = useOKRIncentives();

  // Mock incentive for demonstration
  const mockIncentive = {
    id: '1',
    title: 'Objetivo Completado - Q1',
    description: 'Bonus por completar objetivo antes del plazo',
    type: 'objective_completion' as const,
    status: 'earned' as const,
    points: 500,
    progress: 100,
    maxProgress: 100,
    earnedDate: '2024-03-15',
    requirements: ['Completar objetivo', 'Antes del deadline']
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Sistema de Incentivos</CardTitle>
              <p className="text-sm text-muted-foreground">Gana puntos, desbloquea logros y canjea recompensas</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Points Tracker */}
      <PointsTracker />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incentives and Achievements */}
        <div className="space-y-6">
          <IncentiveCard 
            incentive={mockIncentive}
            onClaim={() => console.log('Claiming incentive')}
            onViewDetails={() => console.log('Viewing details')}
          />
        </div>

        {/* Leaderboard and Rewards */}
        <div className="space-y-6">
          <LeaderboardTable />
          <RewardCatalog />
        </div>
      </div>
    </div>
  );
};