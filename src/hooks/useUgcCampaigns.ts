import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import type { UgcCampaign, UgcCampaignFormData, CampaignStatus } from '@/types/ugc';

export const useUgcCampaigns = (creatorId?: string | null) => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['ugc-campaigns', orgId, creatorId],
    queryFn: async () => {
      if (!orgId) return [];
      let query = supabase
        .from('ugc_campaigns')
        .select('*, creator:ugc_creators(*), videos:ugc_videos(*)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (creatorId) {
        query = query.eq('creator_id', creatorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UgcCampaign[];
    },
    enabled: !!orgId,
  });

  const createCampaign = useMutation({
    mutationFn: async ({ creatorId: cId, ...formData }: UgcCampaignFormData & { creatorId: string }) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase
        .from('ugc_campaigns')
        .insert({
          organization_id: orgId,
          creator_id: cId,
          name: formData.name,
          order_number: formData.order_number || null,
          agreed_videos: formData.agreed_videos || 1,
          agreed_payment: formData.agreed_payment || 0,
          payment_type: formData.payment_type || 'producto',
          notes: formData.notes || null,
          status: 'aceptado',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-campaigns'] });
      toast.success('Campaña creada exitosamente');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const updateCampaignStatus = useMutation({
    mutationFn: async ({ id, status, extra }: { id: string; status: CampaignStatus; extra?: Record<string, any> }) => {
      const updateData: Record<string, any> = { status, ...extra };
      const { error } = await supabase
        .from('ugc_campaigns')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-campaigns'] });
      toast.success('Estado actualizado');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...formData }: UgcCampaignFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('ugc_campaigns')
        .update({
          name: formData.name,
          order_number: formData.order_number || null,
          agreed_videos: formData.agreed_videos || 1,
          agreed_payment: formData.agreed_payment || 0,
          payment_type: formData.payment_type || 'producto',
          notes: formData.notes || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-campaigns'] });
      toast.success('Campaña actualizada');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ugc_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-campaigns'] });
      toast.success('Campaña eliminada');
    },
    onError: (err: Error) => toast.error(`Error al eliminar: ${err.message}`),
  });

  return { campaigns, isLoading, createCampaign, updateCampaign, deleteCampaign, updateCampaignStatus };
};
