import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface UgcCreatorTag {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface UgcCreatorTagAssignment {
  id: string;
  creator_id: string;
  tag_id: string;
  assigned_at: string;
}

export const useUgcCreatorTags = () => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['ugc-creator-tags', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('ugc_creator_tags')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');
      if (error) throw error;
      return data as UgcCreatorTag[];
    },
    enabled: !!orgId,
  });

  const createTag = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase
        .from('ugc_creator_tags')
        .insert({ organization_id: orgId, name, color })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-creator-tags'] });
      toast.success('Etiqueta creada');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const updateTag = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { error } = await supabase
        .from('ugc_creator_tags')
        .update({ name, color, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-creator-tags'] });
      queryClient.invalidateQueries({ queryKey: ['ugc-creator-tag-assignments'] });
      toast.success('Etiqueta actualizada');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ugc_creator_tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-creator-tags'] });
      queryClient.invalidateQueries({ queryKey: ['ugc-creator-tag-assignments'] });
      toast.success('Etiqueta eliminada');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  return { tags, isLoading, createTag, updateTag, deleteTag };
};

export const useUgcCreatorTagAssignments = (creatorId?: string | null) => {
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['ugc-creator-tag-assignments', creatorId],
    queryFn: async () => {
      if (!creatorId) return [];
      const { data, error } = await supabase
        .from('ugc_creator_tag_assignments')
        .select('*, tag:ugc_creator_tags(*)')
        .eq('creator_id', creatorId);
      if (error) throw error;
      return data as (UgcCreatorTagAssignment & { tag: UgcCreatorTag })[];
    },
    enabled: !!creatorId,
  });

  const assignTag = useMutation({
    mutationFn: async ({ creatorId: cId, tagId }: { creatorId: string; tagId: string }) => {
      const { error } = await supabase
        .from('ugc_creator_tag_assignments')
        .insert({ creator_id: cId, tag_id: tagId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-creator-tag-assignments'] });
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const removeTag = useMutation({
    mutationFn: async ({ creatorId: cId, tagId }: { creatorId: string; tagId: string }) => {
      const { error } = await supabase
        .from('ugc_creator_tag_assignments')
        .delete()
        .eq('creator_id', cId)
        .eq('tag_id', tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-creator-tag-assignments'] });
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const tagIds = assignments.map((a) => a.tag_id);

  return { assignments, tagIds, isLoading, assignTag, removeTag };
};

// Bulk fetch all tag assignments for the org (used in list views)
export const useAllUgcCreatorTagAssignments = () => {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['ugc-creator-tag-assignments', 'all', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      // Get all assignments via creator org
      const { data, error } = await supabase
        .from('ugc_creator_tag_assignments')
        .select('*, tag:ugc_creator_tags(*)');
      if (error) throw error;
      return data as (UgcCreatorTagAssignment & { tag: UgcCreatorTag })[];
    },
    enabled: !!orgId,
  });

  const getTagsForCreator = (creatorId: string) =>
    allAssignments.filter((a) => a.creator_id === creatorId).map((a) => a.tag);

  return { allAssignments, getTagsForCreator, isLoading };
};
