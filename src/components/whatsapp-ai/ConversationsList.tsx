import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageCircle, Clock, CheckCheck } from 'lucide-react';

interface Conversation {
  id: string;
  phone: string;
  name: string;
  lastMessage: string;
  unread: number;
  lastMessageTime: Date;
  status: 'active' | 'pending' | 'resolved';
}

interface ConversationsListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const ConversationsList = ({ conversations, selectedId, onSelect }: ConversationsListProps) => {
  const getStatusColor = (status: Conversation['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'resolved': return 'bg-gray-400';
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
      <div className="divide-y" style={{ borderColor: '#e5e7eb' }}>
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
              selectedId === conversation.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate" style={{ color: '#1f2937' }}>
                    {conversation.name}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(conversation.status)}`} />
                </div>
                <p className="text-sm truncate mt-0.5" style={{ color: '#6b7280' }}>
                  {conversation.phone}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs" style={{ color: '#9ca3af' }}>
                  {formatDistanceToNow(conversation.lastMessageTime, { addSuffix: true, locale: es })}
                </span>
                {conversation.unread > 0 && (
                  <Badge className="bg-green-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] flex items-center justify-center">
                    {conversation.unread}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-sm mt-2 truncate" style={{ color: conversation.unread > 0 ? '#1f2937' : '#6b7280', fontWeight: conversation.unread > 0 ? 500 : 400 }}>
              {conversation.lastMessage}
            </p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
