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

  // Realtime is now handled by useMessagingRealtime hook in MessagingAIPage
  // This prevents duplicate subscriptions and centralizes connection management

  const sendMessage = useMutation({
    mutationFn: async ({ message, mediaFile, mediaType, replyToMessageId }: { message: string; mediaFile?: File; mediaType?: string; replyToMessageId?: string }) => {
      if (!conversationId) throw new Error('No conversation selected');
      
      let body: Record<string, any> = { 
        conversation_id: conversationId, 
        message,
        reply_to_message_id: replyToMessageId || null
      };

      // If there's a media file, convert to base64
      if (mediaFile && mediaType) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(mediaFile);
        });

        body = {
          ...body,
          media_base64: base64,
          media_type: mediaType,
          media_mime_type: mediaFile.type,
          media_filename: mediaFile.name
        };
      }
      
      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-messages', conversationId], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['messaging-conversations'], exact: false, refetchType: 'all' });
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
