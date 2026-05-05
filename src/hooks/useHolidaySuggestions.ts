import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { MarketingEventInput, EventType } from './useMarketingEvents';
import { useMarketingEvents } from './useMarketingEvents';

export interface HolidaySuggestion {
  id: string;
  org_id: string;
  name: string;
  date: string;
  market: 'co' | 'us' | 'both';
  category: 'cultural' | 'commercial' | 'brand' | 'seasonal';
  expected_impact: 'high' | 'medium' | 'low';
  why_now: string | null;
  quarter_peak: 'q1' | 'q2' | 'q3' | 'q4' | null;
  suggested_event_type: string | null;
  campaign_idea: string | null;
  status: 'suggested' | 'accepted' | 'dismissed';
  is_ai_generated: boolean;
  source_model: string | null;
  year: number;
  created_at: string;
  updated_at: string;
}

export type SuggestionFilters = {
  year?: number;
  market?: 'co' | 'us' | 'both' | null;
  quarter_peak?: string | null;
  status?: 'suggested' | 'accepted' | 'dismissed' | null;
  category?: string | null;
  is_ai_generated?: boolean | null;
};

export function useHolidaySuggestions(filters: SuggestionFilters = {}) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const { addEvent } = useMarketingEvents();

  const currentYear = new Date().getFullYear();
  const year = filters.year || currentYear;

  const queryKey = ['holiday-suggestions', orgId, year, filters];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<HolidaySuggestion[]> => {
      const today = new Date().toISOString().slice(0, 10);
      let q = supabase
        .from('holiday_suggestions')
        .select('*')
        .eq('org_id', orgId!)
        .eq('year', year)
        .or(`date.gte.${today},status.neq.suggested`)
        .order('date', { ascending: true });

      if (filters.market) {
        q = q.eq('market', filters.market);
      }
      if (filters.quarter_peak) {
        q = q.eq('quarter_peak', filters.quarter_peak);
      }
      if (filters.status) {
        q = q.eq('status', filters.status);
      }
      if (filters.category) {
        q = q.eq('category', filters.category);
      }
      if (filters.is_ai_generated !== null && filters.is_ai_generated !== undefined) {
        q = q.eq('is_ai_generated', filters.is_ai_generated);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as HolidaySuggestion[]) || [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  // Generate suggestions via Edge Function
  const generateMutation = useMutation({
    mutationFn: async (targetYear: number) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await supabase.functions.invoke('generate-holiday-suggestions', {
        body: { year: targetYear, market_filter: filters.market },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-suggestions', orgId] });
    },
  });

  // Accept suggestion → create MarketingEvent
  const acceptMutation = useMutation({
    mutationFn: async (suggestion: HolidaySuggestion) => {
      // 1. Update status to accepted
      const { error: updateError } = await supabase
        .from('holiday_suggestions')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', suggestion.id);
      if (updateError) throw updateError;

      // 2. Create MarketingEvent
      const eventType: EventType = suggestion.suggested_event_type === 'product_launch'
        ? 'product_launch'
        : suggestion.suggested_event_type === 'promotion'
        ? 'promotion'
        : 'cultural_moment';

      const eventInput: MarketingEventInput = {
        event_date: suggestion.date,
        event_type: eventType,
        title: suggestion.name,
        description: suggestion.campaign_idea || `${suggestion.category} - ${suggestion.market.toUpperCase()}`,
        expected_impact: suggestion.expected_impact,
        why_now: suggestion.why_now,
        is_peak: suggestion.expected_impact === 'high',
        peak_name: suggestion.expected_impact === 'high' ? suggestion.name : null,
      };

      await addEvent(eventInput);
      return suggestion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-suggestions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-events', orgId] });
    },
  });

  // Dismiss suggestion
  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('holiday_suggestions')
        .update({ status: 'dismissed', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-suggestions', orgId] });
    },
  });

  // Restore suggestion
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('holiday_suggestions')
        .update({ status: 'suggested', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-suggestions', orgId] });
    },
  });

  // Add manual suggestion
  const addManualMutation = useMutation({
    mutationFn: async (data: Omit<HolidaySuggestion, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'is_ai_generated' | 'source_model'>) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('holiday_suggestions')
        .insert({
          org_id: orgId,
          ...data,
          is_ai_generated: false,
          source_model: null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-suggestions', orgId] });
    },
  });

  // Filter out past 'suggested' items (keep past 'accepted'/'dismissed' as-is)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const suggestions = (query.data || []).filter(s => {
    if (s.status === 'suggested' && s.date < today) return false;
    return true;
  });

  // Computed stats
  const suggestedCount = suggestions.filter(s => s.status === 'suggested').length;
  const acceptedCount = suggestions.filter(s => s.status === 'accepted').length;
  const dismissedCount = suggestions.filter(s => s.status === 'dismissed').length;

  return {
    suggestions,
    isLoading: query.isLoading,
    suggestedCount,
    acceptedCount,
    dismissedCount,
    generateSuggestions: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    acceptSuggestion: acceptMutation.mutateAsync,
    isAccepting: acceptMutation.isPending,
    dismissSuggestion: dismissMutation.mutateAsync,
    isDismissing: dismissMutation.isPending,
    restoreSuggestion: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,
    addManualSuggestion: addManualMutation.mutateAsync,
    isAddingManual: addManualMutation.isPending,
  };
}
