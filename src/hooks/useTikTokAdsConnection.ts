import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface TikTokAdsAccount {
  id: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
  updatedAt: string;
}

export function useTikTokAdsConnection() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: account, isLoading: isCheckingConnection } = useQuery({
    queryKey: ['tiktok-ads-connection', orgId],
    queryFn: async (): Promise<TikTokAdsAccount | null> => {
      const { data, error } = await supabase
        .from('ad_accounts')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('platform', 'tiktok_ads')
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        accountId: data.account_id || '',
        accountName: data.account_name || '',
        isActive: data.is_active ?? false,
        tokenExpiresAt: data.token_expires_at,
        updatedAt: data.updated_at || '',
      };
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const isConnected = !!account;
  const isTokenExpired = account?.tokenExpiresAt
    ? new Date(account.tokenExpiresAt) < new Date()
    : false;

  const disconnect = useCallback(async () => {
    if (!account) return;

    try {
      const { error } = await supabase
        .from('ad_accounts')
        .update({ is_active: false })
        .eq('id', account.id);

      if (error) throw error;

      toast.success('TikTok Ads desconectado');
      queryClient.invalidateQueries({ queryKey: ['tiktok-ads-connection'] });
    } catch (error: any) {
      console.error('Error disconnecting TikTok Ads:', error);
      toast.error('Error al desconectar TikTok Ads');
    }
  }, [account, queryClient]);

  const syncMetrics = useCallback(
    async (startDate: string, endDate: string) => {
      if (!orgId) {
        toast.error('No hay organización seleccionada');
        return false;
      }

      setSyncing(true);

      try {
        // Use fetch directly so error bodies on non-2xx responses are not swallowed
        // by supabase.functions.invoke().
        const session = (await supabase.auth.getSession()).data.session;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-tiktok-ads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || SUPABASE_PUBLISHABLE_KEY}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            organizationId: orgId,
            startDate,
            endDate,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errorMsg = data?.error || `HTTP ${res.status}`;
          const details = data?.details || '';
          const fullMsg = details ? `${errorMsg}: ${details}` : errorMsg;
          console.error('TikTok Ads sync server error:', data);
          toast.error(fullMsg);
          return false;
        }

        if (data.needsReconnect) {
          toast.error(data.error || 'Necesitas reconectar tu cuenta de TikTok Ads');
          queryClient.invalidateQueries({ queryKey: ['tiktok-ads-connection'] });
          return false;
        }

        if (data.success) {
          toast.success(
            `TikTok Ads: ${data.syncedDays} días, ${data.uniqueAds} ads sincronizados`
          );
          queryClient.invalidateQueries({ queryKey: ['ad-metrics', 'tiktok_ads'] });
          queryClient.invalidateQueries({ queryKey: ['tiktok-ads-breakdown'] });
          return true;
        } else {
          toast.error(data.error || 'Error al sincronizar métricas');
          return false;
        }
      } catch (error: any) {
        console.error('Error syncing TikTok Ads metrics:', error);
        toast.error(error?.message || 'Error al sincronizar métricas de TikTok Ads');
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [orgId, queryClient]
  );

  const refreshConnection = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tiktok-ads-connection'] });
    queryClient.invalidateQueries({ queryKey: ['ad-metrics', 'tiktok_ads'] });
  }, [queryClient]);

  return {
    isConnected,
    isTokenExpired,
    account,
    isCheckingConnection,
    syncing,
    disconnect,
    syncMetrics,
    refreshConnection,
  };
}
