import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { ChannelType } from '@/components/messaging-ai/ConversationsList';
import { Tables } from '@/integrations/supabase/types';

export type MessagingConversation = Tables<'messaging_conversations'> & {
  channel?: {
    id: string;
    channel_type: string;
    channel_name: string | null;
  };
};

export const useMessagingConversations = (channelFilter?: ChannelType | 'all') => {
  const queryClient = useQueryClient();

  const { data: conversations, isLoading, error } = useQuery({
    queryKey: ['messaging-conversations', channelFilter],
    queryFn: async () => {
      let query = supabase
        .from('messaging_conversations')
        .select(`
          *,
          channel:messaging_channels(id, channel_type, channel_name)
        `)
        .order('last_message_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;
      return data as MessagingConversation[];
    },
  });

  // Filter by channel type if specified
  const filteredConversations = conversations?.filter(conv => {
    if (!channelFilter || channelFilter === 'all') return true;
    return conv.channel_type === channelFilter;
  }) || [];

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('messaging-conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messaging_conversations'
        },
        (payload) => {
          console.log('Conversation update:', payload);
          queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('messaging_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ conversationId, status }: { conversationId: string; status: string }) => {
      const { error } = await supabase
        .from('messaging_conversations')
        .update({ status })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
    },
  });

  return {
    conversations: filteredConversations,
    isLoading,
    error,
    markAsRead: markAsRead.mutate,
    updateStatus: updateStatus.mutate,
  };
};
