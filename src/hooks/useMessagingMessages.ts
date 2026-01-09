import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

export type MessagingMessage = Tables<'messaging_messages'>;

export const useMessagingMessages = (conversationId: string | null) => {
  const queryClient = useQueryClient();

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['messaging-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('messaging_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });
      
      if (error) throw error;
      return data as MessagingMessage[];
    },
    enabled: !!conversationId,
  });

  // Subscribe to realtime updates for messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messaging-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messaging_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('New message:', payload);
          queryClient.invalidateQueries({ queryKey: ['messaging-messages', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      if (!conversationId) throw new Error('No conversation selected');
      
      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: { conversation_id: conversationId, message }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
      toast.success('Mensaje enviado');
    },
    onError: (error: any) => {
      console.error('Error sending message:', error);
      toast.error(`Error al enviar mensaje: ${error.message}`);
    },
  });

  return {
    messages: messages || [],
    isLoading,
    error,
    sendMessage: sendMessage.mutate,
    isSending: sendMessage.isPending,
  };
};
