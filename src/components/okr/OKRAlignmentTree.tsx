import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useOKR } from '@/contexts/OKRContext';
import { useOKRProgress } from '@/hooks/useOKRProgress';
import { ChevronDown, ChevronRight, Target, Users } from 'lucide-react';

interface OKRAlignmentTreeProps {
  showActions?: boolean;
  onObjectiveClick?: (objectiveId: string) => void;
}

export const OKRAlignmentTree: React.FC<OKRAlignmentTreeProps> = ({
  showActions = false,
  onObjectiveClick
}) => {
  const { objectives } = useOKR();
  const { progressData } = useOKRProgress();
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set());

  // Agrupar objetivos por nivel y área
  const organizationalObjectives = objectives.filter(obj => obj.level === 'company');
  const teamObjectives = objectives.filter(obj => obj.level === 'team');
  const individualObjectives = objectives.filter(obj => obj.level === 'individual');

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const getObjectiveProgress = (objectiveId: string) => {
    const progress = progressData.find(p => p.objectiveId === objectiveId);
    return progress?.overallProgress || 0;
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'company': return 'bg-primary/10 text-primary border-primary/20';
      case 'team': return 'bg-secondary/10 text-secondary-foreground border-secondary/20';
      case 'individual': return 'bg-accent/10 text-accent-foreground border-accent/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const ObjectiveNode: React.FC<{ objective: unknown; level: number; children?: unknown[] }> = ({
    objective,
    level,
    children = []
  }) => {
    const progress = getObjectiveProgress(objective.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(objective.id);

    return (
      <div className="space-y-2">
        <div 
          className={`border rounded-lg p-4 transition-all hover:shadow-md ${getLevelColor(objective.level)}`}
          style={{ marginLeft: `${level * 24}px` }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {hasChildren && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleNode(objective.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
              
              <div className="flex items-center gap-2">
                {objective.level === 'company' && <Target className="h-4 w-4" />}
                {objective.level === 'team' && <Users className="h-4 w-4" />}
                {objective.level === 'individual' && <Target className="h-3 w-3" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 
                    className="font-medium cursor-pointer hover:underline"
                    onClick={() => onObjectiveClick?.(objective.id)}
                  >
                    {objective.title}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {objective.level === 'company' && 'Organizacional'}
                    {objective.level === 'team' && 'Equipo'}
                    {objective.level === 'individual' && 'Individual'}
                  </Badge>
                  {objective.area && (
                    <Badge variant="secondary" className="text-xs">
                      {objective.area}
                    </Badge>
                  )}
                </div>
                
                {objective.description && (
                  <p className="text-sm text-muted-foreground mb-2">{objective.description}</p>
                )}
                
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Progress value={progress} className="h-2" />
                  </div>
                  <span className="text-sm font-medium w-12">{Math.round(progress)}%</span>
                </div>
                
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>
                    {new Date(objective.period_start).toLocaleDateString()} - {new Date(objective.period_end).toLocaleDateString()}
                  </span>
                  {objective.tier && (
                    <Badge variant="outline" className="text-xs">
                      {objective.tier}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {showActions && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onObjectiveClick?.(objective.id)}
              >
                Ver Detalles
              </Button>
            )}
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="space-y-2">
            {children.map((child) => (
              <ObjectiveNode
                key={child.id}
                objective={child}
                level={level + 1}
                children={getChildObjectives(child.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const getChildObjectives = (parentId: string) => {
    return objectives.filter(obj => obj.parent_objective_id === parentId);
  };

  if (objectives.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center space-y-2">
              <Target className="h-8 w-8 mx-auto opacity-50" />
              <p>No hay objetivos disponibles</p>
              <p className="text-sm">Crea tu primer objetivo para ver el mapa de alineación</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Mapa de Alineación Organizacional
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Objetivos Organizacionales */}
        {organizationalObjectives.map((objective) => (
          <ObjectiveNode
            key={objective.id}
            objective={objective}
            level={0}
            children={getChildObjectives(objective.id)}
          />
        ))}
        
        {/* Objetivos de Equipo sin padre */}
        {teamObjectives
          .filter(obj => !obj.parent_objective_id)
          .map((objective) => (
            <ObjectiveNode
              key={objective.id}
              objective={objective}
              level={0}
              children={getChildObjectives(objective.id)}
            />
          ))}
        
        {/* Objetivos Individuales sin padre */}
        {individualObjectives
          .filter(obj => !obj.parent_objective_id)
          .map((objective) => (
            <ObjectiveNode
              key={objective.id}
              objective={objective}
              level={0}
              children={getChildObjectives(objective.id)}
            />
          ))}
      </CardContent>
    </Card>
  );
};