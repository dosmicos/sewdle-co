import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tag, Plus, X, Settings } from 'lucide-react';
import { useUgcCreatorTags, useUgcCreatorTagAssignments } from '@/hooks/useUgcCreatorTags';

const TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#9ca3af',
];

interface UgcCreatorTagsManagerProps {
  creatorId: string;
  compact?: boolean;
}

export const UgcCreatorTagsManager: React.FC<UgcCreatorTagsManagerProps> = ({
  creatorId,
  compact = false,
}) => {
  const { tags, createTag, deleteTag } = useUgcCreatorTags();
  const { assignments, tagIds, assignTag, removeTag } = useUgcCreatorTagAssignments(creatorId);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[4]);
  const [showCreate, setShowCreate] = useState(false);

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    createTag.mutate(
      { name: newTagName.trim(), color: newTagColor },
      {
        onSuccess: () => {
          setNewTagName('');
          setShowCreate(false);
        },
      }
    );
  };

  const handleToggleTag = (tagId: string) => {
    if (tagIds.includes(tagId)) {
      removeTag.mutate({ creatorId, tagId });
    } else {
      assignTag.mutate({ creatorId, tagId });
    }
  };

  const assignedTags = assignments.map((a) => a.tag);

  return (
    <div className="space-y-2">
      {/* Assigned tags display */}
      <div className="flex flex-wrap gap-1">
        {assignedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="outline"
            className="text-xs gap-1 pr-1"
            style={{ borderColor: tag.color, color: tag.color }}
          >
            {tag.name}
            {!compact && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag.mutate({ creatorId, tagId: tag.id });
                }}
                className="ml-0.5 hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground">
              <Tag className="h-3 w-3 mr-0.5" />
              {compact ? '' : 'Etiquetas'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-3">
              <p className="text-sm font-medium">Etiquetas</p>

              {/* Existing tags */}
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {tags.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Sin etiquetas creadas</p>
                )}
                {tags.map((tag) => {
                  const isAssigned = tagIds.includes(tag.id);
                  return (
                    <div
                      key={tag.id}
                      className={`flex items-center justify-between p-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                        isAssigned ? 'bg-muted/70' : ''
                      }`}
                      onClick={() => handleToggleTag(tag.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm">{tag.name}</span>
                      </div>
                      {isAssigned && <span className="text-xs text-primary">✓</span>}
                    </div>
                  );
                })}
              </div>

              {/* Create new tag */}
              {showCreate ? (
                <div className="space-y-2 border-t border-border pt-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Nombre de etiqueta"
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                  />
                  <div className="flex flex-wrap gap-1">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${
                          newTagColor === color ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewTagColor(color)}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreateTag} disabled={createTag.isPending}>
                      Crear
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCreate(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs justify-start"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Crear etiqueta
                </Button>
              )}

              {/* Delete tags */}
              {tags.length > 0 && !showCreate && (
                <div className="border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground mb-1">Eliminar etiqueta:</p>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-destructive/10 gap-1"
                        style={{ borderColor: tag.color, color: tag.color }}
                        onClick={() => {
                          if (confirm(`¿Eliminar la etiqueta "${tag.name}"?`)) {
                            deleteTag.mutate(tag.id);
                          }
                        }}
                      >
                        {tag.name} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
