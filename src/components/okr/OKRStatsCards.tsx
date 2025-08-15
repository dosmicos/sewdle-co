import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, TrendingUp, Users, Award, AlertTriangle, CheckCircle } from 'lucide-react';
import { useOKR } from '@/contexts/OKRContext';
import { useAuth } from '@/contexts/AuthContext';

interface OKRStatsCardsProps {
  variant?: 'overview' | 'personal' | 'area';
  ownerId?: string;
  area?: string;
}

export const OKRStatsCards: React.FC<OKRStatsCardsProps> = ({ 
  variant = 'overview',
  ownerId,
  area 
}) => {
  const { objectives, keyResults } = useOKR();
  const { user } = useAuth();

  // Filtrar datos según la variante
  const filteredObjectives = React.useMemo(() => {
    let filtered = objectives;
    
    if (variant === 'personal' && user) {
      filtered = objectives.filter(obj => obj.owner_id === user.id);
    } else if (variant === 'area' && area) {
      filtered = objectives.filter(obj => obj.area === area);
    } else if (ownerId) {
      filtered = objectives.filter(obj => obj.owner_id === ownerId);
    }
    
    return filtered;
  }, [objectives, variant, user, area, ownerId]);

  const filteredKeyResults = React.useMemo(() => {
    const objectiveIds = filteredObjectives.map(obj => obj.id);
    return keyResults.filter(kr => objectiveIds.includes(kr.objective_id));
  }, [keyResults, filteredObjectives]);

  // Calcular estadísticas
  const stats = React.useMemo(() => {
    const totalObjectives = filteredObjectives.length;
    const completedObjectives = filteredObjectives.filter(obj => {
      const objKeyResults = keyResults.filter(kr => kr.objective_id === obj.id);
      const avgProgress = objKeyResults.length > 0 
        ? objKeyResults.reduce((sum, kr) => sum + kr.progress_pct, 0) / objKeyResults.length
        : 0;
      return avgProgress >= 100;
    }).length;

    const inProgressObjectives = totalObjectives - completedObjectives;
    
    const avgProgress = filteredKeyResults.length > 0
      ? filteredKeyResults.reduce((sum, kr) => sum + kr.progress_pct, 0) / filteredKeyResults.length
      : 0;

    const totalKeyResults = filteredKeyResults.length;
    const completedKeyResults = filteredKeyResults.filter(kr => kr.progress_pct >= 100).length;
    
    const uniqueOwners = new Set(filteredObjectives.map(obj => obj.owner_id)).size;

    return {
      totalObjectives,
      completedObjectives,
      inProgressObjectives,
      avgProgress: Math.round(avgProgress),
      totalKeyResults,
      completedKeyResults,
      uniqueOwners
    };
  }, [filteredObjectives, filteredKeyResults, keyResults]);

  const getStatsConfig = () => {
    switch (variant) {
      case 'personal':
        return [
          {
            title: "Mis Objetivos",
            value: stats.totalObjectives,
            description: "Para este trimestre",
            icon: Target,
            color: "text-blue-500"
          },
          {
            title: "En Progreso",
            value: stats.inProgressObjectives,
            description: `Promedio ${stats.avgProgress}% completo`,
            icon: AlertTriangle,
            color: "text-yellow-500"
          },
          {
            title: "Completados",
            value: stats.completedObjectives,
            description: "¡Buen trabajo!",
            icon: CheckCircle,
            color: "text-green-500"
          }
        ];
      
      case 'area':
        return [
          {
            title: "Objetivos del Área",
            value: stats.totalObjectives,
            description: `${stats.uniqueOwners} colaboradores`,
            icon: Target,
            color: "text-blue-500"
          },
          {
            title: "Progreso Promedio",
            value: `${stats.avgProgress}%`,
            description: "Del área completa",
            icon: TrendingUp,
            color: "text-green-500"
          },
          {
            title: "Colaboradores Activos",
            value: stats.uniqueOwners,
            description: "Con objetivos asignados",
            icon: Users,
            color: "text-purple-500"
          },
          {
            title: "Key Results",
            value: `${stats.completedKeyResults}/${stats.totalKeyResults}`,
            description: "Completados",
            icon: Award,
            color: "text-orange-500"
          }
        ];
      
      default: // overview
        return [
          {
            title: "Objetivos Activos",
            value: stats.totalObjectives,
            description: `+${Math.floor(stats.totalObjectives * 0.1)} desde el mes pasado`,
            icon: Target,
            color: "text-blue-500"
          },
          {
            title: "Progreso Promedio",
            value: `${stats.avgProgress}%`,
            description: "+12% desde la semana pasada",
            icon: TrendingUp,
            color: "text-green-500"
          },
          {
            title: "Equipos Participando",
            value: stats.uniqueOwners,
            description: "Todas las áreas",
            icon: Users,
            color: "text-purple-500"
          },
          {
            title: "Objetivos Completados",
            value: stats.completedObjectives,
            description: "Este trimestre",
            icon: Award,
            color: "text-orange-500"
          }
        ];
    }
  };

  const statsConfig = getStatsConfig();

  return (
    <div className={`grid grid-cols-1 gap-4 ${
      variant === 'personal' ? 'md:grid-cols-3' : 'md:grid-cols-4'
    }`}>
      {statsConfig.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};