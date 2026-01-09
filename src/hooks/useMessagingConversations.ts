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

  // Create new conversation and send first message
  const createConversation = useMutation({
    mutationFn: async ({ phone, name, message }: { phone: string; name: string; message: string }) => {
      // Clean phone number
      const cleanPhone = phone.replace(/[\s+]/g, '');
      
      // First, check if conversation already exists
      const { data: existingConv } = await supabase
        .from('messaging_conversations')
        .select('id')
        .eq('external_user_id', cleanPhone)
        .eq('channel_type', 'whatsapp')
        .single();

      let conversationId: string;

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        // Get an existing WhatsApp channel (required since organization_id is mandatory)
        const { data: channel, error: channelError } = await supabase
          .from('messaging_channels')
          .select('id, organization_id')
          .eq('channel_type', 'whatsapp')
          .eq('is_active', true)
          .limit(1)
          .single();

        if (channelError || !channel) {
          throw new Error('No hay un canal de WhatsApp configurado. Configura un canal primero.');
        }

        // Create conversation
        const { data: newConv, error: convError } = await supabase
          .from('messaging_conversations')
          .insert({
            channel_id: channel.id,
            organization_id: channel.organization_id,
            channel_type: 'whatsapp',
            external_user_id: cleanPhone,
            user_identifier: phone,
            user_name: name || phone,
            status: 'open',
            ai_managed: false,
            unread_count: 0
          })
          .select('id')
          .single();

        if (convError) throw convError;
        conversationId = newConv.id;
      }

      // Send the message via edge function
      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: { conversation_id: conversationId, message }
      });

      if (error) throw error;

      return { conversationId, ...data };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
      toast.success('Conversación iniciada correctamente');
      return data.conversationId;
    },
    onError: (error: any) => {
      console.error('Error creating conversation:', error);
      toast.error(`Error al iniciar conversación: ${error.message}`);
    },
  });

  return {
    conversations: filteredConversations,
    isLoading,
    error,
    markAsRead: markAsRead.mutate,
    updateStatus: updateStatus.mutate,
    createConversation: createConversation.mutateAsync,
    isCreatingConversation: createConversation.isPending,
  };
};
