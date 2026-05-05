import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Plus, X, Tag, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMessagingTags, TAG_COLORS, MessagingTag } from '@/hooks/useMessagingTags';

interface ChatTagsManagerProps {
  conversationId: string;
}

export const ChatTagsManager: React.FC<ChatTagsManagerProps> = ({ conversationId }) => {
  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0].value);
  
  const { 
    tags, 
    useConversationTags, 
    assignTag, 
    removeTag,
    createTag,
    isCreatingTag,
    isAssigningTag,
  } = useMessagingTags();
  
  const { data: conversationTags = [], isLoading } = useConversationTags(conversationId);
  
  const assignedTagIds = new Set(conversationTags.map(ct => ct.tag_id));
  const availableTags = tags.filter(t => !assignedTagIds.has(t.id));

  const handleAssignTag = (tagId: string) => {
    assignTag({ conversationId, tagId });
  };

  const handleRemoveTag = (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeTag({ conversationId, tagId });
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      const newTag = await createTag({ name: newTagName, color: newTagColor });
      assignTag({ conversationId, tagId: newTag.id });
      setNewTagName('');
      setShowCreateForm(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Assigned tags as badges */}
      {conversationTags.map(({ tag }) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="text-xs px-2 py-0.5 gap-1 group cursor-default"
          style={{ 
            backgroundColor: `${tag.color}20`,
            color: tag.color,
            borderColor: `${tag.color}40`,
          }}
        >
          <span 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: tag.color }}
          />
          {tag.name}
          <button
            onClick={(e) => handleRemoveTag(tag.id, e)}
            className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Add tag button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
          >
            <Tag className="h-3.5 w-3.5" />
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          {!showCreateForm ? (
            <Command>
              <CommandInput placeholder="Buscar etiqueta..." />
              <CommandList>
                <CommandEmpty>
                  <div className="py-2 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      No hay etiquetas
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateForm(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Crear etiqueta
                    </Button>
                  </div>
                </CommandEmpty>
                {availableTags.length > 0 && (
                  <CommandGroup heading="Etiquetas disponibles">
                    {availableTags.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => {
                          handleAssignTag(tag.id);
                          setOpen(false);
                        }}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <span 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1">{tag.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {availableTags.length > 0 && <CommandSeparator />}
                <CommandGroup>
                  <CommandItem
                    onSelect={() => setShowCreateForm(true)}
                    className="cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear nueva etiqueta
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          ) : (
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Nueva etiqueta</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowCreateForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <Input
                placeholder="Nombre de la etiqueta"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-8"
                autoFocus
              />
              
              {/* Color picker */}
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setNewTagColor(color.value)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all",
                      newTagColor === color.value && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || isCreatingTag}
                >
                  {isCreatingTag ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Crear'
                  )}
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};
