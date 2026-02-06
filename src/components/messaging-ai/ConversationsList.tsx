import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageCircle, Clock, CheckCheck, Instagram, Facebook, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationContextMenu } from './ConversationContextMenu';
import { MessagingFolder } from '@/hooks/useMessagingFolders';

export type ChannelType = 'whatsapp' | 'instagram' | 'messenger';

export interface ConversationTag {
  id: string;
  name: string;
  color: string;
}

export interface Conversation {
  id: string;
  phone: string;
  name: string;
  lastMessage: string;
  unread: number;
  lastMessageTime: Date;
  status: 'active' | 'pending' | 'resolved';
  channel: ChannelType;
  tags?: ConversationTag[];
  is_pinned?: boolean;
  folder_id?: string | null;
}

interface ConversationsListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
  onMarkAsUnread?: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onMoveToFolder?: (id: string, folderId: string | null) => void;
  folders?: MessagingFolder[];
  onCreateFolder?: () => void;
}

const channelConfig: Record<ChannelType, { icon: React.ElementType; color: string; bgColor: string }> = {
  whatsapp: { icon: MessageCircle, color: 'text-emerald-500', bgColor: 'bg-emerald-500' },
  instagram: { icon: Instagram, color: 'text-pink-500', bgColor: 'bg-pink-500' },
  messenger: { icon: Facebook, color: 'text-blue-500', bgColor: 'bg-blue-500' },
};

export const ConversationsList = ({ 
  conversations, 
  selectedId, 
  onSelect, 
  onDelete,
  isDeleting = false,
  onMarkAsUnread,
  onMarkAsRead,
  onTogglePin,
  onMoveToFolder,
  folders = [],
  onCreateFolder,
}: ConversationsListProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  const getStatusColor = (status: Conversation['status']) => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'pending': return 'bg-amber-500';
      case 'resolved': return 'bg-slate-400';
    }
  };

  // Separate pinned and unpinned, each sorted by lastMessageTime
  const { pinned, unpinned } = useMemo(() => {
    const p: Conversation[] = [];
    const u: Conversation[] = [];
    conversations.forEach(c => {
      if (c.is_pinned) p.push(c);
      else u.push(c);
    });
    // Both already sorted by backend, but ensure client-side order
    const sortFn = (a: Conversation, b: Conversation) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
    p.sort(sortFn);
    u.sort(sortFn);
    return { pinned: p, unpinned: u };
  }, [conversations]);

  const handleDeleteClick = (conversationId: string) => {
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (conversationToDelete && onDelete) {
      onDelete(conversationToDelete);
    }
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const renderConversation = (conversation: Conversation, index: number) => {
    const channelInfo = channelConfig[conversation.channel];
    const ChannelIcon = channelInfo.icon;
    const isPinned = conversation.is_pinned || false;
    const isUnread = (conversation.unread || 0) > 0;
    
    return (
      <div
        key={conversation.id}
        onClick={() => onSelect(conversation.id)}
        className={cn(
          "px-3 py-2 cursor-pointer transition-all duration-200 hover:bg-muted/50 group relative animate-in fade-in-0 slide-in-from-top-1",
          selectedId === conversation.id && "bg-muted border-l-4 border-l-primary"
        )}
        style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <ChannelIcon className={cn("h-3.5 w-3.5 flex-shrink-0", channelInfo.color)} />
              <span className="text-sm font-medium truncate text-foreground">
                {conversation.name}
              </span>
              {isPinned && <Pin className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
              <span className={cn("w-1.5 h-1.5 rounded-full", getStatusColor(conversation.status))} />
            </div>
            <p className="text-xs truncate mt-0.5 text-muted-foreground">
              {conversation.phone}
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(conversation.lastMessageTime, { addSuffix: true, locale: es })}
              </span>
              <ConversationContextMenu
                conversationId={conversation.id}
                isPinned={isPinned}
                isUnread={isUnread}
                folderId={conversation.folder_id || null}
                folders={folders}
                isDeleting={isDeleting && conversationToDelete === conversation.id}
                onTogglePin={() => onTogglePin?.(conversation.id, !isPinned)}
                onToggleUnread={() => {
                  if (isUnread) {
                    onMarkAsRead?.(conversation.id);
                  } else {
                    onMarkAsUnread?.(conversation.id);
                  }
                }}
                onMoveToFolder={(folderId) => onMoveToFolder?.(conversation.id, folderId)}
                onDelete={() => handleDeleteClick(conversation.id)}
                onCreateFolder={onCreateFolder}
              />
            </div>
            {isUnread && (
              <Badge className={cn("text-white text-[10px] px-1 py-0 min-w-[18px] h-4 flex items-center justify-center", channelInfo.bgColor)}>
                {conversation.unread}
              </Badge>
            )}
          </div>
        </div>
        <p 
          className={cn(
            "text-xs mt-1 truncate",
            isUnread ? "text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          {conversation.lastMessage}
        </p>
        {/* Tags display */}
        {conversation.tags && conversation.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {conversation.tags.slice(0, 3).map((tag) => (
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
            {conversation.tags.length > 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                +{conversation.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <ScrollArea className="flex-1 h-[calc(100vh-280px)]">
        <div className="divide-y divide-border">
          {/* Pinned section */}
          {pinned.length > 0 && (
            <>
              <div className="px-3 py-1.5 bg-muted/30">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Pin className="h-3 w-3" />
                  Fijados
                </span>
              </div>
              {pinned.map((c, i) => renderConversation(c, i))}
            </>
          )}
          {/* Unpinned section */}
          {pinned.length > 0 && unpinned.length > 0 && (
            <div className="px-3 py-1.5 bg-muted/30">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Todos los mensajes
              </span>
            </div>
          )}
          {unpinned.map((c, i) => renderConversation(c, pinned.length + i))}
        </div>
      </ScrollArea>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la conversación y todos sus mensajes. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
