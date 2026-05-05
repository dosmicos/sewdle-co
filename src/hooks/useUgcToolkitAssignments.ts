import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface UgcToolkitAssignment {
  id: string;
  organization_id: string;
  creator_id: string;
  campaign_id: string | null;
  label: string;
  toolkit_url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertToolkitAssignmentInput {
  id?: string;
  campaign_id?: string | null;
  label: string;
  toolkit_url: string;
  is_active?: boolean;
  sort_order?: number;
}

const normalizeToolkitUrl = (url: string) => url.trim();

export const useUgcToolkitAssignments = (creatorId: string | undefined) => {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const queryKey = ['ugc-toolkit-assignments', creatorId];

  const { data: assignments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!creatorId) return [];
      const { data, error } = await (supabase.from('ugc_toolkit_assignments' as any) as any)
        .select('*')
        .eq('creator_id', creatorId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as UgcToolkitAssignment[];
    },
    enabled: !!creatorId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const upsertAssignment = useMutation({
    mutationFn: async (input: UpsertToolkitAssignmentInput) => {
      if (!creatorId || !orgId) throw new Error('Missing creator or org');
      const toolkitUrl = normalizeToolkitUrl(input.toolkit_url);
      if (!toolkitUrl.startsWith('https://')) {
        throw new Error('El link del toolkit debe empezar por https://');
      }

      const payload = {
        organization_id: orgId,
        creator_id: creatorId,
        campaign_id: input.campaign_id || null,
        label: input.label?.trim() || 'Idea de contenido',
        toolkit_url: toolkitUrl,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      };

      if (input.id) {
        const { data, error } = await (supabase.from('ugc_toolkit_assignments' as any) as any)
          .update(payload)
          .eq('id', input.id)
          .select()
          .single();
        if (error) throw error;
        return data as UgcToolkitAssignment;
      }

      const { data, error } = await (supabase.from('ugc_toolkit_assignments' as any) as any)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as UgcToolkitAssignment;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Toolkit guardado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from('ugc_toolkit_assignments' as any) as any)
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Estado del toolkit actualizado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('ugc_toolkit_assignments' as any) as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Toolkit eliminado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    assignments,
    isLoading,
    upsertAssignment,
    setActive,
    deleteAssignment,
  };
};
