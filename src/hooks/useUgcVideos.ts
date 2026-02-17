import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import type { UgcVideo, UgcVideoFormData } from '@/types/ugc';

export const useUgcVideos = (creatorId?: string | null, campaignId?: string | null) => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['ugc-videos', orgId, creatorId, campaignId],
    queryFn: async () => {
      if (!orgId) return [];
      let query = supabase
        .from('ugc_videos')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (creatorId) query = query.eq('creator_id', creatorId);
      if (campaignId) query = query.eq('campaign_id', campaignId);

      const { data, error } = await query;
      if (error) throw error;
      return data as UgcVideo[];
    },
    enabled: !!orgId,
  });

  const createVideo = useMutation({
    mutationFn: async ({
      campaignId: cmpId,
      creatorId: crtId,
      ...formData
    }: UgcVideoFormData & { campaignId: string; creatorId: string }) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase
        .from('ugc_videos')
        .insert({
          organization_id: orgId,
          campaign_id: cmpId,
          creator_id: crtId,
          video_url: formData.video_url,
          platform: formData.platform,
          likes: formData.likes || 0,
          views: formData.views || 0,
          comments: formData.comments || 0,
          status: 'en_revision',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-videos'] });
      queryClient.invalidateQueries({ queryKey: ['ugc-campaigns'] });
      toast.success('Video registrado');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const updateVideoStatus = useMutation({
    mutationFn: async ({ id, status, feedback }: { id: string; status: string; feedback?: string }) => {
      const update: Record<string, any> = { status };
      if (feedback !== undefined) update.feedback = feedback;
      const { error } = await supabase.from('ugc_videos').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-videos'] });
      queryClient.invalidateQueries({ queryKey: ['ugc-campaigns'] });
      toast.success('Video actualizado');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  return { videos, isLoading, createVideo, updateVideoStatus };
};
