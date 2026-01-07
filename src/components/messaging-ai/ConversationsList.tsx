import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageCircle, Clock, CheckCheck, Instagram, Facebook } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ChannelType = 'whatsapp' | 'instagram' | 'messenger';

export interface Conversation {
  id: string;
  phone: string;
  name: string;
  lastMessage: string;
  unread: number;
  lastMessageTime: Date;
  status: 'active' | 'pending' | 'resolved';
  channel: ChannelType;
}

interface ConversationsListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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

export const ConversationsList = ({ conversations, selectedId, onSelect }: ConversationsListProps) => {
  const getStatusColor = (status: Conversation['status']) => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'pending': return 'bg-amber-500';
      case 'resolved': return 'bg-slate-400';
    }
  };

  const getStatusIcon = (status: Conversation['status']) => {
    switch (status) {
      case 'active': return <MessageCircle className="h-3 w-3" />;
      case 'pending': return <Clock className="h-3 w-3" />;
      case 'resolved': return <CheckCheck className="h-3 w-3" />;
    }
  };

  return (
    <ScrollArea className="h-[480px]">
      <div className="divide-y divide-border">
        {conversations.map((conversation) => {
          const channelInfo = channelConfig[conversation.channel];
          const ChannelIcon = channelInfo.icon;
          
          return (
            <div
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cn(
                "p-4 cursor-pointer transition-colors hover:bg-muted/50",
                selectedId === conversation.id && "bg-muted border-l-4 border-l-primary"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <ChannelIcon className={cn("h-4 w-4 flex-shrink-0", channelInfo.color)} />
                    <span className="font-medium truncate text-foreground">
                      {conversation.name}
                    </span>
                    <span className={cn("w-2 h-2 rounded-full", getStatusColor(conversation.status))} />
                  </div>
                  <p className="text-sm truncate mt-0.5 text-muted-foreground">
                    {conversation.phone}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(conversation.lastMessageTime, { addSuffix: true, locale: es })}
                  </span>
                  {conversation.unread > 0 && (
                    <Badge className={cn("text-white text-xs px-1.5 py-0.5 min-w-[20px] flex items-center justify-center", channelInfo.bgColor)}>
                      {conversation.unread}
                    </Badge>
                  )}
                </div>
              </div>
              <p 
                className={cn(
                  "text-sm mt-2 truncate",
                  conversation.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {conversation.lastMessage}
              </p>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
