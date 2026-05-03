import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UgcCreatorPortalLinkMeta {
  id: string;
  creator_id: string;
  organization_id: string;
  token_last4: string;
  is_active: boolean;
  created_at: string;
  last_accessed_at: string | null;
  revoked_at: string | null;
}

interface GeneratedPortalLink {
  token: string;
  portal_url: string;
  token_last4: string;
}

export const useUgcCreatorPortalLink = (creatorId: string | undefined) => {
  const queryClient = useQueryClient();
  const [lastGeneratedUrl, setLastGeneratedUrl] = useState<string | null>(null);

  const { data: activeLinkMeta, isLoading } = useQuery({
    queryKey: ['ugc-creator-portal-link', creatorId],
    queryFn: async () => {
      if (!creatorId) return null;
      const { data, error } = await (supabase.from('ugc_creator_portal_links' as any) as any)
        .select('id, creator_id, organization_id, token_last4, is_active, created_at, last_accessed_at, revoked_at')
        .eq('creator_id', creatorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) throw error;
      return data as UgcCreatorPortalLinkMeta | null;
    },
    enabled: !!creatorId,
  });

  const generateLink = useMutation({
    mutationFn: async () => {
      if (!creatorId) throw new Error('Missing creator');
      const { data, error } = await (supabase.rpc as any)('generate_ugc_creator_portal_link', {
        p_creator_id: creatorId,
      });
      if (error) throw error;
      const generated = Array.isArray(data) ? data[0] : data;
      if (!generated?.portal_url) throw new Error('No se pudo generar el link Club');
      return generated as GeneratedPortalLink;
    },
    onSuccess: (generated) => {
      setLastGeneratedUrl(generated.portal_url);
      queryClient.invalidateQueries({ queryKey: ['ugc-creator-portal-link', creatorId] });
    },
  });

  const revokeLink = useMutation({
    mutationFn: async () => {
      if (!creatorId) throw new Error('Missing creator');
      const { error } = await (supabase.rpc as any)('revoke_ugc_creator_portal_link', {
        p_creator_id: creatorId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setLastGeneratedUrl(null);
      queryClient.invalidateQueries({ queryKey: ['ugc-creator-portal-link', creatorId] });
    },
  });

  return {
    activeLinkMeta,
    isLoading,
    generateLink,
    revokeLink,
    lastGeneratedUrl,
  };
};
