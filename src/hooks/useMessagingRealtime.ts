import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseMessagingRealtimeOptions {
  organizationId?: string;
  enabled?: boolean;
  activeConversationId?: string | null;
}

const POLL_INTERVAL_MS = 30000; // Poll every 30 seconds (reduced from 5s to save DB resources)

export const useMessagingRealtime = ({ 
  organizationId, 
  enabled = true, 
  activeConversationId 
}: UseMessagingRealtimeOptions = {}) => {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const activeConversationIdRef = useRef(activeConversationId);

  // Keep ref in sync
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Refresh all conversation and message queries
  const refreshAll = useCallback(() => {
    console.log('🔄 [Messaging] Refreshing conversations and messages...');
    
    // Invalidate all conversation queries
    queryClient.invalidateQueries({ 
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'messaging-conversations'
    });
    
    // Invalidate active conversation messages
    if (activeConversationIdRef.current) {
      queryClient.invalidateQueries({ 
        queryKey: ['messaging-messages', activeConversationIdRef.current] 
      });
    }
  }, [queryClient]);

  // Start polling - this is the primary refresh mechanism
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    
    console.log('🔄 [Messaging] Starting polling every 30s');
    pollingRef.current = setInterval(() => {
      if (!isUnmountedRef.current) {
        refreshAll();
      }
    }, POLL_INTERVAL_MS);
  }, [refreshAll]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Cleanup realtime channel
  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Setup realtime (as optimization, not primary)
  const setupRealtime = useCallback(() => {
    if (!organizationId || !enabled) return;

    cleanupChannel();

    const channelName = `messaging-${organizationId}-${Date.now()}`;
    console.log('🔌 [Realtime] Attempting connection:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messaging_messages' },
        (payload) => {
          console.log('📨 [Realtime] New message:', payload.new);
          refreshAll();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messaging_messages' },
        () => {
          console.log('📝 [Realtime] Message updated');
          refreshAll();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messaging_conversations' },
        () => {
          console.log('💬 [Realtime] Conversation changed');
          refreshAll();
        }
      )
      .subscribe((status, err) => {
        console.log('📡 [Realtime] Status:', status, err?.message || '');
        
        if (isUnmountedRef.current) return;

        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setLastConnectedAt(new Date());
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('disconnected');
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected');
        }
      });

    channelRef.current = channel;

    // Timeout after 10s
    setTimeout(() => {
      if (!isUnmountedRef.current && connectionStatus === 'connecting') {
        setConnectionStatus('disconnected');
      }
    }, 10000);
  }, [organizationId, enabled, cleanupChannel, refreshAll, connectionStatus]);

  // Main effect - start polling immediately, try realtime as bonus
  useEffect(() => {
    if (!enabled) return;

    isUnmountedRef.current = false;
    setConnectionStatus('connecting');

    // Start polling immediately - this ensures messages are always fetched
    startPolling();

    // Try to setup realtime for instant updates (optional enhancement)
    if (organizationId) {
      setupRealtime();
    }

    return () => {
      isUnmountedRef.current = true;
      stopPolling();
      cleanupChannel();
    };
  }, [enabled, organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual refresh function
  const manualRefresh = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  return {
    connectionStatus,
    lastConnectedAt,
    manualRefresh,
  };
};
