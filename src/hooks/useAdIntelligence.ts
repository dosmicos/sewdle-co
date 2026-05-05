import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface PerformancePattern {
  dimension: string;
  dimension_value: string;
  period_type: string;
  total_ads: number;
  total_spend: number;
  total_revenue: number;
  total_purchases: number;
  avg_roas: number;
  avg_cpa: number;
  avg_ctr: number;
  avg_hook_rate: number | null;
  roas_rank: number;
}

export interface AdLifecycleSummary {
  ad_id: string;
  ad_name: string | null;
  current_status: string;
  days_active: number;
  lifetime_spend: number;
  lifetime_revenue: number;
  lifetime_roas: number;
  lifetime_cpa: number;
  fatigue_start_date: string | null;
  days_to_fatigue: number | null;
}

async function fetchPatterns(
  orgId: string,
  periodType: string
): Promise<PerformancePattern[]> {
  const { data, error } = await supabase
    .from('performance_patterns')
    .select('*')
    .eq('organization_id', orgId)
    .eq('period_type', periodType)
    .order('dimension', { ascending: true })
    .order('roas_rank', { ascending: true });

  if (error) {
    console.error('Error fetching patterns:', error);
    return [];
  }

  return (data || []) as PerformancePattern[];
}

async function fetchLifecycles(orgId: string): Promise<AdLifecycleSummary[]> {
  const { data, error } = await supabase
    .from('ad_lifecycle')
    .select('*')
    .eq('organization_id', orgId)
    .order('lifetime_spend', { ascending: false });

  if (error) {
    console.error('Error fetching lifecycles:', error);
    return [];
  }

  return (data || []) as AdLifecycleSummary[];
}

export function useAdIntelligence(periodType: string = '7d') {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const [computing, setComputing] = useState(false);

  const { data: patterns, isLoading: patternsLoading } = useQuery({
    queryKey: ['ad-intelligence', 'patterns', orgId, periodType],
    queryFn: () => fetchPatterns(orgId!, periodType),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: lifecycles, isLoading: lifecyclesLoading } = useQuery({
    queryKey: ['ad-intelligence', 'lifecycles', orgId],
    queryFn: () => fetchLifecycles(orgId!),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const computeIntelligence = useCallback(async () => {
    if (!orgId) {
      toast.error('No hay organización seleccionada');
      return false;
    }

    setComputing(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'compute-ad-intelligence',
        { body: { organizationId: orgId } }
      );

      if (error) throw error;

      if (data.success) {
        toast.success(
          `Intelligence computed: ${data.lifecycle} lifecycles, ${data.weeklySummaries} weekly, ${data.patterns} patterns`
        );
        queryClient.invalidateQueries({ queryKey: ['ad-intelligence'] });
        return true;
      } else {
        toast.error(data.error || 'Error al computar inteligencia');
        return false;
      }
    } catch (error: any) {
      console.error('Error computing intelligence:', error);
      toast.error('Error al computar inteligencia');
      return false;
    } finally {
      setComputing(false);
    }
  }, [orgId, queryClient]);

  // Group patterns by dimension
  const patternsByDimension = new Map<string, PerformancePattern[]>();
  for (const p of patterns || []) {
    const existing = patternsByDimension.get(p.dimension) || [];
    existing.push(p);
    patternsByDimension.set(p.dimension, existing);
  }

  return {
    patterns: patterns ?? [],
    patternsByDimension,
    lifecycles: lifecycles ?? [],
    isLoading: patternsLoading || lifecyclesLoading,
    computing,
    computeIntelligence,
  };
}
