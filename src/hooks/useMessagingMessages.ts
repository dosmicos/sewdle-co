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
    // Si ya hay datos en cache (ej: optimistic insert), mostrarlos primero
    // y hacer refetch en background sin borrar los datos existentes
    placeholderData: (previousData) => previousData,
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
      
      // Use fetch with AbortController for explicit timeout (supabase.functions.invoke has no timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${accessToken ?? supabaseKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        if (data?.error) {
          throw new Error(data.error);
        }
        return data;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-messages', conversationId], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['messaging-conversations'], exact: false, refetchType: 'all' });
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
    sendMessageAsync: sendMessage.mutateAsync,
    isSending: sendMessage.isPending,
  };
};
