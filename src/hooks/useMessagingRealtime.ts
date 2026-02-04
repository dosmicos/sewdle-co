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
  activeConversationId?: string | null;
}

const CONNECTION_TIMEOUT_MS = 10000; // 10 seconds timeout
const POLLING_INTERVAL_MS = 10000; // 10 seconds polling fallback

const isMessagingConversationsQuery = (queryKey: unknown): boolean => {
  return Array.isArray(queryKey) && queryKey.length > 0 && queryKey[0] === 'messaging-conversations';
};

const isMessagingMessagesQuery = (queryKey: unknown): boolean => {
  return Array.isArray(queryKey) && queryKey.length > 0 && queryKey[0] === 'messaging-messages';
};

const inferMessageType = (msg: MessagingMessage): string | null => {
  if (msg.message_type) return msg.message_type;

  const mime = msg.media_mime_type || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime) return 'document';

  const metadata = (typeof msg.metadata === 'object' && msg.metadata !== null)
    ? (msg.metadata as Record<string, any>)
    : undefined;

  if (!metadata) return null;
  if (metadata.image || metadata?.original_message?.image) return 'image';
  if (metadata.audio || metadata?.original_message?.audio) return 'audio';
  if (metadata.video || metadata?.original_message?.video) return 'video';
  if (metadata.sticker || metadata?.original_message?.sticker) return 'sticker';
  if (metadata.document || metadata?.original_message?.document) return 'document';
  return null;
};

export const useMessagingRealtime = ({ organizationId, enabled = true, activeConversationId }: UseMessagingRealtimeOptions = {}) => {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const statusRef = useRef<ConnectionStatus>('connecting');
  const activeConversationIdRef = useRef<string | null | undefined>(activeConversationId);
  const inflightConversationFetchRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    statusRef.current = connectionStatus;
  }, [connectionStatus]);

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
        queryClient.invalidateQueries({
          predicate: (q) => isMessagingConversationsQuery(q.queryKey) || isMessagingMessagesQuery(q.queryKey),
        });
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

  const markConnectedFromEvent = useCallback((source: string) => {
    if (isUnmountedRef.current) return;
    if (statusRef.current !== 'connected') {
      console.log(`✅ [Realtime] Event received while status=${statusRef.current}. Marking connected (${source}).`);
      clearTimers();
      stopPolling();
      reconnectAttemptsRef.current = 0;
      setConnectionStatus('connected');
      setLastConnectedAt(new Date());
    }
  }, [clearTimers, stopPolling]);

  const upsertConversationAcrossCaches = useCallback((updater: (old: MessagingConversation[] | undefined) => MessagingConversation[] | undefined) => {
    queryClient.setQueriesData<MessagingConversation[]>({
      predicate: (q) => isMessagingConversationsQuery(q.queryKey),
    }, updater);
  }, [queryClient]);

  const ensureConversationInCache = useCallback(async (conversationId: string) => {
    if (inflightConversationFetchRef.current.has(conversationId)) return;
    inflightConversationFetchRef.current.add(conversationId);

    try {
      console.log('🧲 [Realtime] Conversation missing in cache. Fetching:', conversationId);

      const { data: convData, error: convError } = await supabase
        .from('messaging_conversations')
        .select(`
          *,
          channel:messaging_channels(id, channel_type, channel_name)
        `)
        .eq('id', conversationId)
        .single();

      if (convError || !convData) {
        console.warn('🧲 [Realtime] Could not fetch conversation:', convError);
        return;
      }

      // Fetch tags for that conversation (optional)
      const { data: assignmentsData } = await supabase
        .from('messaging_conversation_tag_assignments')
        .select(`conversation_id, tag:messaging_conversation_tags(id, name, color)`)
        .eq('conversation_id', conversationId);

      const tags = (assignmentsData || [])
        .map((a: any) => a.tag)
        .filter(Boolean)
        .map((t: any) => ({ id: t.id, name: t.name, color: t.color }));

      const fullConversation: MessagingConversation = {
        ...(convData as any),
        tags,
      };

      upsertConversationAcrossCaches((old) => {
        const list = old ? old.slice() : [];
        const exists = list.some(c => c.id === conversationId);
        if (exists) return old;
        return [fullConversation, ...list];
      });
    } finally {
      inflightConversationFetchRef.current.delete(conversationId);
    }
  }, [upsertConversationAcrossCaches]);

  const handleNewMessage = useCallback((payload: { new: MessagingMessage }) => {
    const newMessage = payload.new;
    const conversationId = newMessage.conversation_id;

    markConnectedFromEvent('handleNewMessage');

    console.log('📨 [Realtime] New message received:', newMessage.id, 'for conversation:', conversationId);

    const messageType = inferMessageType(newMessage);

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
    let foundInAnyCache = false;

    upsertConversationAcrossCaches((oldConversations) => {
      if (!oldConversations) return oldConversations;

      const idx = oldConversations.findIndex(c => c.id === conversationId);
      if (idx === -1) return oldConversations;

      foundInAnyCache = true;

      // Determine preview text based on message type
      let preview = newMessage.content || '';
      if (messageType === 'image') preview = '📷 Imagen';
      else if (messageType === 'audio') preview = '🎵 Audio';
      else if (messageType === 'video') preview = '🎬 Video';
      else if (messageType === 'sticker') preview = '🏷️ Sticker';
      else if (messageType === 'document') preview = '📄 Documento';

      const isIncoming = newMessage.direction === 'inbound';
      const isActive = activeConversationIdRef.current === conversationId;
      const shouldIncrementUnread = isIncoming && !isActive;
      const nowIso = new Date().toISOString();
      const lastAt = newMessage.sent_at || newMessage.delivered_at || nowIso;

      const updatedList = oldConversations.slice();
      const existing = updatedList[idx];
      const updatedConv: MessagingConversation = {
        ...existing,
        last_message_preview: preview,
        last_message_at: lastAt,
        unread_count: shouldIncrementUnread ? (existing.unread_count || 0) + 1 : existing.unread_count,
      };

      updatedList[idx] = updatedConv;

      // Move to top
      updatedList.splice(idx, 1);
      updatedList.unshift(updatedConv);

      return updatedList;
    });

    if (!foundInAnyCache) {
      void ensureConversationInCache(conversationId);
    }
  }, [queryClient, markConnectedFromEvent, upsertConversationAcrossCaches, ensureConversationInCache]);

  const handleMessageUpdate = useCallback((payload: { new: MessagingMessage }) => {
    const updatedMessage = payload.new;
    const conversationId = updatedMessage.conversation_id;

    markConnectedFromEvent('handleMessageUpdate');

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
  }, [queryClient, markConnectedFromEvent]);

  const handleConversationChange = useCallback((payload: { eventType: string; new?: MessagingConversation; old?: { id: string } }) => {
    markConnectedFromEvent('handleConversationChange');
    console.log('💬 [Realtime] Conversation change:', payload.eventType);

    if (payload.eventType === 'INSERT' && payload.new) {
      upsertConversationAcrossCaches((old) => {
        if (!old) return [payload.new as MessagingConversation];
        const exists = old.some(c => c.id === payload.new!.id);
        if (exists) return old;
        return [payload.new as MessagingConversation, ...old];
      });
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      upsertConversationAcrossCaches((old) => {
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
      });
    } else if (payload.eventType === 'DELETE' && payload.old) {
      upsertConversationAcrossCaches((old) => {
        if (!old) return old;
        return old.filter(c => c.id !== payload.old!.id);
      });
    }
  }, [markConnectedFromEvent, upsertConversationAcrossCaches]);

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
    statusRef.current = 'connecting';

    const channelName = `messaging-realtime-${Date.now()}`;

    console.log('🔌 Intentando conectar a Supabase Realtime...');
    console.log('🔌 [Realtime] Setting up subscription:', channelName, { organizationId });

    // Set connection timeout
    timeoutRef.current = setTimeout(() => {
      if (!isUnmountedRef.current && statusRef.current !== 'connected') {
        console.log('⏰ [Realtime] Connection timeout after 10s');
        setConnectionStatus('disconnected');
        statusRef.current = 'disconnected';
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
        console.log('📡 Estado de conexión Realtime:', status, err || '');
        console.log('📡 [Realtime] Subscription status:', status, err || '');
        
        if (isUnmountedRef.current) return;
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Connected successfully');
          clearTimers();
          stopPolling();
          setConnectionStatus('connected');
          statusRef.current = 'connected';
          setLastConnectedAt(new Date());
          reconnectAttemptsRef.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('❌ [Realtime] Connection error:', status);
          setConnectionStatus('disconnected');
          statusRef.current = 'disconnected';
          startPolling();
          
          // Schedule reconnection with exponential backoff
          const delay = Math.min(3000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 [Realtime] Will attempt reconnect in ${delay}ms`);
          
          reconnectAttemptsRef.current += 1;
          
          timeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              setConnectionStatus('reconnecting');
              statusRef.current = 'reconnecting';
              setupSubscription();
            }
          }, delay);
        } else if (status === 'CLOSED') {
          console.log('🔌 [Realtime] Channel closed');
          setConnectionStatus('disconnected');
          statusRef.current = 'disconnected';
          startPolling();
        }
      });

    channelRef.current = channel;
  }, [enabled, handleNewMessage, handleMessageUpdate, handleConversationChange, clearTimers, startPolling, stopPolling, organizationId]);

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
    statusRef.current = 'reconnecting';
    setupSubscription();
  }, [clearTimers, stopPolling, setupSubscription]);

  // Fetch missed messages when reconnecting
  const fetchMissedMessages = useCallback(async () => {
    if (!lastConnectedAt) return;

    console.log('📥 [Realtime] Fetching messages since:', lastConnectedAt);
    
    // Invalidate all messaging queries to get fresh data
    await queryClient.invalidateQueries({
      predicate: (q) => isMessagingConversationsQuery(q.queryKey) || isMessagingMessagesQuery(q.queryKey),
    });
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
