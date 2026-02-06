import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import type { UgcCreator, UgcCreatorFormData, UgcCreatorChild } from '@/types/ugc';

export const useUgcCreators = () => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const { data: creators = [], isLoading } = useQuery({
    queryKey: ['ugc-creators', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('ugc_creators')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UgcCreator[];
    },
    enabled: !!orgId,
  });

  const createCreator = useMutation({
    mutationFn: async (formData: UgcCreatorFormData) => {
      if (!orgId) throw new Error('No organization');
      const avatarUrl = formData.instagram_handle
        ? `https://unavatar.io/instagram/${formData.instagram_handle}`
        : null;
      const { data, error } = await supabase
        .from('ugc_creators')
        .insert({
          organization_id: orgId,
          name: formData.name,
          instagram_handle: formData.instagram_handle || null,
          instagram_followers: formData.instagram_followers || 0,
          email: formData.email || null,
          phone: formData.phone || null,
          city: formData.city || null,
          engagement_rate: formData.engagement_rate || null,
          notes: formData.notes || null,
          avatar_url: avatarUrl,
          status: 'prospecto',
          platform: formData.platform || 'instagram',
          content_types: formData.content_types || null,
          tiktok_handle: formData.tiktok_handle || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-creators'] });
      toast.success('Creador agregado exitosamente');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const updateCreator = useMutation({
    mutationFn: async ({ id, ...formData }: UgcCreatorFormData & { id: string }) => {
      const avatarUrl = formData.instagram_handle
        ? `https://unavatar.io/instagram/${formData.instagram_handle}`
        : null;
      const { data, error } = await supabase
        .from('ugc_creators')
        .update({
          name: formData.name,
          instagram_handle: formData.instagram_handle || null,
          instagram_followers: formData.instagram_followers || 0,
          email: formData.email || null,
          phone: formData.phone || null,
          city: formData.city || null,
          engagement_rate: formData.engagement_rate || null,
          notes: formData.notes || null,
          avatar_url: avatarUrl,
          platform: formData.platform || 'instagram',
          content_types: formData.content_types || null,
          tiktok_handle: formData.tiktok_handle || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-creators'] });
      toast.success('Creador actualizado');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const updateCreatorStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('ugc_creators')
        .update({ status, last_contact_date: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-creators'] });
      toast.success('Estado actualizado');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  return { creators, isLoading, createCreator, updateCreator, updateCreatorStatus };
};

export const useUgcCreatorChildren = (creatorId: string | null) => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['ugc-children', creatorId],
    queryFn: async () => {
      if (!creatorId) return [];
      const { data, error } = await supabase
        .from('ugc_creator_children')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as UgcCreatorChild[];
    },
    enabled: !!creatorId,
  });

  const addChild = useMutation({
    mutationFn: async (child: { name: string; age_description?: string; size?: string; gender?: string }) => {
      console.log('[UGC] Adding child:', { creatorId, orgId, child });
      if (!creatorId || !orgId) throw new Error('Missing creatorId or orgId');
      const { data, error } = await supabase.from('ugc_creator_children').insert({
        creator_id: creatorId,
        organization_id: orgId,
        name: child.name,
        age_description: child.age_description || null,
        size: child.size || null,
        gender: child.gender || null,
      }).select().single();
      if (error) {
        console.error('[UGC] Error adding child:', error);
        throw error;
      }
      console.log('[UGC] Child added successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-children', creatorId] });
      toast.success('Hijo agregado');
    },
    onError: (err: Error) => {
      console.error('[UGC] addChild mutation error:', err);
      toast.error(`Error al agregar hijo: ${err.message}`);
    },
  });

  const deleteChild = useMutation({
    mutationFn: async (childId: string) => {
      const { error } = await supabase.from('ugc_creator_children').delete().eq('id', childId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-children', creatorId] });
      toast.success('Hijo eliminado');
    },
  });

  return { children, isLoading, addChild, deleteChild };
};
