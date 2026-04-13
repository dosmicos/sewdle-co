import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface ContentFormat {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContentFormatInput {
  name: string;
  description?: string | null;
  is_active?: boolean;
  color?: string;
  sort_order?: number;
}

export function useContentFormats() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['content-formats', orgId],
    queryFn: async (): Promise<ContentFormat[]> => {
      const { data, error } = await supabase
        .from('content_formats')
        .select('*')
        .eq('organization_id', orgId!)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data as unknown as ContentFormat[]) || [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  });

  const addMutation = useMutation({
    mutationFn: async (input: ContentFormatInput) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase
        .from('content_formats')
        .insert({ organization_id: orgId, ...input })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ContentFormat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-formats', orgId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ContentFormatInput> }) => {
      const { error } = await supabase
        .from('content_formats')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-formats', orgId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('content_formats')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-formats', orgId] });
    },
  });

  const activeFormats = (query.data || []).filter((f) => f.is_active);

  return {
    formats: query.data || [],
    activeFormats,
    isLoading: query.isLoading,
    addFormat: addMutation.mutateAsync,
    updateFormat: updateMutation.mutateAsync,
    deleteFormat: deleteMutation.mutateAsync,
  };
}
