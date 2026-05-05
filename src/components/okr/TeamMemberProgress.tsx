import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOKR } from '@/contexts/OKRContext';
import { useOKRProgress } from '@/hooks/useOKRProgress';
import { Users, User, TrendingUp, AlertTriangle } from 'lucide-react';

interface TeamMemberProgressProps {
  area?: string;
  showAll?: boolean;
  onMemberClick?: (userId: string) => void;
}

export const TeamMemberProgress: React.FC<TeamMemberProgressProps> = ({
  area,
  showAll = false,
  onMemberClick
}) => {
  const { objectives } = useOKR();
  const { getProgressByUser, getProgressByArea } = useOKRProgress();
  
  // Calculate user stats from objectives and progress data
  const userStats = React.useMemo(() => {
    const uniqueUsers = Array.from(new Set(objectives.map(obj => obj.owner_id)));
    return uniqueUsers.map(userId => {
      const userObjectives = objectives.filter(obj => obj.owner_id === userId);
      const userProgress = getProgressByUser(userId);
      const averageProgress = userProgress.length > 0 
        ? userProgress.reduce((sum, p) => sum + p.overallProgress, 0) / userProgress.length 
        : 0;
      const completedObjectives = userProgress.filter(p => p.overallProgress >= 100).length;
      
      return {
        userId,
        objectivesCount: userObjectives.length,
        averageProgress,
        completedObjectives
      };
    });
  }, [objectives, getProgressByUser]);

  // Filtrar usuarios por área si se especifica
  const filteredUserStats = React.useMemo(() => {
    if (!area) return userStats;
    
    const areaObjectives = objectives.filter(obj => obj.area === area);
    const areaUserIds = new Set(areaObjectives.map(obj => obj.owner_id));
    
    return userStats.filter(stat => areaUserIds.has(stat.userId));
  }, [userStats, objectives, area]);

  const getProgressStatus = (progress: number) => {
    if (progress >= 90) return { variant: 'default' as const, label: 'Destacado', color: 'text-green-600' };
    if (progress >= 70) return { variant: 'secondary' as const, label: 'En progreso', color: 'text-blue-600' };
    if (progress >= 50) return { variant: 'outline' as const, label: 'Moderado', color: 'text-yellow-600' };
    return { variant: 'destructive' as const, label: 'Necesita apoyo', color: 'text-red-600' };
  };

  const getUserInitials = (userId: string) => {
    // En un caso real, esto vendría de un contexto de usuarios o API
    const userMap: Record<string, string> = {
      // Mock data - en producción vendría de la base de datos
    };
    return userMap[userId] || userId.substring(0, 2).toUpperCase();
  };

  const getUserName = (userId: string) => {
    // En un caso real, esto vendría de un contexto de usuarios o API
    const userMap: Record<string, string> = {
      // Mock data - en producción vendría de la base de datos
    };
    return userMap[userId] || `Usuario ${userId.substring(0, 8)}`;
  };

  const getUserRole = (userId: string) => {
    // En un caso real, esto vendría de un contexto de usuarios o API
    return 'Colaborador';
  };

  if (filteredUserStats.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center space-y-2">
              <Users className="h-8 w-8 mx-auto opacity-50" />
              <p>No hay miembros del equipo</p>
              <p className="text-sm">
                {area ? `No hay objetivos asignados en el área ${area}` : 'No hay objetivos asignados'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {area ? `Progreso del Área - ${area}` : 'Progreso del Equipo'}
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            {filteredUserStats.length} miembro{filteredUserStats.length !== 1 ? 's' : ''}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filteredUserStats
          .sort((a, b) => b.averageProgress - a.averageProgress)
          .slice(0, showAll ? undefined : 10)
          .map((userStat) => {
            const userProgress = getProgressByUser(userStat.userId);
            const avgProgress = userStat.averageProgress;
            const status = getProgressStatus(avgProgress);

            return (
              <div
                key={userStat.userId}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => onMemberClick?.(userStat.userId)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getUserInitials(userStat.userId)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <div className="font-medium">{getUserName(userStat.userId)}</div>
                    <div className="text-sm text-muted-foreground">{getUserRole(userStat.userId)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {userStat.objectivesCount} objetivo{userStat.objectivesCount !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {userStat.completedObjectives} completado{userStat.completedObjectives !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Progress value={avgProgress} className="w-24 h-2" />
                      <span className={`text-sm font-medium ${status.color}`}>
                        {Math.round(avgProgress)}%
                      </span>
                    </div>
                    
                    <Badge variant={status.variant} className="min-w-[100px] justify-center">
                      {status.label}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}

        {!showAll && filteredUserStats.length > 10 && (
          <div className="pt-4 border-t">
            <Button variant="outline" className="w-full">
              Ver todos los miembros ({filteredUserStats.length - 10} más)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};