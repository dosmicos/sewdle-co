import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface MetaAdAccount {
  id: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
  needsReconnect: boolean;
  tokenExpiresAt: string | null;
  updatedAt: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
}

export function useMetaAdsConnection() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  // Check if Meta Ads is connected
  const { data: account, isLoading: isCheckingConnection } = useQuery({
    queryKey: ['meta-ads-connection', orgId],
    queryFn: async (): Promise<MetaAdAccount | null> => {
      const { data, error } = await supabase
        .from('ad_accounts')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('platform', 'meta')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        accountId: data.account_id || '',
        accountName: data.account_name || '',
        isActive: data.is_active ?? false,
        needsReconnect: data.needs_reconnect ?? false,
        tokenExpiresAt: data.token_expires_at,
        updatedAt: data.updated_at || '',
        lastSyncAt: data.last_sync_at ?? null,
        lastSyncStatus: data.last_sync_status ?? null,
        lastSyncError: data.last_sync_error ?? null,
      };
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const isTokenExpired = account?.tokenExpiresAt
    ? new Date(account.tokenExpiresAt) < new Date()
    : false;
  const needsReconnect = !!account && (account.needsReconnect || isTokenExpired);
  const isConnected = !!account && account.isActive && !needsReconnect;

  // Disconnect Meta Ads
  const disconnect = useCallback(async () => {
    if (!account) return;

    try {
      const { error } = await supabase
        .from('ad_accounts')
        .update({
          is_active: false,
          needs_reconnect: false,
          last_sync_status: 'disconnected',
          last_sync_error: null,
        })
        .eq('id', account.id);

      if (error) throw error;

      toast.success('Meta Ads desconectado');
      queryClient.invalidateQueries({ queryKey: ['meta-ads-connection'] });
    } catch (error: any) {
      console.error('Error disconnecting Meta Ads:', error);
      toast.error('Error al desconectar Meta Ads');
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
        const { data, error } = await supabase.functions.invoke('sync-meta-ads', {
          body: {
            organizationId: orgId,
            startDate,
            endDate,
          },
        });

        if (error) throw error;

        if (data.needsReconnect) {
          toast.error(data.error || 'Necesitas reconectar tu cuenta de Meta Ads');
          queryClient.invalidateQueries({ queryKey: ['meta-ads-connection'] });
          return false;
        }

        if (data.success) {
          toast.success(
            `Sincronización completada: ${data.syncedDays} días sincronizados`
          );
          // Invalidate ad metrics/prophit cache so dashboard refreshes
          queryClient.invalidateQueries({ queryKey: ['ad-metrics', 'meta'] });
          queryClient.invalidateQueries({ queryKey: ['prophit-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['meta-ads-connection'] });
          return true;
        } else {
          toast.error(data.error || 'Error al sincronizar métricas');
          return false;
        }
      } catch (error: any) {
        console.error('Error syncing Meta Ads metrics:', error);
        toast.error('Error al sincronizar métricas de Meta Ads');
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [orgId, queryClient]
  );

  // Refresh connection state
  const refreshConnection = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['meta-ads-connection'] });
    queryClient.invalidateQueries({ queryKey: ['ad-metrics', 'meta'] });
  }, [queryClient]);

  return {
    isConnected,
    isTokenExpired,
    needsReconnect,
    account,
    isCheckingConnection,
    syncing,
    disconnect,
    syncMetrics,
    refreshConnection,
  };
}
