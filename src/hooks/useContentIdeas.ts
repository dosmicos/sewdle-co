import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useMarketingEvents } from './useMarketingEvents';
import type { ContentType, Platform, MarketingEventInput } from './useMarketingEvents';

export type IdeaPriority = 'high' | 'medium' | 'low';
export type IdeaStatus = 'new' | 'approved' | 'rejected' | 'converted';

export interface ContentIdea {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  source: string | null;
  reference_urls: string[] | null;
  content_type: string | null;
  platform: string[] | null;
  suggested_date: string | null;
  priority: IdeaPriority;
  status: IdeaStatus;
  submitted_by: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentIdeaInput = {
  title: string;
  description?: string | null;
  source?: string | null;
  reference_urls?: string[] | null;
  content_type?: string | null;
  platform?: string[] | null;
  suggested_date?: string | null;
  priority?: IdeaPriority;
  submitted_by?: string | null;
};

export function useContentIdeas() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const { addEvent } = useMarketingEvents();

  const query = useQuery({
    queryKey: ['content-ideas', orgId],
    queryFn: async (): Promise<ContentIdea[]> => {
      const { data, error } = await supabase
        .from('content_ideas')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as ContentIdea[]) || [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const addMutation = useMutation({
    mutationFn: async (input: ContentIdeaInput) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('content_ideas')
        .insert({ org_id: orgId, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-ideas', orgId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ContentIdea> }) => {
      const { error } = await supabase
        .from('content_ideas')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-ideas', orgId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('content_ideas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-ideas', orgId] });
    },
  });

  // Convert idea to calendar event
  const convertToEvent = useMutation({
    mutationFn: async (idea: ContentIdea) => {
      const eventInput: MarketingEventInput = {
        event_date: idea.suggested_date || new Date().toISOString().split('T')[0],
        event_type: 'other',
        title: idea.title,
        description: idea.description,
        expected_impact: 'medium',
        content_type: (idea.content_type as ContentType) || null,
        platform: (idea.platform as Platform[]) || null,
        status: 'planned',
        why_now: idea.source ? `Oportunidad: ${idea.source}` : null,
      };
      await addEvent(eventInput);

      // Mark idea as converted
      const { error } = await supabase
        .from('content_ideas')
        .update({ status: 'converted', updated_at: new Date().toISOString() })
        .eq('id', idea.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-ideas', orgId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-events', orgId] });
    },
  });

  const ideas = query.data || [];

  return {
    ideas,
    isLoading: query.isLoading,
    newCount: ideas.filter(i => i.status === 'new').length,
    approvedCount: ideas.filter(i => i.status === 'approved').length,
    rejectedCount: ideas.filter(i => i.status === 'rejected').length,
    convertedCount: ideas.filter(i => i.status === 'converted').length,
    addIdea: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    updateIdea: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteIdea: deleteMutation.mutateAsync,
    convertToEvent: convertToEvent.mutateAsync,
    isConverting: convertToEvent.isPending,
  };
}
