import { useMemo } from 'react';
import { useOKR } from '@/contexts/OKRContext';
import { useAuth } from '@/contexts/AuthContext';

interface OKRStats {
  // Estadísticas generales
  totalObjectives: number;
  activeObjectives: number;
  completedObjectives: number;
  
  // Progreso
  averageProgress: number;
  totalKeyResults: number;
  completedKeyResults: number;
  
  // Por área/usuario
  objectivesByArea: Record<string, number>;
  progressByArea: Record<string, number>;
  userStats: {
    userId: string;
    objectivesCount: number;
    averageProgress: number;
    completedObjectives: number;
  }[];
  
  // Tendencias (mock data por ahora)
  progressTrend: number;
  completionRate: number;
  
  // Filtros específicos
  getStatsByUser: (userId: string) => {
    objectives: number;
    keyResults: number;
    averageProgress: number;
    completed: number;
  };
  
  getStatsByArea: (area: string) => {
    objectives: number;
    averageProgress: number;
    activeUsers: number;
  };
  
  getStatsByQuarter: (quarterStart: string, quarterEnd: string) => {
    objectives: number;
    keyResults: number;
    averageProgress: number;
  };
}

export const useOKRStats = (): OKRStats => {
  const { objectives, keyResults } = useOKR();
  const { user } = useAuth();

  return useMemo(() => {
    // Estadísticas básicas
    const totalObjectives = objectives.length;
    const activeObjectives = objectives.filter(obj => {
      const now = new Date();
      const start = new Date(obj.period_start);
      const end = new Date(obj.period_end);
      return now >= start && now <= end;
    }).length;

    // Calcular objetivos completados (promedio de KRs >= 100%)
    const completedObjectives = objectives.filter(obj => {
      const objKeyResults = keyResults.filter(kr => kr.objective_id === obj.id);
      if (objKeyResults.length === 0) return false;
      const avgProgress = objKeyResults.reduce((sum, kr) => sum + (Number(kr.progress_pct) || 0), 0) / objKeyResults.length;
      return avgProgress >= 100;
    }).length;

    const averageProgress = keyResults.length > 0
      ? keyResults.reduce((sum, kr) => sum + (Number(kr.progress_pct) || 0), 0) / keyResults.length
      : 0;

    const totalKeyResults = keyResults.length;
    const completedKeyResults = keyResults.filter(kr => (Number(kr.progress_pct) || 0) >= 100).length;

    // Estadísticas por área
    const objectivesByArea = objectives.reduce((acc, obj) => {
      const area = obj.area || 'sin_area';
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const progressByArea = Object.keys(objectivesByArea).reduce((acc, area) => {
      const areaObjectives = objectives.filter(obj => (obj.area || 'sin_area') === area);
      const areaKeyResults = keyResults.filter(kr => 
        areaObjectives.some(obj => obj.id === kr.objective_id)
      );
      
      acc[area] = areaKeyResults.length > 0
        ? areaKeyResults.reduce((sum, kr) => sum + (Number(kr.progress_pct) || 0), 0) / areaKeyResults.length
        : 0;
      
      return acc;
    }, {} as Record<string, number>);

    // Estadísticas por usuario
    const userStats = Array.from(new Set(objectives.map(obj => obj.owner_id))).map(userId => {
      const userObjectives = objectives.filter(obj => obj.owner_id === userId);
      const userKeyResults = keyResults.filter(kr => 
        userObjectives.some(obj => obj.id === kr.objective_id)
      );
      
      const userAverageProgress = userKeyResults.length > 0
        ? userKeyResults.reduce((sum, kr) => sum + (Number(kr.progress_pct) || 0), 0) / userKeyResults.length
        : 0;
      
      const userCompletedObjectives = userObjectives.filter(obj => {
        const objKeyResults = keyResults.filter(kr => kr.objective_id === obj.id);
        if (objKeyResults.length === 0) return false;
        const avgProgress = objKeyResults.reduce((sum, kr) => sum + (Number(kr.progress_pct) || 0), 0) / objKeyResults.length;
        return avgProgress >= 100;
      }).length;

      return {
        userId,
        objectivesCount: userObjectives.length,
        averageProgress: userAverageProgress,
        completedObjectives: userCompletedObjectives
      };
    });

    // Funciones de filtro
    const getStatsByUser = (userId: string) => {
      const userObjectives = objectives.filter(obj => obj.owner_id === userId);
      const userKeyResults = keyResults.filter(kr => 
        userObjectives.some(obj => obj.id === kr.objective_id)
      );
      
      const avgProgress = userKeyResults.length > 0
        ? userKeyResults.reduce((sum, kr) => sum + (Number(kr.progress_pct) || 0), 0) / userKeyResults.length
        : 0;
      
      const completed = userObjectives.filter(obj => {
        const objKeyResults = keyResults.filter(kr => kr.objective_id === obj.id);
        if (objKeyResults.length === 0) return false;
        const objAvgProgress = objKeyResults.reduce((sum, kr) => sum + (Number(kr.progress_pct) || 0), 0) / objKeyResults.length;
        return objAvgProgress >= 100;
      }).length;

      return {
        objectives: userObjectives.length,
        keyResults: userKeyResults.length,
        averageProgress: avgProgress,
        completed
      };
    };

    const getStatsByArea = (area: string) => {
      const areaObjectives = objectives.filter(obj => obj.area === area);
      const areaKeyResults = keyResults.filter(kr => 
        areaObjectives.some(obj => obj.id === kr.objective_id)
      );
      
      const avgProgress = areaKeyResults.length > 0
        ? areaKeyResults.reduce((sum, kr) => sum + (Number(kr.progress_pct) || 0), 0) / areaKeyResults.length
        : 0;
      
      const activeUsers = new Set(areaObjectives.map(obj => obj.owner_id)).size;

      return {
        objectives: areaObjectives.length,
        averageProgress: avgProgress,
        activeUsers
      };
    };

    const getStatsByQuarter = (quarterStart: string, quarterEnd: string) => {
      const quarterObjectives = objectives.filter(obj => {
        const objStart = new Date(obj.period_start);
        const objEnd = new Date(obj.period_end);
        const qStart = new Date(quarterStart);
        const qEnd = new Date(quarterEnd);
        
        // Objetivos que se solapan con el trimestre
        return objStart <= qEnd && objEnd >= qStart;
      });
      
      const quarterKeyResults = keyResults.filter(kr => 
        quarterObjectives.some(obj => obj.id === kr.objective_id)
      );
      
      const avgProgress = quarterKeyResults.length > 0
        ? quarterKeyResults.reduce((sum, kr) => sum + (Number(kr.progress_pct) || 0), 0) / quarterKeyResults.length
        : 0;

      return {
        objectives: quarterObjectives.length,
        keyResults: quarterKeyResults.length,
        averageProgress: avgProgress
      };
    };

    // Mock data para tendencias (en futuro viene de analytics)
    const progressTrend = 12; // +12% from last period
    const completionRate = totalObjectives > 0 ? (completedObjectives / totalObjectives) * 100 : 0;

    return {
      totalObjectives,
      activeObjectives,
      completedObjectives,
      averageProgress,
      totalKeyResults,
      completedKeyResults,
      objectivesByArea,
      progressByArea,
      userStats,
      progressTrend,
      completionRate,
      getStatsByUser,
      getStatsByArea,
      getStatsByQuarter
    };
  }, [objectives, keyResults, user]);
};