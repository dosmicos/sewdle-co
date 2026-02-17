import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface UgcUploadToken {
  id: string;
  organization_id: string;
  creator_id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  max_uploads: number | null;
  upload_count: number;
  created_at: string;
  updated_at: string;
}

export const useUgcUploadTokens = (creatorId: string | undefined) => {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();

  const { data: activeToken, isLoading } = useQuery({
    queryKey: ['ugc-upload-token', creatorId],
    queryFn: async () => {
      if (!creatorId) return null;
      const { data, error } = await supabase
        .from('ugc_upload_tokens' as Record<string, unknown>)
        .select('*')
        .eq('creator_id', creatorId)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as UgcUploadToken | null;
    },
    enabled: !!creatorId,
  });

  const generateToken = useMutation({
    mutationFn: async ({ expiresInDays, maxUploads }: { expiresInDays?: number; maxUploads?: number }) => {
      if (!creatorId || !currentOrganization?.id) throw new Error('Missing creator or org');

      // Deactivate existing tokens
      await supabase
        .from('ugc_upload_tokens' as Record<string, unknown>)
        .update({ is_active: false } as Record<string, unknown>)
        .eq('creator_id', creatorId)
        .eq('is_active', true);

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data, error } = await supabase
        .from('ugc_upload_tokens' as Record<string, unknown>)
        .insert({
          organization_id: currentOrganization.id,
          creator_id: creatorId,
          is_active: true,
          expires_at: expiresAt,
          max_uploads: maxUploads || null,
        } as Record<string, unknown>)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as UgcUploadToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-upload-token', creatorId] });
    },
  });

  const deactivateToken = useMutation({
    mutationFn: async () => {
      if (!activeToken) throw new Error('No active token');
      const { error } = await supabase
        .from('ugc_upload_tokens' as Record<string, unknown>)
        .update({ is_active: false } as Record<string, unknown>)
        .eq('id', activeToken.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-upload-token', creatorId] });
    },
  });

  const getUploadUrl = (token: string) => {
    return `https://upload.dosmicos.com/upload/${token}`;
  };

  return {
    activeToken,
    isLoading,
    generateToken,
    deactivateToken,
    getUploadUrl,
  };
};
