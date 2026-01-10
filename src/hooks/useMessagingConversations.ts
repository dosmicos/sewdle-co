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
        .order('last_message_at', { ascending: false, nullsFirst: false });

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

  // Subscribe to realtime updates - optimistic cache update without flickering
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
          if (payload.eventType === 'INSERT') {
            // New conversation - add to cache at the top
            queryClient.setQueryData(
              ['messaging-conversations', channelFilter],
              (old: MessagingConversation[] | undefined) => {
                if (!old) return [payload.new as MessagingConversation];
                const exists = old.some(c => c.id === (payload.new as any).id);
                if (exists) return old;
                return [payload.new as MessagingConversation, ...old];
              }
            );
          } else if (payload.eventType === 'UPDATE') {
            // Update existing conversation in cache and re-sort by last_message_at
            queryClient.setQueryData(
              ['messaging-conversations', channelFilter],
              (old: MessagingConversation[] | undefined) => {
                if (!old) return old;
                const updated = old.map(c => 
                  c.id === (payload.new as any).id 
                    ? { ...c, ...(payload.new as MessagingConversation) } 
                    : c
                );
                // Re-sort by last_message_at descending
                return updated.sort((a, b) => {
                  const dateA = new Date(a.last_message_at || 0).getTime();
                  const dateB = new Date(b.last_message_at || 0).getTime();
                  return dateB - dateA;
                });
              }
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove from cache
            queryClient.setQueryData(
              ['messaging-conversations', channelFilter],
              (old: MessagingConversation[] | undefined) => {
                if (!old) return old;
                return old.filter(c => c.id !== (payload.old as any).id);
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, channelFilter]);

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

  // Toggle AI managed status with optimistic update
  const toggleAiManaged = useMutation({
    mutationFn: async ({ conversationId, aiManaged }: { conversationId: string; aiManaged: boolean }) => {
      console.log(`Toggling ai_managed to ${aiManaged} for conversation ${conversationId}`);
      
      const { error } = await supabase
        .from('messaging_conversations')
        .update({ ai_managed: aiManaged })
        .eq('id', conversationId);
      
      if (error) throw error;
      return { conversationId, aiManaged };
    },
    // Optimistic update - immediately update cache before server confirms
    onMutate: async ({ conversationId, aiManaged }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messaging-conversations'] });
      
      // Snapshot previous value
      const previousConversations = queryClient.getQueryData(['messaging-conversations', channelFilter]);
      
      // Optimistically update cache
      queryClient.setQueryData(
        ['messaging-conversations', channelFilter],
        (old: MessagingConversation[] | undefined) => {
          if (!old) return old;
          return old.map(c => 
            c.id === conversationId 
              ? { ...c, ai_managed: aiManaged } 
              : c
          );
        }
      );
      
      return { previousConversations };
    },
    onSuccess: (_, { aiManaged }) => {
      toast.success(aiManaged 
        ? 'IA activada: Responderá automáticamente' 
        : 'Control manual activado: Solo tú responderás');
    },
    onError: (error: any, _, context) => {
      console.error('Error toggling AI managed:', error);
      // Rollback on error
      if (context?.previousConversations) {
        queryClient.setQueryData(['messaging-conversations', channelFilter], context.previousConversations);
      }
      toast.error('Error al cambiar el control de la conversación');
    },
  });

  // Delete a conversation and its messages
  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      // First delete all messages in the conversation
      const { error: msgError } = await supabase
        .from('messaging_messages')
        .delete()
        .eq('conversation_id', conversationId);
      
      if (msgError) throw msgError;
      
      // Then delete the conversation
      const { error } = await supabase
        .from('messaging_conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
      toast.success('Conversación eliminada');
    },
    onError: (error: any) => {
      console.error('Error deleting conversation:', error);
      toast.error(`Error al eliminar: ${error.message}`);
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
            status: 'active',
            // Por defecto: IA activa en chats nuevos (puedes apagarla por conversación con el switch)
            ai_managed: true,
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

       if (error) {
         const anyError: any = error;
         let messageText = error.message || 'Error enviando mensaje';
         const resp: Response | undefined = anyError?.context?.response;

         if (resp) {
           try {
             const body = await resp.clone().json();
             messageText = body?.details || body?.error || messageText;
           } catch {
             // ignore JSON parsing errors
           }
         }

         throw new Error(messageText);
       }

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
    deleteConversation: deleteConversation.mutate,
    isDeletingConversation: deleteConversation.isPending,
    createConversation: createConversation.mutateAsync,
    isCreatingConversation: createConversation.isPending,
    toggleAiManaged: toggleAiManaged.mutate,
    isTogglingAiManaged: toggleAiManaged.isPending,
  };
};
