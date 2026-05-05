import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Trash2, Pencil, X, Check, Loader2, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMessagingTags, TAG_COLORS, MessagingTag } from '@/hooks/useMessagingTags';

export const TagsSettingsPanel: React.FC = () => {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0].value);
  const [editingTag, setEditingTag] = useState<MessagingTag | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<MessagingTag | null>(null);
  
  const { 
    tags, 
    isLoadingTags,
    tagCounts,
    createTag, 
    isCreatingTag,
    updateTag,
    isUpdatingTag,
    deleteTag,
    isDeletingTag,
  } = useMessagingTags();

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      await createTag({ name: newTagName, color: newTagColor });
      setNewTagName('');
      setNewTagColor(TAG_COLORS[0].value);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleStartEdit = (tag: MessagingTag) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleSaveEdit = () => {
    if (!editingTag || !editName.trim()) return;
    
    updateTag({ 
      id: editingTag.id, 
      name: editName,
      color: editColor 
    });
    setEditingTag(null);
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setEditName('');
    setEditColor('');
  };

  const handleDeleteClick = (tag: MessagingTag) => {
    setTagToDelete(tag);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (tagToDelete) {
      deleteTag(tagToDelete.id);
    }
    setDeleteDialogOpen(false);
    setTagToDelete(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <Tag className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <CardTitle>Etiquetas de conversación</CardTitle>
            <CardDescription>
              Crea y gestiona etiquetas para clasificar tus conversaciones
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create new tag form */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Nueva etiqueta</label>
            <Input
              placeholder="Nombre de la etiqueta"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-1.5">
              {TAG_COLORS.slice(0, 5).map((color) => (
                <button
                  key={color.value}
                  onClick={() => setNewTagColor(color.value)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    newTagColor === color.value && "ring-2 ring-offset-2 ring-primary"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          <Button 
            onClick={handleCreateTag}
            disabled={!newTagName.trim() || isCreatingTag}
          >
            {isCreatingTag ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Crear
              </>
            )}
          </Button>
        </div>

        {/* All colors picker for create */}
        <div className="flex flex-wrap gap-1.5 pb-4 border-b">
          {TAG_COLORS.slice(5).map((color) => (
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

        {/* Tags list */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Etiquetas existentes ({tags.length})
          </h3>
          
          {isLoadingTags ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay etiquetas creadas</p>
              <p className="text-sm">Crea tu primera etiqueta arriba</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  {editingTag?.id === tag.id ? (
                    // Edit mode
                    <div className="flex-1 flex items-center gap-3">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 flex-1"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => setEditColor(color.value)}
                            className={cn(
                              "w-5 h-5 rounded-full transition-all",
                              editColor === color.value && "ring-2 ring-offset-1 ring-primary"
                            )}
                            style={{ backgroundColor: color.value }}
                          />
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveEdit}
                        disabled={isUpdatingTag}
                      >
                        {isUpdatingTag ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="flex items-center gap-3">
                        <span 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="font-medium">{tag.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {tagCounts[tag.id] || 0} chats
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEdit(tag)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(tag)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar etiqueta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la etiqueta "{tagToDelete?.name}" y se quitará de todas las conversaciones donde esté asignada. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingTag ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
