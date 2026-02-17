import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MessagingConversation, ConversationTagInfo } from './useMessagingConversations';

export interface SearchResult {
  conversation: MessagingConversation;
  matchedMessage?: {
    id: string;
    content: string;
    sent_at: string;
  };
  matchType: 'phone' | 'name' | 'message';
}

interface UseMessagingSearchOptions {
  channelFilter?: 'all' | 'whatsapp' | 'instagram' | 'messenger';
  statusFilter?: 'inbox' | 'needs-help' | 'ai-managed';
  tagFilter?: string | null;
  debounceMs?: number;
}

// Normalize text for accent-insensitive search
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export const useMessagingSearch = (options: UseMessagingSearchOptions = {}) => {
  const { 
    channelFilter = 'all', 
    statusFilter = 'inbox',
    tagFilter = null,
    debounceMs = 500 
  } = options;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search term
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!searchTerm.trim()) {
      setDebouncedTerm('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedTerm(searchTerm.trim());
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, debounceMs]);

  const { data: searchResults, isLoading, isFetching } = useQuery({
    queryKey: ['messaging-search', debouncedTerm, channelFilter, statusFilter, tagFilter],
    queryFn: async ({ signal }) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      if (!debouncedTerm) {
        return [];
      }

      const normalizedSearch = normalizeText(debouncedTerm);
      const results: SearchResult[] = [];
      const addedConversationIds = new Set<string>();

      // 1. Search by phone number and name in conversations
      let convQuery = supabase
        .from('messaging_conversations')
        .select(`
          *,
          channel:messaging_channels(id, channel_type, channel_name)
        `)
        .or(`user_identifier.ilike.%${debouncedTerm}%,external_user_id.ilike.%${debouncedTerm}%,user_name.ilike.%${debouncedTerm}%`)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(50);

      // Apply channel filter
      if (channelFilter !== 'all') {
        convQuery = convQuery.eq('channel_type', channelFilter);
      }

      const { data: convData, error: convError } = await convQuery;
      
      if (convError) {
        console.error('Error searching conversations:', convError);
        throw convError;
      }

      // Fetch tags for found conversations
      const conversationIds = convData?.map(c => c.id) || [];
      let tagsByConversation: Record<string, ConversationTagInfo[]> = {};
      
      if (conversationIds.length > 0) {
        const { data: assignmentsData } = await supabase
          .from('messaging_conversation_tag_assignments')
          .select(`
            conversation_id,
            tag:messaging_conversation_tags(id, name, color)
          `)
          .in('conversation_id', conversationIds);
        
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
      }

      // Add conversation results
      convData?.forEach(conv => {
        const convWithTags = {
          ...conv,
          tags: tagsByConversation[conv.id] || [],
        } as MessagingConversation;

        // Determine match type
        const phoneMatch = normalizeText(conv.user_identifier || '').includes(normalizedSearch) ||
                          normalizeText(conv.external_user_id || '').includes(normalizedSearch);
        
        results.push({
          conversation: convWithTags,
          matchType: phoneMatch ? 'phone' : 'name',
        });
        addedConversationIds.add(conv.id);
      });

      // 2. Search in message content
      let msgQuery = supabase
        .from('messaging_messages')
        .select('id, conversation_id, content, sent_at')
        .ilike('content', `%${debouncedTerm}%`)
        .order('sent_at', { ascending: false })
        .limit(100);

      const { data: msgData, error: msgError } = await msgQuery;
      
      if (msgError) {
        console.error('Error searching messages:', msgError);
      } else if (msgData) {
        // Get unique conversation IDs that we haven't already added
        const newConvIds = [...new Set(
          msgData
            .map(m => m.conversation_id)
            .filter(id => !addedConversationIds.has(id))
        )].slice(0, 50);

        if (newConvIds.length > 0) {
          // Fetch these conversations
          let newConvQuery = supabase
            .from('messaging_conversations')
            .select(`
              *,
              channel:messaging_channels(id, channel_type, channel_name)
            `)
            .in('id', newConvIds)
            .order('last_message_at', { ascending: false, nullsFirst: false });

          if (channelFilter !== 'all') {
            newConvQuery = newConvQuery.eq('channel_type', channelFilter);
          }

          const { data: newConvData } = await newConvQuery;

          // Fetch tags for new conversations
          if (newConvData && newConvData.length > 0) {
            const { data: newAssignmentsData } = await supabase
              .from('messaging_conversation_tag_assignments')
              .select(`
                conversation_id,
                tag:messaging_conversation_tags(id, name, color)
              `)
              .in('conversation_id', newConvData.map(c => c.id));
            
            newAssignmentsData?.forEach(assignment => {
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
          }

          // Add message-matched conversations with their matched message
          newConvData?.forEach(conv => {
            const matchedMsg = msgData.find(m => m.conversation_id === conv.id);
            const convWithTags = {
              ...conv,
              tags: tagsByConversation[conv.id] || [],
            } as MessagingConversation;

            results.push({
              conversation: convWithTags,
              matchedMessage: matchedMsg ? {
                id: matchedMsg.id,
                content: matchedMsg.content || '',
                sent_at: matchedMsg.sent_at || '',
              } : undefined,
              matchType: 'message',
            });
            addedConversationIds.add(conv.id);
          });
        }
      }

      // Apply status filter
      let filteredResults = results;
      if (statusFilter === 'needs-help') {
        filteredResults = results.filter(r => 
          r.conversation.status === 'open' || !r.conversation.ai_managed
        );
      } else if (statusFilter === 'ai-managed') {
        filteredResults = results.filter(r => 
          r.conversation.ai_managed === true
        );
      }

      // Apply tag filter
      if (tagFilter) {
        filteredResults = filteredResults.filter(r => 
          r.conversation.tags?.some(t => t.id === tagFilter)
        );
      }

      setIsSearching(false);
      return filteredResults;
    },
    enabled: !!debouncedTerm,
    staleTime: 30000,
  });

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedTerm('');
    setIsSearching(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    searchResults: searchResults || [],
    isSearching: isSearching || isLoading || isFetching,
    hasSearchTerm: !!searchTerm.trim(),
    clearSearch,
  };
};
