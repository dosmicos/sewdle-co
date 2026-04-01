import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { addDays, format } from 'date-fns';

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

export type PeakPhase = 'concept' | 'creative' | 'teaser' | 'peak' | 'analysis';

export type ContentType =
  | 'reel'
  | 'story'
  | 'post'
  | 'carousel'
  | 'live'
  | 'tiktok'
  | 'email'
  | 'blog'
  | 'ugc'
  | 'other';

export type Platform = 'instagram' | 'tiktok' | 'facebook' | 'whatsapp' | 'email' | 'blog';

export type EventStatus = 'idea' | 'planned' | 'in_production' | 'ready' | 'published' | 'done';

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
  // Event Effect Model fields
  expected_revenue: number | null;
  expected_new_customers: number | null;
  attributed_revenue: number | null;
  attributed_orders: number | null;
  ad_spend_during: number | null;
  roas_during: number | null;
  roi_percent: number | null;
  attribution_window_days: number;
  why_now: string | null;
  peak_name: string | null;
  is_peak: boolean;
  peak_phase: PeakPhase | null;
  learnings: string | null;
  content_type: ContentType | null;
  platform: Platform[] | null;
  status: EventStatus;
  assigned_to: string | null;
}

export type MarketingEventInput = {
  event_date: string;
  event_type: EventType;
  title: string;
  description?: string | null;
  expected_impact: ImpactLevel;
  actual_revenue_impact?: number | null;
  // Event Effect Model fields
  expected_revenue?: number | null;
  expected_new_customers?: number | null;
  attribution_window_days?: number;
  why_now?: string | null;
  is_peak?: boolean;
  peak_name?: string | null;
  peak_phase?: PeakPhase | null;
  learnings?: string | null;
  content_type?: ContentType | null;
  platform?: Platform[] | null;
  status?: EventStatus;
  assigned_to?: string | null;
  // These can be set manually or via calculateAttribution
  attributed_revenue?: number | null;
  attributed_orders?: number | null;
  ad_spend_during?: number | null;
  roas_during?: number | null;
  roi_percent?: number | null;
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

  /**
   * Calculate attributed revenue for an event by querying shopify_orders
   * in the attribution window (event_date to event_date + attribution_window_days).
   */
  const calculateAttribution = async (event: MarketingEvent) => {
    if (!orgId) throw new Error('No organization');

    const windowDays = event.attribution_window_days || 7;
    const startDate = event.event_date;
    const endDate = format(
      addDays(new Date(event.event_date + 'T00:00:00'), windowDays),
      'yyyy-MM-dd'
    );

    const { data, error } = await supabase
      .from('shopify_orders')
      .select('id, current_total_price')
      .eq('organization_id', orgId)
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .not('current_total_price', 'is', null);

    if (error) throw error;

    const orders = data || [];
    const totalRevenue = orders.reduce(
      (sum, o) => sum + (Number(o.current_total_price) || 0),
      0
    );
    const totalOrders = orders.length;

    // Calculate ROI and ROAS if ad_spend is available
    const updates: Partial<MarketingEventInput> = {
      attributed_revenue: totalRevenue,
      attributed_orders: totalOrders,
    };

    if (event.ad_spend_during && event.ad_spend_during > 0) {
      updates.roas_during = Number((totalRevenue / event.ad_spend_during).toFixed(2));
      updates.roi_percent = Number(
        (((totalRevenue - event.ad_spend_during) / event.ad_spend_during) * 100).toFixed(2)
      );
    }

    await updateMutation.mutateAsync({ id: event.id, updates });

    return { attributed_revenue: totalRevenue, attributed_orders: totalOrders };
  };

  return {
    events: query.data || [],
    isLoading: query.isLoading,
    addEvent: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    updateEvent: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteEvent: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    calculateAttribution,
  };
}
