import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageCircle, Clock, CheckCheck, Instagram, Facebook, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchResult } from '@/hooks/useMessagingSearch';
import { Conversation, ChannelType } from './ConversationsList';

interface SearchResultsListProps {
  results: SearchResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchTerm: string;
}

const channelConfig: Record<ChannelType, { icon: React.ElementType; color: string; bgColor: string }> = {
  whatsapp: { 
    icon: MessageCircle, 
    color: 'text-emerald-500', 
    bgColor: 'bg-emerald-500' 
  },
  instagram: { 
    icon: Instagram, 
    color: 'text-pink-500', 
    bgColor: 'bg-pink-500' 
  },
  messenger: { 
    icon: Facebook, 
    color: 'text-blue-500', 
    bgColor: 'bg-blue-500' 
  },
};

// Highlight matching text in a string
const highlightMatch = (text: string, searchTerm: string): React.ReactNode => {
  if (!searchTerm.trim()) return text;
  
  const normalizeForSearch = (str: string) => 
    str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const normalizedText = normalizeForSearch(text);
  const normalizedSearch = normalizeForSearch(searchTerm);
  
  const matchIndex = normalizedText.indexOf(normalizedSearch);
  if (matchIndex === -1) return text;
  
  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + searchTerm.length);
  const after = text.slice(matchIndex + searchTerm.length);
  
  return (
    <>
      {before}
      <mark className="bg-accent text-accent-foreground font-medium rounded px-0.5">{match}</mark>
      {after}
    </>
  );
};

// Truncate text around the match
const getMatchContext = (content: string, searchTerm: string, maxLength: number = 80): string => {
  const normalizeForSearch = (str: string) => 
    str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const normalizedContent = normalizeForSearch(content);
  const normalizedSearch = normalizeForSearch(searchTerm);
  
  const matchIndex = normalizedContent.indexOf(normalizedSearch);
  if (matchIndex === -1) return content.slice(0, maxLength);
  
  // Calculate start position to center the match
  const contextPadding = Math.floor((maxLength - searchTerm.length) / 2);
  let start = Math.max(0, matchIndex - contextPadding);
  let end = Math.min(content.length, matchIndex + searchTerm.length + contextPadding);
  
  let result = content.slice(start, end);
  
  if (start > 0) result = '...' + result;
  if (end < content.length) result = result + '...';
  
  return result;
};

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  results,
  selectedId,
  onSelect,
  searchTerm,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'open': return 'bg-emerald-500';
      case 'pending': return 'bg-amber-500';
      case 'resolved':
      case 'closed': return 'bg-slate-400';
      default: return 'bg-slate-400';
    }
  };

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground px-4">
        <SearchX className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-center">
          No se encontraron resultados para "<span className="font-medium">{searchTerm}</span>"
        </p>
        <p className="text-sm text-center mt-2">
          Intenta con otro número, nombre o palabra
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-[calc(100vh-320px)]">
      <div className="divide-y divide-border">
        {results.map((result, index) => {
          const conv = result.conversation;
          const channel = (conv.channel_type || 'whatsapp') as ChannelType;
          const channelInfo = channelConfig[channel];
          const ChannelIcon = channelInfo.icon;
          
          const displayName = conv.user_name || conv.user_identifier || 'Sin nombre';
          const phone = conv.user_identifier || conv.external_user_id || '';
          const lastMessageTime = conv.last_message_at 
            ? new Date(conv.last_message_at) 
            : new Date(conv.created_at || new Date());
          
          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "px-3 py-2 cursor-pointer transition-all duration-200 hover:bg-muted/50 group relative animate-in fade-in-0 slide-in-from-top-1",
                selectedId === conv.id && "bg-muted border-l-4 border-l-primary"
              )}
              style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <ChannelIcon className={cn("h-3.5 w-3.5 flex-shrink-0", channelInfo.color)} />
                    <span className="text-sm font-medium truncate text-foreground">
                      {result.matchType === 'name' 
                        ? highlightMatch(displayName, searchTerm)
                        : displayName
                      }
                    </span>
                    <span className={cn("w-1.5 h-1.5 rounded-full", getStatusColor(conv.status || 'open'))} />
                  </div>
                  <p className="text-xs truncate mt-0.5 text-muted-foreground">
                    {result.matchType === 'phone' 
                      ? highlightMatch(phone, searchTerm)
                      : phone
                    }
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(lastMessageTime, { addSuffix: true, locale: es })}
                  </span>
                  {(conv.unread_count || 0) > 0 && (
                    <Badge className={cn("text-white text-[10px] px-1 py-0 min-w-[18px] h-4 flex items-center justify-center", channelInfo.bgColor)}>
                      {conv.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Show matched message content if search matched a message */}
              {result.matchType === 'message' && result.matchedMessage ? (
                <div className="mt-1.5 p-1.5 rounded bg-muted/50 border border-border/50">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {highlightMatch(
                      getMatchContext(result.matchedMessage.content, searchTerm),
                      searchTerm
                    )}
                  </p>
                </div>
              ) : (
                <p 
                  className={cn(
                    "text-xs mt-1 truncate",
                    (conv.unread_count || 0) > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {conv.last_message_preview || ''}
                </p>
              )}
              
              {/* Match type badge */}
              <div className="absolute top-2 right-2">
                <Badge 
                  variant="secondary" 
                  className="text-[9px] px-1 py-0 h-4 opacity-60"
                >
                  {result.matchType === 'phone' && '📞'}
                  {result.matchType === 'name' && '👤'}
                  {result.matchType === 'message' && '💬'}
                </Badge>
              </div>
              
              {/* Tags display */}
              {conv.tags && conv.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {conv.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4"
                      style={{ 
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                        borderColor: `${tag.color}40`,
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {conv.tags.length > 3 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      +{conv.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
