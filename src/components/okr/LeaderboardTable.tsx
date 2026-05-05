import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal, Award, Crown, TrendingUp, Users } from 'lucide-react';

interface LeaderboardEntry {
  userId: string;
  name: string;
  role: string;
  area: string;
  points: number;
  completedObjectives: number;
  averageProgress: number;
  streak: number;
  position: number;
  change: number; // +1, -1, 0 for position change
  avatar?: string;
}

interface LeaderboardTableProps {
  scope?: 'company' | 'area' | 'team';
  area?: string;
  timeframe?: 'week' | 'month' | 'quarter' | 'all';
  limit?: number;
  showPositionChange?: boolean;
  onUserClick?: (userId: string) => void;
}

// Mock data - en producción vendría del backend
const mockLeaderboardData: LeaderboardEntry[] = [
  {
    userId: '1',
    name: 'María González',
    role: 'Técnico de Calidad',
    area: 'Producción',
    points: 2150,
    completedObjectives: 4,
    averageProgress: 92,
    streak: 12,
    position: 1,
    change: 1
  },
  {
    userId: '2',
    name: 'Juan Pérez',
    role: 'Supervisor de Línea',
    area: 'Producción',
    points: 1980,
    completedObjectives: 3,
    averageProgress: 87,
    streak: 8,
    position: 2,
    change: -1
  },
  {
    userId: '3',
    name: 'Ana Rodríguez',
    role: 'Operaria Especializada',
    area: 'Producción',
    points: 1750,
    completedObjectives: 3,
    averageProgress: 78,
    streak: 5,
    position: 3,
    change: 2
  },
  {
    userId: '4',
    name: 'Carlos López',
    role: 'Gerente de Área',
    area: 'Ventas',
    points: 1650,
    completedObjectives: 2,
    averageProgress: 85,
    streak: 15,
    position: 4,
    change: 0
  },
  {
    userId: '5',
    name: 'Sofia Martín',
    role: 'Desarrolladora',
    area: 'Tecnología',
    points: 1580,
    completedObjectives: 3,
    averageProgress: 73,
    streak: 6,
    position: 5,
    change: -2
  }
];

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  scope = 'company',
  area,
  timeframe = 'month',
  limit = 10,
  showPositionChange = true,
  onUserClick
}) => {
  // Filtrar datos según el scope y área
  const filteredData = React.useMemo(() => {
    let data = [...mockLeaderboardData];
    
    if (scope === 'area' && area) {
      data = data.filter(entry => entry.area === area);
    }
    
    return data.slice(0, limit);
  }, [scope, area, limit]);

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2: return <Trophy className="h-5 w-5 text-gray-400" />;
      case 3: return <Medal className="h-5 w-5 text-amber-600" />;
      default: return <span className="text-lg font-bold text-muted-foreground">#{position}</span>;
    }
  };

  const getPositionChangeIndicator = (change: number) => {
    if (change > 0) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (change < 0) {
      return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
    }
    return <div className="w-4 h-4 flex items-center justify-center text-gray-400">-</div>;
  };

  const getPositionBadge = (position: number) => {
    if (position === 1) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    if (position === 2) return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    if (position === 3) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
    return 'bg-muted text-muted-foreground';
  };

  const getScopeTitle = () => {
    switch (scope) {
      case 'company': return 'Ranking General';
      case 'area': return `Ranking del Área${area ? ` - ${area}` : ''}`;
      case 'team': return 'Ranking del Equipo';
      default: return 'Ranking';
    }
  };

  const getTimeframeLabel = () => {
    switch (timeframe) {
      case 'week': return 'Esta semana';
      case 'month': return 'Este mes';
      case 'quarter': return 'Este trimestre';
      case 'all': return 'Histórico';
      default: return 'Este mes';
    }
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (filteredData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center space-y-2">
              <Trophy className="h-8 w-8 mx-auto opacity-50" />
              <p>No hay datos de ranking disponibles</p>
              <p className="text-sm">Los rankings se actualizan diariamente</p>
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
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {getScopeTitle()}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{getTimeframeLabel()}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <Users className="h-3 w-3 mr-1" />
              {filteredData.length} participantes
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {filteredData.map((entry, index) => (
            <div
              key={entry.userId}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                entry.position <= 3 ? getPositionBadge(entry.position) : 'hover:bg-accent/50'
              }`}
              onClick={() => onUserClick?.(entry.userId)}
            >
              {/* Position */}
              <div className="flex items-center gap-2 w-12">
                {getPositionIcon(entry.position)}
                {showPositionChange && getPositionChangeIndicator(entry.change)}
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={entry.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getUserInitials(entry.name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{entry.name}</div>
                  <div className="text-sm text-muted-foreground">{entry.role}</div>
                  {scope === 'company' && (
                    <Badge variant="outline" className="text-xs mt-1">
                      {entry.area}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="font-bold text-lg">{entry.points.toLocaleString()}</div>
                  <div className="text-muted-foreground">Puntos</div>
                </div>
                
                <div className="text-center">
                  <div className="font-bold">{entry.completedObjectives}</div>
                  <div className="text-muted-foreground">Objetivos</div>
                </div>
                
                <div className="text-center">
                  <div className="font-bold">{entry.averageProgress}%</div>
                  <div className="text-muted-foreground">Progreso</div>
                </div>
                
                <div className="text-center">
                  <div className="font-bold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-orange-500" />
                    {entry.streak}
                  </div>
                  <div className="text-muted-foreground">Racha</div>
                </div>
              </div>

              {/* Top 3 special indicators */}
              {entry.position === 1 && (
                <Badge className="bg-yellow-500 text-white">
                  🏆 #1
                </Badge>
              )}
              {entry.position === 2 && (
                <Badge variant="secondary">
                  🥈 #2
                </Badge>
              )}
              {entry.position === 3 && (
                <Badge variant="outline">
                  🥉 #3
                </Badge>
              )}
            </div>
          ))}
        </div>

        {mockLeaderboardData.length > limit && (
          <div className="pt-4 border-t mt-4">
            <Button variant="outline" className="w-full">
              Ver ranking completo ({mockLeaderboardData.length - limit} más)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};