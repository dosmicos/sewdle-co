import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Star, Gift, TrendingUp, Award, Target, Zap } from 'lucide-react';

interface IncentivesDashboardProps {
  selectedQuarter?: string;
}

export const IncentivesDashboard: React.FC<IncentivesDashboardProps> = ({
  selectedQuarter
}) => {
  // Mock data - in real app this would come from context/API
  const userPoints = 1250;
  const quarterGoal = 2000;
  const progressPct = (userPoints / quarterGoal) * 100;
  
  const achievements = [
    {
      id: '1',
      title: 'Early Bird',
      description: 'Completar check-ins en los primeros 3 días',
      icon: '🌅',
      points: 100,
      unlocked: true,
      date: '2024-01-15'
    },
    {
      id: '2',
      title: 'Goal Crusher',
      description: 'Superar el 100% en un resultado clave',
      icon: '💪',
      points: 200,
      unlocked: true,
      date: '2024-01-20'
    },
    {
      id: '3',
      title: 'Team Player',
      description: 'Ayudar a 3 compañeros con sus objetivos',
      icon: '🤝',
      points: 150,
      unlocked: false,
      progress: 2,
      total: 3
    },
    {
      id: '4',
      title: 'Consistency Master',
      description: 'Hacer check-ins 4 semanas seguidas',
      icon: '📈',
      points: 300,
      unlocked: false,
      progress: 3,
      total: 4
    }
  ];

  const rewards = [
    {
      id: '1',
      title: 'Día Libre Extra',
      description: 'Un día libre adicional para usar cuando quieras',
      cost: 1500,
      category: 'time',
      available: true,
      icon: '🏖️'
    },
    {
      id: '2',
      title: 'Gift Card $50',
      description: 'Gift card de $50 para Amazon o restaurantes',
      cost: 1000,
      category: 'gift',
      available: true,
      icon: '🎁'
    },
    {
      id: '3',
      title: 'Parking Premium',
      description: 'Espacio de parking premium por 1 mes',
      cost: 800,
      category: 'benefit',
      available: true,
      icon: '🚗'
    },
    {
      id: '4',
      title: 'Home Office Setup',
      description: 'Subsidio de $200 para mejorar tu home office',
      cost: 2000,
      category: 'equipment',
      available: false,
      icon: '💻'
    }
  ];

  const leaderboard = [
    { rank: 1, name: 'Ana García', points: 1850, trend: 'up' },
    { rank: 2, name: 'Carlos López', points: 1620, trend: 'up' },
    { rank: 3, name: 'María Rodriguez', points: 1580, trend: 'down' },
    { rank: 4, name: 'Tú', points: userPoints, trend: 'up', isCurrentUser: true },
    { rank: 5, name: 'Pedro Martín', points: 1180, trend: 'up' }
  ];

  return (
    <div className="space-y-6">
      {/* Points Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Puntos Actuales</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{userPoints.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {quarterGoal - userPoints} puntos para la meta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progreso Trimestre</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(progressPct)}%</div>
            <Progress value={progressPct} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ranking</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#4</div>
            <p className="text-xs text-muted-foreground">
              de {leaderboard.length} en tu área
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="achievements" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="achievements">
            <Award className="h-4 w-4 mr-2" />
            Logros
          </TabsTrigger>
          <TabsTrigger value="rewards">
            <Gift className="h-4 w-4 mr-2" />
            Recompensas
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <Trophy className="h-4 w-4 mr-2" />
            Ranking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logros y Desafíos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {achievements.map((achievement) => (
                  <Card key={achievement.id} className={achievement.unlocked ? 'bg-primary/5 border-primary/20' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">{achievement.icon}</div>
                          <div className="flex-1">
                            <h4 className="font-semibold flex items-center gap-2">
                              {achievement.title}
                              {achievement.unlocked && (
                                <Badge variant="default" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Desbloqueado
                                </Badge>
                              )}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {achievement.description}
                            </p>
                            
                            {!achievement.unlocked && achievement.progress !== undefined && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span>Progreso</span>
                                  <span>{achievement.progress}/{achievement.total}</span>
                                </div>
                                <Progress 
                                  value={(achievement.progress / achievement.total) * 100} 
                                  className="h-2 mt-1" 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-medium text-primary">
                            +{achievement.points} pts
                          </div>
                          {achievement.unlocked && achievement.date && (
                            <div className="text-xs text-muted-foreground">
                              {new Date(achievement.date).toLocaleDateString('es-ES')}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Catálogo de Recompensas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {rewards.map((reward) => (
                  <Card key={reward.id} className={!reward.available ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">{reward.icon}</div>
                          <div className="flex-1">
                            <h4 className="font-semibold">{reward.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {reward.description}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-bold text-primary">
                            {reward.cost} pts
                          </div>
                          <Button 
                            size="sm" 
                            className="mt-2"
                            disabled={!reward.available || userPoints < reward.cost}
                          >
                            {userPoints < reward.cost ? 'Insuficiente' : 'Canjear'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ranking del Trimestre</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaderboard.map((entry) => (
                  <div 
                    key={entry.rank} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      entry.isCurrentUser ? 'bg-primary/5 border-primary/20' : 'bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        entry.rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        {entry.rank <= 3 && entry.rank === 1 && '🥇'}
                        {entry.rank <= 3 && entry.rank === 2 && '🥈'}
                        {entry.rank <= 3 && entry.rank === 3 && '🥉'}
                        {entry.rank > 3 && entry.rank}
                      </div>
                      
                      <div>
                        <div className="font-medium">
                          {entry.name}
                          {entry.isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">Tú</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <span>{entry.points.toLocaleString()} puntos</span>
                          {entry.trend === 'up' ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : (
                            <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t">
                <div className="text-center">
                  <Button variant="outline">
                    Ver Ranking Completo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};