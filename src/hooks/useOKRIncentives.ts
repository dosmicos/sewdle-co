import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OKRIncentive {
  id: string;
  user_id: string;
  kr_id?: string;
  rule_key: string;
  status: 'pending' | 'approved' | 'paid';
  value_type: 'recognition' | 'bonus' | 'days';
  value_num?: number;
  created_at: string;
  updated_at: string;
}

export interface UserPoints {
  total_points: number;
  weekly_points: number;
  monthly_points: number;
  rank_position: number;
  achievements_count: number;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  points_required: number;
  category: string;
  available: boolean;
  icon: string;
}

export const useOKRIncentives = () => {
  const [incentives, setIncentives] = useState<OKRIncentive[]>([]);
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchIncentives = async () => {
    try {
      const { data, error } = await supabase
        .from('okr_incentive')
        .select('*')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIncentives(data || []);
    } catch (error) {
      console.error('Error fetching incentives:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los incentivos",
        variant: "destructive",
      });
    }
  };

  const fetchUserPoints = async () => {
    try {
      // Simulated data - replace with actual calculations
      const totalPoints = incentives
        .filter(i => i.status === 'approved' && i.value_type === 'bonus')
        .reduce((sum, i) => sum + (i.value_num || 0), 0);

      setUserPoints({
        total_points: totalPoints,
        weekly_points: Math.floor(totalPoints * 0.2),
        monthly_points: Math.floor(totalPoints * 0.8),
        rank_position: 2, // Simulated
        achievements_count: incentives.filter(i => i.value_type === 'recognition').length
      });
    } catch (error) {
      console.error('Error calculating user points:', error);
    }
  };

  const fetchRewards = async () => {
    // Simulated rewards data
    const mockRewards: Reward[] = [
      {
        id: '1',
        title: 'Día Libre Adicional',
        description: 'Un día de descanso extra',
        points_required: 500,
        category: 'time_off',
        available: true,
        icon: 'Calendar'
      },
      {
        id: '2',
        title: 'Voucher de Almuerzo',
        description: '$25 para restaurante local',
        points_required: 750,
        category: 'food',
        available: true,
        icon: 'UtensilsCrossed'
      },
      {
        id: '3',
        title: 'Curso de Capacitación',
        description: 'Certificación profesional',
        points_required: 1000,
        category: 'education',
        available: true,
        icon: 'GraduationCap'
      }
    ];
    setRewards(mockRewards);
  };

  const fetchLeaderboard = async () => {
    // Simulated leaderboard data
    const mockLeaderboard = [
      {
        id: '1',
        name: 'María González',
        initials: 'MG',
        position: 'Técnico de Calidad',
        total_points: 1420,
        weekly_points: 180,
        rank: 1,
        progress: 95
      },
      {
        id: '2',
        name: 'Usuario Actual',
        initials: 'UA',
        position: 'Tu posición',
        total_points: userPoints?.total_points || 1250,
        weekly_points: userPoints?.weekly_points || 150,
        rank: 2,
        progress: 85,
        isCurrentUser: true
      },
      {
        id: '3',
        name: 'Juan Pérez',
        initials: 'JP',
        position: 'Supervisor de Línea',
        total_points: 980,
        weekly_points: 120,
        rank: 3,
        progress: 75
      }
    ];
    setLeaderboard(mockLeaderboard);
  };

  const claimReward = async (rewardId: string) => {
    try {
      const reward = rewards.find(r => r.id === rewardId);
      if (!reward) return;

      if (!userPoints || userPoints.total_points < reward.points_required) {
        toast({
          title: "Puntos insuficientes",
          description: `Necesitas ${reward.points_required} puntos para canjear esta recompensa`,
          variant: "destructive",
        });
        return;
      }

      // Here you would implement the actual reward claiming logic
      toast({
        title: "¡Recompensa canjeada!",
        description: `Has canjeado: ${reward.title}`,
      });

      // Update user points
      setUserPoints(prev => prev ? {
        ...prev,
        total_points: prev.total_points - reward.points_required
      } : null);

    } catch (error) {
      console.error('Error claiming reward:', error);
      toast({
        title: "Error",
        description: "No se pudo canjear la recompensa",
        variant: "destructive",
      });
    }
  };

  const calculatePoints = async (krId: string, progressIncrease: number) => {
    try {
      // Simulate point calculation based on progress
      const basePoints = Math.floor(progressIncrease * 10);
      const bonusMultiplier = progressIncrease >= 0.25 ? 1.5 : 1; // Bonus for significant progress
      const finalPoints = Math.floor(basePoints * bonusMultiplier);

      // Create incentive record
      const { error } = await supabase
        .from('okr_incentive')
        .insert({
          organization_id: 'dosmicos-org-id', // This should come from context
          user_id: (await supabase.auth.getUser()).data.user?.id || '',
          kr_id: krId,
          rule_key: 'progress_update',
          status: 'approved',
          value_type: 'bonus',
          value_num: finalPoints
        });

      if (error) throw error;

      toast({
        title: "¡Puntos ganados!",
        description: `Has ganado ${finalPoints} puntos por tu progreso`,
      });

      await fetchIncentives();
      await fetchUserPoints();
    } catch (error) {
      console.error('Error calculating points:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchIncentives(),
        fetchRewards()
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  useEffect(() => {
    if (incentives.length > 0) {
      fetchUserPoints();
    }
  }, [incentives]);

  useEffect(() => {
    if (userPoints) {
      fetchLeaderboard();
    }
  }, [userPoints]);

  return {
    incentives,
    userPoints,
    rewards,
    leaderboard,
    loading,
    claimReward,
    calculatePoints,
    refetch: fetchIncentives
  };
};