import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface MessagingTag {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface TagAssignment {
  id: string;
  conversation_id: string;
  tag_id: string;
  assigned_at: string;
  tag?: MessagingTag;
}

export const TAG_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Slate', value: '#64748b' },
  { name: 'Lime', value: '#84cc16' },
];

export const useMessagingTags = () => {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;

  // Fetch all tags for the organization
  const { data: tags = [], isLoading: isLoadingTags } = useQuery({
    queryKey: ['messaging-tags', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('messaging_conversation_tags')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');
      
      if (error) throw error;
      return data as MessagingTag[];
    },
    enabled: !!organizationId,
  });

  // Fetch tag assignments for a specific conversation
  const useConversationTags = (conversationId: string | null) => {
    return useQuery({
      queryKey: ['conversation-tags', conversationId],
      queryFn: async () => {
        if (!conversationId) return [];
        
        const { data, error } = await supabase
          .from('messaging_conversation_tag_assignments')
          .select(`
            *,
            tag:messaging_conversation_tags(*)
          `)
          .eq('conversation_id', conversationId);
        
        if (error) throw error;
        return data as (TagAssignment & { tag: MessagingTag })[];
      },
      enabled: !!conversationId,
    });
  };

  // Fetch all assignments with tag counts
  const { data: tagCounts = {} } = useQuery({
    queryKey: ['messaging-tag-counts', organizationId],
    queryFn: async () => {
      if (!organizationId) return {};
      
      const { data, error } = await supabase
        .from('messaging_conversation_tag_assignments')
        .select(`
          tag_id,
          tag:messaging_conversation_tags!inner(organization_id)
        `)
        .eq('tag.organization_id', organizationId);
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(assignment => {
        counts[assignment.tag_id] = (counts[assignment.tag_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!organizationId,
  });

  // Create a new tag
  const createTag = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!organizationId) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('messaging_conversation_tags')
        .insert({
          organization_id: organizationId,
          name: name.trim(),
          color,
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Ya existe una etiqueta con ese nombre');
        }
        throw error;
      }
      return data as MessagingTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-tags'] });
      toast.success('Etiqueta creada');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update a tag
  const updateTag = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const updates: Partial<MessagingTag> = {};
      if (name !== undefined) updates.name = name.trim();
      if (color !== undefined) updates.color = color;
      
      const { error } = await supabase
        .from('messaging_conversation_tags')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-tags'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-tags'] });
      toast.success('Etiqueta actualizada');
    },
    onError: () => {
      toast.error('Error al actualizar etiqueta');
    },
  });

  // Delete a tag
  const deleteTag = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('messaging_conversation_tags')
        .delete()
        .eq('id', tagId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-tags'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-tags'] });
      queryClient.invalidateQueries({ queryKey: ['messaging-tag-counts'] });
      toast.success('Etiqueta eliminada');
    },
    onError: () => {
      toast.error('Error al eliminar etiqueta');
    },
  });

  // Assign a tag to a conversation
  const assignTag = useMutation({
    mutationFn: async ({ conversationId, tagId }: { conversationId: string; tagId: string }) => {
      const { error } = await supabase
        .from('messaging_conversation_tag_assignments')
        .insert({
          conversation_id: conversationId,
          tag_id: tagId,
        });
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Esta etiqueta ya está asignada');
        }
        throw error;
      }
    },
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tags', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messaging-tag-counts'] });
      queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Remove a tag from a conversation
  const removeTag = useMutation({
    mutationFn: async ({ conversationId, tagId }: { conversationId: string; tagId: string }) => {
      const { error } = await supabase
        .from('messaging_conversation_tag_assignments')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('tag_id', tagId);
      
      if (error) throw error;
    },
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tags', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messaging-tag-counts'] });
      queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
    },
    onError: () => {
      toast.error('Error al quitar etiqueta');
    },
  });

  return {
    tags,
    isLoadingTags,
    tagCounts,
    useConversationTags,
    createTag: createTag.mutateAsync,
    isCreatingTag: createTag.isPending,
    updateTag: updateTag.mutate,
    isUpdatingTag: updateTag.isPending,
    deleteTag: deleteTag.mutate,
    isDeletingTag: deleteTag.isPending,
    assignTag: assignTag.mutate,
    isAssigningTag: assignTag.isPending,
    removeTag: removeTag.mutate,
    isRemovingTag: removeTag.isPending,
  };
};
