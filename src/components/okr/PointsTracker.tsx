import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Star, 
  TrendingUp, 
  Award, 
  Target, 
  Calendar,
  Trophy,
  Flame,
  ArrowUp
} from 'lucide-react';

interface PointsData {
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  currentStreak: number;
  longestStreak: number;
  weeklyGoal: number;
  monthlyGoal: number;
  nextRewardThreshold: number;
  recentActivity: Array<{
    date: string;
    points: number;
    reason: string;
    type: 'objective' | 'checkin' | 'collaboration' | 'bonus';
  }>;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    unlockedDate: string;
    points: number;
  }>;
}

interface PointsTrackerProps {
  data?: PointsData;
  compact?: boolean;
  showRecentActivity?: boolean;
}

// Mock data - en producción vendría del backend
const mockPointsData: PointsData = {
  totalPoints: 1250,
  weeklyPoints: 180,
  monthlyPoints: 850,
  currentStreak: 7,
  longestStreak: 14,
  weeklyGoal: 200,
  monthlyGoal: 1000,
  nextRewardThreshold: 1500,
  recentActivity: [
    { date: '2024-03-15', points: 50, reason: 'Check-in diario completado', type: 'checkin' },
    { date: '2024-03-14', points: 100, reason: 'Objetivo completado: Mejorar eficiencia', type: 'objective' },
    { date: '2024-03-13', points: 30, reason: 'Ayuda a compañero', type: 'collaboration' },
    { date: '2024-03-12', points: 25, reason: 'Racha de 5 días', type: 'bonus' },
  ],
  achievements: [
    { id: '1', name: 'Primera Meta', description: 'Completar primer objetivo', unlockedDate: '2024-03-01', points: 100 },
    { id: '2', name: 'Colaborador', description: 'Ayudar a 3 compañeros', unlockedDate: '2024-03-10', points: 150 },
    { id: '3', name: 'Constante', description: '7 días consecutivos de check-ins', unlockedDate: '2024-03-15', points: 200 },
  ]
};

export const PointsTracker: React.FC<PointsTrackerProps> = ({
  data = mockPointsData,
  compact = false,
  showRecentActivity = true
}) => {
  const weeklyProgress = (data.weeklyPoints / data.weeklyGoal) * 100;
  const monthlyProgress = (data.monthlyPoints / data.monthlyGoal) * 100;
  const nextRewardProgress = (data.totalPoints / data.nextRewardThreshold) * 100;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'objective': return Target;
      case 'checkin': return TrendingUp;
      case 'collaboration': return Award;
      case 'bonus': return Star;
      default: return Star;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'objective': return 'text-green-600';
      case 'checkin': return 'text-blue-600';
      case 'collaboration': return 'text-purple-600';
      case 'bonus': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="font-semibold">{data.totalPoints.toLocaleString()} puntos</div>
                <div className="text-sm text-muted-foreground">+{data.weeklyPoints} esta semana</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Flame className="h-3 w-3" />
                {data.currentStreak} días
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Points Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Seguimiento de Puntos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Points Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <div className="text-2xl font-bold text-primary">{data.totalPoints.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Puntos Totales</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{data.weeklyPoints}</div>
              <div className="text-sm text-muted-foreground">Esta Semana</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{data.monthlyPoints}</div>
              <div className="text-sm text-muted-foreground">Este Mes</div>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Meta Semanal</span>
                <span>{data.weeklyPoints} / {data.weeklyGoal} puntos</span>
              </div>
              <Progress value={weeklyProgress} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {weeklyProgress >= 100 ? '¡Meta alcanzada!' : `${Math.round(100 - weeklyProgress)}% restante`}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Meta Mensual</span>
                <span>{data.monthlyPoints} / {data.monthlyGoal} puntos</span>
              </div>
              <Progress value={monthlyProgress} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {monthlyProgress >= 100 ? '¡Meta alcanzada!' : `${Math.round(100 - monthlyProgress)}% restante`}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Próxima Recompensa</span>
                <span>{data.totalPoints} / {data.nextRewardThreshold} puntos</span>
              </div>
              <Progress value={nextRewardProgress} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {data.nextRewardThreshold - data.totalPoints} puntos restantes
              </div>
            </div>
          </div>

          {/* Streak Info */}
          <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="flex items-center gap-3">
              <Flame className="h-6 w-6 text-orange-500" />
              <div>
                <div className="font-semibold">Racha Actual: {data.currentStreak} días</div>
                <div className="text-sm text-muted-foreground">
                  Récord personal: {data.longestStreak} días
                </div>
              </div>
            </div>
            {data.currentStreak === data.longestStreak && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                ¡Nuevo récord!
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {showRecentActivity && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentActivity.map((activity, index) => {
                const IconComponent = getActivityIcon(activity.type);
                const colorClass = getActivityColor(activity.type);
                
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconComponent className={`h-4 w-4 ${colorClass}`} />
                      <div>
                        <div className="text-sm font-medium">{activity.reason}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(activity.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <Badge variant="outline" className="flex items-center gap-1">
                      <ArrowUp className="h-3 w-3 text-green-500" />
                      +{activity.points}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Logros Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.achievements.slice(-3).reverse().map((achievement) => (
              <div key={achievement.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <Badge variant="secondary">+{achievement.points}</Badge>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{achievement.name}</h4>
                  <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Desbloqueado: {new Date(achievement.unlockedDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};