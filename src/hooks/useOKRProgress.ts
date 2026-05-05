import { useMemo } from 'react';
import { useOKR } from '@/contexts/OKRContext';

interface ProgressData {
  objectiveId: string;
  objectiveTitle: string;
  ownerUserId: string;
  keyResults: {
    id: string;
    title: string;
    progress: number;
    target: number;
    current: number;
    unit: string;
    confidence: 'low' | 'med' | 'high';
    trend: 'up' | 'down' | 'stable';
    lastUpdate: string;
  }[];
  overallProgress: number;
  riskLevel: 'low' | 'medium' | 'high';
  daysRemaining: number;
  isOnTrack: boolean;
}

interface ProgressMetrics {
  progressData: ProgressData[];
  overallCompanyProgress: number;
  progressByArea: Record<string, number>;
  riskDistribution: Record<string, number>;
  
  // Helper functions
  getProgressByObjective: (objectiveId: string) => ProgressData | null;
  getProgressByUser: (userId: string) => ProgressData[];
  getProgressByArea: (area: string) => ProgressData[];
  getAtRiskObjectives: () => ProgressData[];
  getTopPerformers: () => ProgressData[];
}

export const useOKRProgress = (): ProgressMetrics => {
  const { objectives, keyResults, checkins } = useOKR();

  return useMemo(() => {
    // Calcular datos de progreso para cada objetivo
    const progressData: ProgressData[] = objectives.map(objective => {
      const objKeyResults = keyResults.filter(kr => kr.objective_id === objective.id);
      
      // Mapear Key Results con información de progreso
      const keyResultsData = objKeyResults.map(kr => {
        const krCheckins = checkins.filter(c => c.kr_id === kr.id);
        const lastCheckin = krCheckins.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        // Calcular tendencia basada en check-ins recientes
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (krCheckins.length >= 2) {
          const recent = krCheckins.slice(0, 2);
          const current = recent[0];
          const previous = recent[1];
          const cPct = Number(current.progress_pct);
          const pPct = Number(previous.progress_pct);
          if (Number.isFinite(cPct) && Number.isFinite(pPct)) {
            if (cPct > pPct) trend = 'up';
            else if (cPct < pPct) trend = 'down';
          }
        }

        const progressPct = Number(kr.progress_pct);
        const safeProgress = Number.isFinite(progressPct) ? progressPct : 0;
        const targetVal = Number(kr.target_value);
        const currentVal = Number(kr.current_value);

        return {
          id: kr.id,
          title: kr.title,
          progress: safeProgress,
          target: Number.isFinite(targetVal) ? targetVal : 0,
          current: Number.isFinite(currentVal) ? currentVal : 0,
          unit: kr.unit,
          confidence: kr.confidence,
          trend,
          lastUpdate: lastCheckin?.created_at || kr.updated_at
        };
      });

      // Calcular progreso general del objetivo
      const overallProgress = objKeyResults.length > 0
        ? objKeyResults.reduce((sum, kr) => sum + (Number(kr.progress_pct) || 0), 0) / objKeyResults.length
        : 0;

      // Calcular días restantes
      const endDate = new Date(objective.period_end);
      const today = new Date();
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

      // Determinar nivel de riesgo
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      const startDate = new Date(objective.period_start);
      const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const timeProgress = daysRemaining > 0 && totalDays > 0
        ? (1 - daysRemaining / totalDays) * 100
        : 100;

      if (overallProgress < timeProgress - 20) riskLevel = 'high';
      else if (overallProgress < timeProgress - 10) riskLevel = 'medium';

      // Determinar si está en buen camino
      const isOnTrack = overallProgress >= timeProgress - 10;

      return {
        objectiveId: objective.id,
        objectiveTitle: objective.title,
        ownerUserId: objective.owner_id,
        keyResults: keyResultsData,
        overallProgress,
        riskLevel,
        daysRemaining,
        isOnTrack
      };
    });

    // Calcular progreso general de la empresa
    const overallCompanyProgress = progressData.length > 0
      ? progressData.reduce((sum, obj) => sum + obj.overallProgress, 0) / progressData.length
      : 0;

    // Progreso por área
    const progressByArea = objectives.reduce((acc, obj) => {
      const area = obj.area || 'sin_area';
      const objProgress = (Number(progressData.find(p => p.objectiveId === obj.id)?.overallProgress) || 0);
      
      if (!acc[area]) {
        acc[area] = { total: 0, count: 0 };
      }
      acc[area].total += objProgress;
      acc[area].count += 1;
      
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    const progressByAreaFinal = Object.keys(progressByArea).reduce((acc, area) => {
      acc[area] = progressByArea[area].count > 0 
        ? progressByArea[area].total / progressByArea[area].count 
        : 0;
      return acc;
    }, {} as Record<string, number>);

    // Distribución de riesgo
    const riskDistribution = progressData.reduce((acc, obj) => {
      acc[obj.riskLevel] = (acc[obj.riskLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Helper functions
    const getProgressByObjective = (objectiveId: string): ProgressData | null => {
      return progressData.find(p => p.objectiveId === objectiveId) || null;
    };

    const getProgressByUser = (userId: string): ProgressData[] => {
      return progressData.filter(p => p.ownerUserId === userId);
    };

    const getProgressByArea = (area: string): ProgressData[] => {
      const areaObjectiveIds = objectives
        .filter(obj => obj.area === area)
        .map(obj => obj.id);
      
      return progressData.filter(p => areaObjectiveIds.includes(p.objectiveId));
    };

    const getAtRiskObjectives = (): ProgressData[] => {
      return progressData
        .filter(p => p.riskLevel === 'high' || p.riskLevel === 'medium')
        .sort((a, b) => {
          // Ordenar por nivel de riesgo y luego por progreso
          if (a.riskLevel === 'high' && b.riskLevel !== 'high') return -1;
          if (a.riskLevel !== 'high' && b.riskLevel === 'high') return 1;
          return a.overallProgress - b.overallProgress;
        });
    };

    const getTopPerformers = (): ProgressData[] => {
      return progressData
        .filter(p => p.overallProgress >= 70)
        .sort((a, b) => b.overallProgress - a.overallProgress)
        .slice(0, 10);
    };

    return {
      progressData,
      overallCompanyProgress,
      progressByArea: progressByAreaFinal,
      riskDistribution,
      getProgressByObjective,
      getProgressByUser,
      getProgressByArea,
      getAtRiskObjectives,
      getTopPerformers
    };
  }, [objectives, keyResults, checkins]);
};