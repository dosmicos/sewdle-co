import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { ChannelType } from '@/components/messaging-ai/ConversationsList';
import { Tables } from '@/integrations/supabase/types';

export interface ConversationTagInfo {
  id: string;
  name: string;
  color: string;
}

export type MessagingConversation = Tables<'messaging_conversations'> & {
  channel?: {
    id: string;
    channel_type: string;
    channel_name: string | null;
  };
  tags?: ConversationTagInfo[];
};

export const useMessagingConversations = (channelFilter?: ChannelType | 'all') => {
  const queryClient = useQueryClient();

  const { data: conversations, isLoading, error } = useQuery({
    queryKey: ['messaging-conversations', channelFilter],
    queryFn: async () => {
      // Fetch conversations
      const { data: convData, error: convError } = await supabase
        .from('messaging_conversations')
        .select(`
          *,
          channel:messaging_channels(id, channel_type, channel_name)
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (convError) throw convError;
      
      // Fetch all tag assignments with their tags
      const { data: assignmentsData, error: assignError } = await supabase
        .from('messaging_conversation_tag_assignments')
        .select(`
          conversation_id,
          tag:messaging_conversation_tags(id, name, color)
        `);
      
      if (assignError) {
        console.error('Error fetching tag assignments:', assignError);
        // Continue without tags if there's an error
        return convData as MessagingConversation[];
      }
      
      // Group tags by conversation ID
      const tagsByConversation: Record<string, ConversationTagInfo[]> = {};
      assignmentsData?.forEach(assignment => {
        const convId = assignment.conversation_id;
        if (!tagsByConversation[convId]) {
          tagsByConversation[convId] = [];
        }
        if (assignment.tag) {
          tagsByConversation[convId].push({
            id: (assignment.tag as any).id,
            name: (assignment.tag as any).name,
            color: (assignment.tag as any).color,
          });
        }
      });
      
      // Attach tags to conversations
      const conversationsWithTags = convData?.map(conv => ({
        ...conv,
        tags: tagsByConversation[conv.id] || [],
      })) as MessagingConversation[];
      
      return conversationsWithTags;
    },
  });

  // Filter by channel type if specified
  const filteredConversations = conversations?.filter(conv => {
    if (!channelFilter || channelFilter === 'all') return true;
    return conv.channel_type === channelFilter;
  }) || [];

  // Realtime is now handled by useMessagingRealtime hook in MessagingAIPage
  // This prevents duplicate subscriptions and centralizes connection management

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
    mutationFn: async ({ phone, name, message, useTemplate }: { phone: string; name: string; message: string; useTemplate?: boolean }) => {
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
       const body: Record<string, any> = { conversation_id: conversationId };

       if (useTemplate) {
         body.template_name = 'saludo_inicial';
         body.template_language = 'es_CO';
         body.message = message; // texto para guardar en DB
       } else {
         body.message = message;
       }

       const { data, error } = await supabase.functions.invoke('send-whatsapp-message', { body });

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
      // Invalidar mensajes de la nueva conversación para que se carguen
      if (data?.conversationId) {
        queryClient.invalidateQueries({ queryKey: ['messaging-messages', data.conversationId] });
        // Refetch con delay para asegurar que la DB ya tiene el mensaje
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['messaging-messages', data.conversationId] });
        }, 1000);
      }
      toast.success('Conversación iniciada correctamente');
      return data.conversationId;
    },
    onError: (error: any) => {
      console.error('Error creating conversation:', error);
      toast.error(`Error al iniciar conversación: ${error.message}`);
    },
  });

  // Mark as unread
  const markAsUnread = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('messaging_conversations')
        .update({ unread_count: 1 })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: ['messaging-conversations'] });
      queryClient.setQueriesData(
        { queryKey: ['messaging-conversations'] },
        (old: MessagingConversation[] | undefined) => {
          if (!old) return old;
          return old.map(c =>
            c.id === conversationId ? { ...c, unread_count: Math.max(c.unread_count || 0, 1) } : c
          );
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
    },
  });

  // Toggle pin
  const togglePin = useMutation({
    mutationFn: async ({ conversationId, isPinned }: { conversationId: string; isPinned: boolean }) => {
      const { error } = await supabase
        .from('messaging_conversations')
        .update({ is_pinned: isPinned })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onMutate: async ({ conversationId, isPinned }) => {
      await queryClient.cancelQueries({ queryKey: ['messaging-conversations'] });
      const previous = queryClient.getQueryData(['messaging-conversations', channelFilter]);

      queryClient.setQueriesData(
        { queryKey: ['messaging-conversations'] },
        (old: MessagingConversation[] | undefined) => {
          if (!old) return old;
          return old.map(c =>
            c.id === conversationId ? { ...c, is_pinned: isPinned } : c
          );
        }
      );

      return { previous };
    },
    onError: (error: any, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['messaging-conversations', channelFilter], context.previous);
      }
      toast.error('Error al fijar/desfijar conversación');
    },
  });

  return {
    conversations: filteredConversations,
    isLoading,
    error,
    markAsRead: markAsRead.mutate,
    markAsUnread: markAsUnread.mutate,
    updateStatus: updateStatus.mutate,
    deleteConversation: deleteConversation.mutate,
    isDeletingConversation: deleteConversation.isPending,
    createConversation: createConversation.mutateAsync,
    isCreatingConversation: createConversation.isPending,
    toggleAiManaged: toggleAiManaged.mutate,
    isTogglingAiManaged: toggleAiManaged.isPending,
    togglePin: togglePin.mutate,
  };
};
