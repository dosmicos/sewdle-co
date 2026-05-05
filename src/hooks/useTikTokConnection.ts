import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface TikTokConnection {
  id: string;
  tiktokUserId: string;
  displayName: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
  updatedAt: string;
}

export function useTikTokConnection() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: connection, isLoading: isCheckingConnection } = useQuery({
    queryKey: ['tiktok-connection', orgId],
    queryFn: async (): Promise<TikTokConnection | null> => {
      const { data, error } = await supabase
        .from('tiktok_connections')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        tiktokUserId: data.tiktok_user_id || '',
        displayName: data.display_name || '',
        isActive: data.is_active ?? false,
        tokenExpiresAt: data.token_expires_at,
        updatedAt: data.updated_at || '',
      };
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const isConnected = !!connection;
  const isTokenExpired = connection?.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt) < new Date()
    : false;

  const disconnect = useCallback(async () => {
    if (!connection) return;

    try {
      const { error } = await supabase
        .from('tiktok_connections')
        .update({ is_active: false })
        .eq('id', connection.id);

      if (error) throw error;

      toast.success('TikTok desconectado');
      queryClient.invalidateQueries({ queryKey: ['tiktok-connection'] });
    } catch (error: any) {
      console.error('Error disconnecting TikTok:', error);
      toast.error('Error al desconectar TikTok');
    }
  }, [connection, queryClient]);

  const syncPosts = useCallback(
    async (startDate?: string, endDate?: string) => {
      if (!orgId) {
        toast.error('No hay organización seleccionada');
        return false;
      }

      setSyncing(true);

      try {
        const { data, error } = await supabase.functions.invoke('sync-tiktok-posts', {
          body: {
            organizationId: orgId,
            startDate,
            endDate,
          },
        });

        if (error) throw error;

        if (data.needsReconnect) {
          toast.error(data.error || 'Necesitas reconectar tu cuenta de TikTok');
          queryClient.invalidateQueries({ queryKey: ['tiktok-connection'] });
          return false;
        }

        if (data.success) {
          toast.success(
            `Sincronización completada: ${data.syncedVideos || 0} videos sincronizados`
          );
          queryClient.invalidateQueries({ queryKey: ['tiktok-posts'] });
          return true;
        } else {
          toast.error(data.error || 'Error al sincronizar videos de TikTok');
          return false;
        }
      } catch (error: any) {
        console.error('Error syncing TikTok posts:', error);
        toast.error('Error al sincronizar videos de TikTok');
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [orgId, queryClient]
  );

  const refreshConnection = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tiktok-connection'] });
    queryClient.invalidateQueries({ queryKey: ['tiktok-posts'] });
  }, [queryClient]);

  return {
    isConnected,
    isTokenExpired,
    connection,
    isCheckingConnection,
    syncing,
    disconnect,
    syncPosts,
    refreshConnection,
  };
}
