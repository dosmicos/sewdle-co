import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MoreHorizontal, Target, Users, Calendar } from 'lucide-react';
import { useOKR } from '@/contexts/OKRContext';

interface ObjectiveCardProps {
  objective: {
    id: string;
    title: string;
    description?: string;
    level: 'area' | 'company' | 'team' | 'individual';
    tier: 'T1' | 'T2';
    area?: 'marketing' | 'diseno_prod' | 'operaciones';
    visibility: 'public' | 'area' | 'private';
    period_start: string;
    period_end: string;
    owner_id: string;
  };
  showActions?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const ObjectiveCard: React.FC<ObjectiveCardProps> = ({
  objective,
  showActions = false,
  onEdit,
  onDelete
}) => {
  const { getKeyResultsByObjective } = useOKR();
  const keyResults = getKeyResultsByObjective(objective.id);
  
  // Calcular progreso general del objetivo
  const totalProgress = keyResults.length > 0 
    ? keyResults.reduce((sum, kr) => sum + kr.progress_pct, 0) / keyResults.length
    : 0;

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'company': return 'bg-purple-100 text-purple-800';
      case 'area': return 'bg-blue-100 text-blue-800';
      case 'team': return 'bg-green-100 text-green-800';
      case 'individual': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierColor = (tier: string) => {
    return tier === 'T1' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={getLevelColor(objective.level)}>
                {objective.level}
              </Badge>
              <Badge className={getTierColor(objective.tier)}>
                {objective.tier}
              </Badge>
              {objective.area && (
                <Badge variant="outline">
                  {objective.area}
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg">{objective.title}</CardTitle>
            {objective.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {objective.description}
              </p>
            )}
          </div>
          {showActions && (
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progreso General</span>
            <span className="text-muted-foreground">{Math.round(totalProgress)}%</span>
          </div>
          <Progress value={totalProgress} className="h-2" />
        </div>

        {/* Key Results Summary */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span>{keyResults.length} Key Results</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              {new Date(objective.period_start).toLocaleDateString()} - {' '}
              {new Date(objective.period_end).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Key Results List */}
        {keyResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Key Results:</h4>
            <div className="space-y-1">
              {keyResults.slice(0, 3).map((kr) => (
                <div key={kr.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">• {kr.title}</span>
                  <span className={`font-medium ${
                    kr.progress_pct >= 100 ? 'text-green-600' :
                    kr.progress_pct >= 70 ? 'text-yellow-600' :
                    'text-gray-600'
                  }`}>
                    {Math.round(kr.progress_pct)}%
                  </span>
                </div>
              ))}
              {keyResults.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{keyResults.length - 3} más...
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};