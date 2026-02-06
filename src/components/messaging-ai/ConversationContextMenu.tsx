import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Pin, PinOff, MailOpen, Mail, FolderInput, FolderOutput, Trash2, Loader2 } from 'lucide-react';
import { MessagingFolder } from '@/hooks/useMessagingFolders';

interface ConversationContextMenuProps {
  conversationId: string;
  isPinned: boolean;
  isUnread: boolean;
  folderId: string | null;
  folders: MessagingFolder[];
  isDeleting: boolean;
  onTogglePin: () => void;
  onToggleUnread: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onDelete: () => void;
}

export const ConversationContextMenu: React.FC<ConversationContextMenuProps> = ({
  conversationId,
  isPinned,
  isUnread,
  folderId,
  folders,
  isDeleting,
  onTogglePin,
  onToggleUnread,
  onMoveToFolder,
  onDelete,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        {/* Unread / Read */}
        <DropdownMenuItem onClick={onToggleUnread}>
          {isUnread ? (
            <>
              <MailOpen className="h-4 w-4 mr-2" />
              Marcar como leído
            </>
          ) : (
            <>
              <Mail className="h-4 w-4 mr-2" />
              Marcar como no leído
            </>
          )}
        </DropdownMenuItem>

        {/* Pin / Unpin */}
        <DropdownMenuItem onClick={onTogglePin}>
          {isPinned ? (
            <>
              <PinOff className="h-4 w-4 mr-2" />
              Desfijar
            </>
          ) : (
            <>
              <Pin className="h-4 w-4 mr-2" />
              Fijar
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Move to folder */}
        {folders.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput className="h-4 w-4 mr-2" />
              Mover a carpeta
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {folders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => onMoveToFolder(folder.id)}
                  className={folderId === folder.id ? 'bg-accent' : ''}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
                    style={{ backgroundColor: folder.color }}
                  />
                  {folder.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* Remove from folder */}
        {folderId && (
          <DropdownMenuItem onClick={() => onMoveToFolder(null)}>
            <FolderOutput className="h-4 w-4 mr-2" />
            Sacar de carpeta
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Delete */}
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
