import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { MessagingConversation } from './useMessagingConversations';
import { MessagingMessage } from './useMessagingMessages';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseMessagingRealtimeOptions {
  organizationId?: string;
  enabled?: boolean;
}

const CONNECTION_TIMEOUT_MS = 10000; // 10 seconds timeout
const POLLING_INTERVAL_MS = 10000; // 10 seconds polling fallback

export const useMessagingRealtime = ({ organizationId, enabled = true }: UseMessagingRealtimeOptions = {}) => {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Start polling fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling
    
    console.log('🔄 [Realtime] Starting polling fallback every 10s');
    
    pollingIntervalRef.current = setInterval(() => {
      if (!isUnmountedRef.current) {
        console.log('🔄 [Realtime] Polling for new messages...');
        queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['messaging-messages'] });
      }
    }, POLLING_INTERVAL_MS);
  }, [queryClient]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('🔄 [Realtime] Stopping polling fallback');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const handleNewMessage = useCallback((payload: { new: MessagingMessage }) => {
    const newMessage = payload.new;
    const conversationId = newMessage.conversation_id;

    console.log('📨 [Realtime] New message received:', newMessage.id, 'for conversation:', conversationId);

    // Update messages cache for the specific conversation
    queryClient.setQueryData(
      ['messaging-messages', conversationId],
      (oldMessages: MessagingMessage[] | undefined) => {
        if (!oldMessages) return [newMessage];
        
        // Avoid duplicates
        const exists = oldMessages.some(m => m.id === newMessage.id);
        if (exists) return oldMessages;
        
        return [...oldMessages, newMessage];
      }
    );

    // Update conversations list - update preview and move to top
    queryClient.setQueriesData<MessagingConversation[]>(
      { queryKey: ['messaging-conversations'] },
      (oldConversations) => {
        if (!oldConversations) return oldConversations;
        
        const updated = oldConversations.map(conv => {
          if (conv.id !== conversationId) return conv;
          
          // Determine preview text based on message type
          let preview = newMessage.content || '';
          if (newMessage.message_type === 'image') preview = '📷 Imagen';
          else if (newMessage.message_type === 'audio') preview = '🎵 Audio';
          else if (newMessage.message_type === 'video') preview = '🎬 Video';
          else if (newMessage.message_type === 'sticker') preview = '🏷️ Sticker';
          else if (newMessage.message_type === 'document') preview = '📄 Documento';
          
          // Increment unread if incoming message
          const isIncoming = newMessage.direction === 'inbound';
          
          return {
            ...conv,
            last_message_preview: preview,
            last_message_at: newMessage.sent_at || new Date().toISOString(),
            unread_count: isIncoming ? (conv.unread_count || 0) + 1 : conv.unread_count,
          };
        });
        
        // Sort by last_message_at descending
        return updated.sort((a, b) => {
          const dateA = new Date(a.last_message_at || 0).getTime();
          const dateB = new Date(b.last_message_at || 0).getTime();
          return dateB - dateA;
        });
      }
    );
  }, [queryClient]);

  const handleMessageUpdate = useCallback((payload: { new: MessagingMessage }) => {
    const updatedMessage = payload.new;
    const conversationId = updatedMessage.conversation_id;

    console.log('📝 [Realtime] Message updated:', updatedMessage.id);

    // Update message in cache (e.g., when media_url is filled)
    queryClient.setQueryData(
      ['messaging-messages', conversationId],
      (oldMessages: MessagingMessage[] | undefined) => {
        if (!oldMessages) return [updatedMessage];

        const idx = oldMessages.findIndex(m => m.id === updatedMessage.id);
        if (idx === -1) return [...oldMessages, updatedMessage];

        const copy = oldMessages.slice();
        copy[idx] = { ...copy[idx], ...updatedMessage };
        return copy;
      }
    );
  }, [queryClient]);

  const handleConversationChange = useCallback((payload: { eventType: string; new?: MessagingConversation; old?: { id: string } }) => {
    console.log('💬 [Realtime] Conversation change:', payload.eventType);

    if (payload.eventType === 'INSERT' && payload.new) {
      queryClient.setQueriesData<MessagingConversation[]>(
        { queryKey: ['messaging-conversations'] },
        (old) => {
          if (!old) return [payload.new as MessagingConversation];
          const exists = old.some(c => c.id === payload.new!.id);
          if (exists) return old;
          return [payload.new as MessagingConversation, ...old];
        }
      );
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      queryClient.setQueriesData<MessagingConversation[]>(
        { queryKey: ['messaging-conversations'] },
        (old) => {
          if (!old) return old;
          const updated = old.map(c => 
            c.id === payload.new!.id 
              ? { ...c, ...payload.new } 
              : c
          );
          return updated.sort((a, b) => {
            const dateA = new Date(a.last_message_at || 0).getTime();
            const dateB = new Date(b.last_message_at || 0).getTime();
            return dateB - dateA;
          });
        }
      );
    } else if (payload.eventType === 'DELETE' && payload.old) {
      queryClient.setQueriesData<MessagingConversation[]>(
        { queryKey: ['messaging-conversations'] },
        (old) => {
          if (!old) return old;
          return old.filter(c => c.id !== payload.old!.id);
        }
      );
    }
  }, [queryClient]);

  const setupSubscription = useCallback(() => {
    if (!enabled || isUnmountedRef.current) return;

    // Clean up existing channel
    if (channelRef.current) {
      console.log('🔌 [Realtime] Removing existing channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    clearTimers();
    setConnectionStatus('connecting');

    const channelName = `messaging-realtime-${Date.now()}`;

    console.log('🔌 [Realtime] Setting up subscription:', channelName);

    // Set connection timeout
    timeoutRef.current = setTimeout(() => {
      if (!isUnmountedRef.current && connectionStatus !== 'connected') {
        console.log('⏰ [Realtime] Connection timeout after 10s');
        setConnectionStatus('disconnected');
        startPolling();
      }
    }, CONNECTION_TIMEOUT_MS);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messaging_messages',
        },
        (payload) => handleNewMessage({ new: payload.new as MessagingMessage })
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messaging_messages',
        },
        (payload) => handleMessageUpdate({ new: payload.new as MessagingMessage })
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messaging_conversations',
        },
        (payload) => handleConversationChange({ 
          eventType: payload.eventType, 
          new: payload.new as MessagingConversation | undefined, 
          old: payload.old as { id: string } | undefined 
        })
      )
      .subscribe((status, err) => {
        console.log('📡 [Realtime] Subscription status:', status, err || '');
        
        if (isUnmountedRef.current) return;
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Connected successfully');
          clearTimers();
          stopPolling();
          setConnectionStatus('connected');
          setLastConnectedAt(new Date());
          reconnectAttemptsRef.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('❌ [Realtime] Connection error:', status);
          setConnectionStatus('disconnected');
          startPolling();
          
          // Schedule reconnection with exponential backoff
          const delay = Math.min(3000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 [Realtime] Will attempt reconnect in ${delay}ms`);
          
          reconnectAttemptsRef.current += 1;
          
          timeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              setConnectionStatus('reconnecting');
              setupSubscription();
            }
          }, delay);
        } else if (status === 'CLOSED') {
          console.log('🔌 [Realtime] Channel closed');
          setConnectionStatus('disconnected');
          startPolling();
        }
      });

    channelRef.current = channel;
  }, [enabled, handleNewMessage, handleMessageUpdate, handleConversationChange, clearTimers, startPolling, stopPolling, connectionStatus]);

  // Initial setup and cleanup
  useEffect(() => {
    isUnmountedRef.current = false;
    
    if (enabled) {
      setupSubscription();
    }

    return () => {
      isUnmountedRef.current = true;
      clearTimers();
      stopPolling();
      
      if (channelRef.current) {
        console.log('🔌 [Realtime] Cleaning up subscription on unmount');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled]); // Only re-run when enabled changes

  // Manual reconnect function
  const reconnect = useCallback(() => {
    console.log('🔄 [Realtime] Manual reconnect triggered');
    clearTimers();
    stopPolling();
    reconnectAttemptsRef.current = 0;
    setConnectionStatus('reconnecting');
    setupSubscription();
  }, [clearTimers, stopPolling, setupSubscription]);

  // Fetch missed messages when reconnecting
  const fetchMissedMessages = useCallback(async () => {
    if (!lastConnectedAt) return;

    console.log('📥 [Realtime] Fetching messages since:', lastConnectedAt);
    
    // Invalidate all messaging queries to get fresh data
    await queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
    await queryClient.invalidateQueries({ queryKey: ['messaging-messages'] });
  }, [queryClient, lastConnectedAt]);

  // When reconnected, fetch missed messages
  useEffect(() => {
    if (connectionStatus === 'connected' && lastConnectedAt) {
      fetchMissedMessages();
    }
  }, [connectionStatus, lastConnectedAt, fetchMissedMessages]);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    isReconnecting: connectionStatus === 'reconnecting',
    reconnect,
  };
};
