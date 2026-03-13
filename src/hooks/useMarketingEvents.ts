import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export type EventType =
  | 'product_launch'
  | 'promotion'
  | 'email_campaign'
  | 'sms_blast'
  | 'influencer_collab'
  | 'pr_hit'
  | 'organic_viral'
  | 'cultural_moment'
  | 'price_change'
  | 'new_creative_batch'
  | 'channel_expansion'
  | 'other';

export type ImpactLevel = 'high' | 'medium' | 'low';

export interface MarketingEvent {
  id: string;
  organization_id: string;
  event_date: string;
  event_type: EventType;
  title: string;
  description: string | null;
  expected_impact: ImpactLevel;
  actual_revenue_impact: number | null;
  created_by: string | null;
  created_at: string;
}

export type MarketingEventInput = {
  event_date: string;
  event_type: EventType;
  title: string;
  description?: string | null;
  expected_impact: ImpactLevel;
  actual_revenue_impact?: number | null;
};

export function useMarketingEvents() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['marketing-events', orgId],
    queryFn: async (): Promise<MarketingEvent[]> => {
      const { data, error } = await supabase
        .from('marketing_events')
        .select('*')
        .eq('organization_id', orgId!)
        .order('event_date', { ascending: false });

      if (error) throw error;
      return (data as unknown as MarketingEvent[]) || [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const addMutation = useMutation({
    mutationFn: async (input: MarketingEventInput) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('marketing_events')
        .insert({
          organization_id: orgId,
          ...input,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-events', orgId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<MarketingEventInput>;
    }) => {
      const { error } = await supabase
        .from('marketing_events')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-events', orgId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_events')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-events', orgId] });
    },
  });

  return {
    events: query.data || [],
    isLoading: query.isLoading,
    addEvent: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    updateEvent: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteEvent: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
