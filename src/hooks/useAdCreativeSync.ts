import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface CreativeSyncResult {
  creativesSync: { synced: number; total: number };
  audienceSync: { synced: number; total: number };
  tagging: { ruleBased: number; aiTagged: number; aiSkipped: number; aiAvailable: boolean };
}

export function useAdCreativeSync() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<CreativeSyncResult | null>(null);

  const syncCreativeAndTags = useCallback(async () => {
    if (!orgId) {
      toast.error('No hay organización seleccionada');
      return false;
    }

    setSyncing(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'sync-meta-ad-creative',
        { body: { organizationId: orgId } }
      );

      if (error) throw error;

      if (data.needsReconnect) {
        toast.error(data.error || 'Necesitas reconectar tu cuenta de Meta Ads');
        return false;
      }

      if (data.success) {
        setLastResult({
          creativesSync: data.creativesSync,
          audienceSync: data.audienceSync,
          tagging: data.tagging,
        });

        const aiInfo = data.tagging.aiAvailable
          ? ` (${data.tagging.aiTagged} AI tagged)`
          : ' (AI no disponible)';

        toast.success(
          `Synced: ${data.creativesSync.synced} creatives, ${data.audienceSync.synced} audiences, ${data.tagging.ruleBased} tags${aiInfo}`
        );

        // Invalidate ad-related queries
        queryClient.invalidateQueries({ queryKey: ['ad-performance'] });
        queryClient.invalidateQueries({ queryKey: ['ad-tags'] });
        queryClient.invalidateQueries({ queryKey: ['ad-intelligence'] });
        return true;
      } else {
        toast.error(data.error || 'Error al sincronizar creative/tags');
        return false;
      }
    } catch (error: any) {
      console.error('Error syncing creative/tags:', error);
      toast.error('Error al sincronizar creative y tags');
      return false;
    } finally {
      setSyncing(false);
    }
  }, [orgId, queryClient]);

  return {
    syncing,
    lastResult,
    syncCreativeAndTags,
  };
}
