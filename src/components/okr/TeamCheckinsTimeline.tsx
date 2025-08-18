import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useOKR } from '@/contexts/OKRContext';
import { Clock, MessageSquare, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface TeamCheckinsTimelineProps {
  selectedQuarter?: string;
  maxItems?: number;
}

export const TeamCheckinsTimeline: React.FC<TeamCheckinsTimelineProps> = ({
  selectedQuarter,
  maxItems = 10
}) => {
  const { checkins, keyResults, objectives } = useOKR();

  // Get recent team check-ins (simplified - would need user/team data)
  const recentCheckins = checkins
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, maxItems);

  const getCheckinKeyResult = (checkinId: string) => {
    const checkin = checkins.find(c => c.id === checkinId);
    return checkin ? keyResults.find(kr => kr.id === checkin.kr_id) : undefined;
  };

  const getObjectiveFromKR = (krId: string) => {
    const kr = keyResults.find(k => k.id === krId);
    return kr ? objectives.find(obj => obj.id === kr.objective_id) : undefined;
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-700 border-green-200';
      case 'med': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return <TrendingUp className="h-3 w-3" />;
      case 'med': return <Clock className="h-3 w-3" />;
      case 'low': return <AlertTriangle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const getUserInitials = (userId: string) => {
    // This would come from user data - simplified for now
    return userId.slice(0, 2).toUpperCase();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Check-ins del Equipo
          </CardTitle>
          <Button variant="outline" size="sm">
            Ver Todos
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentCheckins.length > 0 ? (
          <div className="space-y-4">
            {recentCheckins.map((checkin) => {
              const kr = getCheckinKeyResult(checkin.id);
              const objective = kr ? getObjectiveFromKR(kr.id) : undefined;
              
              return (
                <div key={checkin.id} className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-shrink-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getUserInitials(checkin.author_id)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {getUserInitials(checkin.author_id)}
                          </span>
                          <Badge 
                            variant="outline"
                            className={`text-xs ${getConfidenceColor(checkin.confidence)}`}
                          >
                            <div className="flex items-center gap-1">
                              {getConfidenceIcon(checkin.confidence)}
                              <span>
                                {checkin.confidence === 'high' ? 'Alta' : 
                                 checkin.confidence === 'med' ? 'Media' : 'Baja'}
                              </span>
                            </div>
                          </Badge>
                          {checkin.progress_pct !== undefined && (
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(checkin.progress_pct)}%
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-muted-foreground mb-1">
                          {kr?.title}
                        </div>
                        
                        {objective && (
                          <div className="text-xs text-muted-foreground">
                            {objective.title}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(checkin.created_at), { addSuffix: true, locale: es })}
                      </div>
                    </div>
                    
                    {checkin.note && (
                      <div className="text-sm bg-background border-l-2 border-primary/20 pl-3 py-1 mb-2">
                        <div className="flex items-start gap-1">
                          <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">{checkin.note}</span>
                        </div>
                      </div>
                    )}
                    
                    {checkin.blockers && (
                      <div className="text-sm bg-red-50 border-l-2 border-red-200 pl-3 py-1">
                        <div className="flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 text-red-600 flex-shrink-0" />
                          <span className="text-red-700">{checkin.blockers}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay check-ins recientes</h3>
            <p className="text-muted-foreground mb-4">
              Los miembros del equipo aún no han registrado check-ins en este trimestre.
            </p>
            <Button variant="outline">
              Solicitar Check-ins
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};