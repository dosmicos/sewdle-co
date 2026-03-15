import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface GoogleAdAccount {
  id: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
  updatedAt: string;
}

export function useGoogleAdsConnection() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  // Check if Google Ads is connected
  const { data: account, isLoading: isCheckingConnection } = useQuery({
    queryKey: ['google-ads-connection', orgId],
    queryFn: async (): Promise<GoogleAdAccount | null> => {
      const { data, error } = await supabase
        .from('ad_accounts')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('platform', 'google_ads')
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

  // Disconnect Google Ads
  const disconnect = useCallback(async () => {
    if (!account) return;

    try {
      const { error } = await supabase
        .from('ad_accounts')
        .update({ is_active: false })
        .eq('id', account.id);

      if (error) throw error;

      toast.success('Google Ads desconectado');
      queryClient.invalidateQueries({ queryKey: ['google-ads-connection'] });
    } catch (error: any) {
      console.error('Error disconnecting Google Ads:', error);
      toast.error('Error al desconectar Google Ads');
    }
  }, [account, queryClient]);

  // Sync metrics for a date range
  const syncMetrics = useCallback(
    async (startDate: string, endDate: string) => {
      if (!orgId) {
        toast.error('No hay organización seleccionada');
        return false;
      }

      setSyncing(true);

      try {
        const { data, error } = await supabase.functions.invoke('sync-google-ads', {
          body: {
            organizationId: orgId,
            startDate,
            endDate,
          },
        });

        if (error) throw error;

        if (data.needsReconnect) {
          toast.error(data.error || 'Necesitas reconectar tu cuenta de Google Ads');
          queryClient.invalidateQueries({ queryKey: ['google-ads-connection'] });
          return false;
        }

        if (data.success) {
          toast.success(
            `Sincronización completada: ${data.syncedDays} días sincronizados`
          );
          queryClient.invalidateQueries({ queryKey: ['ad-metrics', 'google_ads'] });
          return true;
        } else {
          toast.error(data.error || 'Error al sincronizar métricas');
          return false;
        }
      } catch (error: any) {
        console.error('Error syncing Google Ads metrics:', error);
        toast.error('Error al sincronizar métricas de Google Ads');
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [orgId, queryClient]
  );

  // Refresh connection state
  const refreshConnection = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['google-ads-connection'] });
    queryClient.invalidateQueries({ queryKey: ['ad-metrics', 'google_ads'] });
  }, [queryClient]);

  return {
    isConnected,
    account,
    isCheckingConnection,
    syncing,
    disconnect,
    syncMetrics,
    refreshConnection,
  };
}
