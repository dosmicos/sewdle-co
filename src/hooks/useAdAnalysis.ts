import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────

export interface AdAnalysisReport {
  id: string;
  organization_id: string;
  report_date: string;
  executive_summary: string | null;
  alerts: Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    ad_ids?: string[];
  }> | null;
  metrics_snapshot: Record<string, unknown> | null;
  full_analysis: string | null;
  autonomy_level_at_time: number | null;
  memories_used: number | null;
  created_at: string;
}

export interface AdRecommendation {
  id: string;
  organization_id: string;
  report_id: string | null;
  recommendation_date: string;
  category: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
  action: string;
  rationale: string | null;
  affected_ad_ids: string[] | null;
  confidence: number | null;
  executed: boolean;
  executed_at: string | null;
  executed_by: string | null;
  auto_executed: boolean;
  metrics_before: Record<string, number> | null;
  outcome_measured_at: string | null;
  metrics_after: Record<string, number> | null;
  outcome_delta: Record<string, number> | null;
  accuracy_score: number | null;
  created_at: string;
}

export interface AgentStatus {
  autonomy_level: number;
  autonomy_label: string;
  accuracy: number;
  total_recommendations: number;
  total_executed: number;
}

export interface AgentLearning {
  id: string;
  organization_id: string;
  category: string;
  content: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'seed' | 'agent' | 'human';
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentBenchmark {
  id: string;
  organization_id: string;
  metric_name: string;
  good_threshold: number;
  average_threshold: number;
  bad_threshold: number;
  source: 'initial' | 'dynamic';
  last_calculated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRule {
  id: string;
  organization_id: string;
  rule_text: string;
  times_applied: number;
  times_correct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Hook ───────────────────────────────────────────────────────

export function useAdAnalysis() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();

  // Reportes de los últimos 7 días
  const reportsQuery = useQuery({
    queryKey: ['ad-analysis-reports', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await (supabase as any)
        .from('ad_analysis_reports')
        .select('*')
        .eq('organization_id', orgId)
        .gte('report_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('report_date', { ascending: false });

      if (error) throw error;
      return (data || []) as AdAnalysisReport[];
    },
    enabled: !!orgId,
  });

  // Recomendaciones pendientes
  const pendingRecsQuery = useQuery({
    queryKey: ['ad-recommendations-pending', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await (supabase as any)
        .from('ad_recommendations_log')
        .select('*')
        .eq('organization_id', orgId)
        .eq('executed', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as AdRecommendation[];
    },
    enabled: !!orgId,
  });

  // Todas las recomendaciones recientes (para historial)
  const allRecsQuery = useQuery({
    queryKey: ['ad-recommendations-all', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await (supabase as any)
        .from('ad_recommendations_log')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as AdRecommendation[];
    },
    enabled: !!orgId,
  });

  // Agent status
  const agentStatusQuery = useQuery({
    queryKey: ['agent-status', orgId],
    queryFn: async (): Promise<AgentStatus> => {
      if (!orgId) {
        return {
          autonomy_level: 1,
          autonomy_label: 'Observando',
          accuracy: 0,
          total_recommendations: 0,
          total_executed: 0,
        };
      }

      // Obtener autonomy_level de ad_accounts
      const { data: accounts } = await (supabase as any)
        .from('ad_accounts')
        .select('agent_autonomy_level')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .limit(1);

      const level = accounts?.[0]?.agent_autonomy_level ?? 1;

      // Obtener accuracy promedio de últimas 20
      const { data: recentScores } = await (supabase as any)
        .from('ad_recommendations_log')
        .select('accuracy_score')
        .eq('organization_id', orgId)
        .not('accuracy_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      const scored = (recentScores || []).filter(
        (r: any) => r.accuracy_score !== null
      );
      const avgAccuracy =
        scored.length > 0
          ? scored.reduce((s: number, r: any) => s + Number(r.accuracy_score), 0) /
            scored.length
          : 0;

      // Counts
      const { count: totalRecs } = await (supabase as any)
        .from('ad_recommendations_log')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      const { count: totalExec } = await (supabase as any)
        .from('ad_recommendations_log')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('executed', true);

      const labels: Record<number, string> = {
        1: 'Observando',
        2: 'Recomendando',
        3: 'Actuando',
      };

      return {
        autonomy_level: level,
        autonomy_label: labels[level] || 'Observando',
        accuracy: Number(avgAccuracy.toFixed(2)),
        total_recommendations: totalRecs ?? 0,
        total_executed: totalExec ?? 0,
      };
    },
    enabled: !!orgId,
  });

  // Learnings del agente
  const learningsQuery = useQuery({
    queryKey: ['agent-learnings', orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('agent_learnings')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AgentLearning[];
    },
    enabled: !!orgId,
  });

  // Benchmarks del agente
  const benchmarksQuery = useQuery({
    queryKey: ['agent-benchmarks', orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('agent_benchmarks')
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return (data || []) as AgentBenchmark[];
    },
    enabled: !!orgId,
  });

  // Reglas del agente
  const rulesQuery = useQuery({
    queryKey: ['agent-rules', orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('agent_rules')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('is_active', true)
        .order('times_correct', { ascending: false });
      if (error) throw error;
      return (data || []) as AgentRule[];
    },
    enabled: !!orgId,
  });

  // Mutation: marcar recomendación como ejecutada
  const executeRecMutation = useMutation({
    mutationFn: async (recId: string) => {
      const { error } = await (supabase as any)
        .from('ad_recommendations_log')
        .update({
          executed: true,
          executed_at: new Date().toISOString(),
          executed_by: 'human',
        })
        .eq('id', recId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Recomendacion marcada como ejecutada');
      queryClient.invalidateQueries({ queryKey: ['ad-recommendations-pending', orgId] });
      queryClient.invalidateQueries({ queryKey: ['ad-recommendations-all', orgId] });
      queryClient.invalidateQueries({ queryKey: ['agent-status', orgId] });
    },
    onError: (err: Error) => {
      toast.error(`Error: ${err.message}`);
    },
  });

  // Mutation: ignorar recomendación (marcar como ejecutada pero por "ignored")
  const ignoreRecMutation = useMutation({
    mutationFn: async (recId: string) => {
      const { error } = await (supabase as any)
        .from('ad_recommendations_log')
        .update({
          executed: true,
          executed_at: new Date().toISOString(),
          executed_by: 'ignored',
        })
        .eq('id', recId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Recomendacion ignorada');
      queryClient.invalidateQueries({ queryKey: ['ad-recommendations-pending', orgId] });
      queryClient.invalidateQueries({ queryKey: ['ad-recommendations-all', orgId] });
    },
    onError: (err: Error) => {
      toast.error(`Error: ${err.message}`);
    },
  });

  return {
    // Reportes
    reports: reportsQuery.data || [],
    reportsLoading: reportsQuery.isLoading,

    // Recomendaciones pendientes
    pendingRecommendations: pendingRecsQuery.data || [],
    pendingLoading: pendingRecsQuery.isLoading,

    // Todas las recomendaciones
    allRecommendations: allRecsQuery.data || [],

    // Agent status
    agentStatus: agentStatusQuery.data || {
      autonomy_level: 1,
      autonomy_label: 'Observando',
      accuracy: 0,
      total_recommendations: 0,
      total_executed: 0,
    },
    statusLoading: agentStatusQuery.isLoading,

    // Conocimiento del agente
    learnings: learningsQuery.data || [],
    learningsLoading: learningsQuery.isLoading,
    benchmarks: benchmarksQuery.data || [],
    benchmarksLoading: benchmarksQuery.isLoading,
    rules: rulesQuery.data || [],
    rulesLoading: rulesQuery.isLoading,

    // Mutations
    executeRecommendation: executeRecMutation.mutate,
    ignoreRecommendation: ignoreRecMutation.mutate,
    executingRec: executeRecMutation.isPending,
    ignoringRec: ignoreRecMutation.isPending,
  };
}
