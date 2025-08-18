import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useOKR } from '@/contexts/OKRContext';
import { useAuth } from '@/contexts/AuthContext';
import { Target, User, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface AreaObjectivesListProps {
  selectedQuarter?: string;
}

export const AreaObjectivesList: React.FC<AreaObjectivesListProps> = ({
  selectedQuarter
}) => {
  const { objectives, keyResults, getKeyResultsByObjective } = useOKR();
  const { user } = useAuth();

  // Filter objectives for current area/team (simplified for now)
  const areaObjectives = objectives.filter(obj => 
    obj.level === 'area' || obj.level === 'company'
  );

  const getRiskLevel = (progress: number, daysLeft: number) => {
    if (progress >= 70) return 'low';
    if (progress >= 40 && daysLeft > 30) return 'medium';
    return 'high';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'med': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'low': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Objetivos del Área</h2>
          <Badge variant="secondary">{areaObjectives.length}</Badge>
        </div>
        <Button variant="outline" size="sm">
          Ver Todos
        </Button>
      </div>

      <div className="grid gap-4">
        {areaObjectives.map((objective) => {
          const objKeyResults = getKeyResultsByObjective(objective.id);
          const avgProgress = objKeyResults.length > 0 
            ? objKeyResults.reduce((sum, kr) => sum + kr.progress_pct, 0) / objKeyResults.length
            : 0;
          
          const daysLeft = Math.ceil(
            (new Date(objective.period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          
          const risk = getRiskLevel(avgProgress, daysLeft);
          const lastUpdate = objKeyResults.reduce((latest, kr) => {
            const krUpdate = new Date(kr.updated_at);
            return krUpdate > latest ? krUpdate : latest;
          }, new Date(objective.updated_at));

          return (
            <Card key={objective.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base mb-2">{objective.title}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>
                          {objective.level === 'company' ? 'Empresa' : 'Área'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{daysLeft > 0 ? `${daysLeft} días` : 'Vencido'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      className={getRiskColor(risk)}
                    >
                      {risk === 'low' ? 'En camino' : risk === 'medium' ? 'Atención' : 'Riesgo'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progreso General</span>
                    <span className="font-medium">{Math.round(avgProgress)}%</span>
                  </div>
                  <Progress value={Math.min(avgProgress, 100)} className="h-2" />
                </div>

                {/* Key Results Summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Resultados Clave</span>
                    <span className="text-xs text-muted-foreground">
                      Actualizado {formatDistanceToNow(lastUpdate, { addSuffix: true, locale: es })}
                    </span>
                  </div>
                  
                  <div className="grid gap-2">
                    {objKeyResults.slice(0, 3).map((kr) => (
                      <div key={kr.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                        <div className="flex items-center gap-2 flex-1">
                          {getConfidenceIcon(kr.confidence)}
                          <span className="text-sm truncate">{kr.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {Math.round(kr.progress_pct)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                    
                    {objKeyResults.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        +{objKeyResults.length - 3} más
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    Ver Detalles
                  </Button>
                  <Button variant="outline" size="sm">
                    Check-in
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {areaObjectives.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay objetivos del área</h3>
              <p className="text-muted-foreground mb-4">
                No se encontraron objetivos para el área en este trimestre.
              </p>
              <Button variant="outline">
                Crear Primer Objetivo
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};