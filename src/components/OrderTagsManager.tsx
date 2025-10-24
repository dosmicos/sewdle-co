import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { X, Plus, Search, Loader2 } from 'lucide-react';
import { useShopifyTags } from '@/hooks/useShopifyTags';
import { cn } from '@/lib/utils';

interface OrderTagsManagerProps {
  orderId: string;
  shopifyOrderId: number;
  currentTags: string;
  onTagsUpdate: (newTags: string) => void;
}

export const OrderTagsManager: React.FC<OrderTagsManagerProps> = ({
  orderId,
  shopifyOrderId,
  currentTags,
  onTagsUpdate
}) => {
  const { availableTags, loading: tagsLoading, addTagToOrder, removeTagFromOrder } = useShopifyTags();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);

  // Parse current tags into array
  const currentTagsArray = useMemo(() => {
    if (!currentTags) return [];
    return currentTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }, [currentTags]);

  // Filter available tags that aren't already added
  const availableTagsToAdd = useMemo(() => {
    return availableTags.filter(tag => !currentTagsArray.includes(tag));
  }, [availableTags, currentTagsArray]);

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!searchValue) return availableTagsToAdd;
    return availableTagsToAdd.filter(tag => 
      tag.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [availableTagsToAdd, searchValue]);

  const handleAddTag = async (tag: string) => {
    const newTags = await addTagToOrder(orderId, shopifyOrderId, tag, currentTags);
    if (newTags !== null) {
      onTagsUpdate(newTags);
      setOpen(false);
      setSearchValue('');
    }
  };

  const handleRemoveTag = async (tag: string) => {
    const newTags = await removeTagFromOrder(orderId, shopifyOrderId, tag, currentTags);
    if (newTags !== null) {
      onTagsUpdate(newTags);
      setTagToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Tags */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Etiquetas Actuales</h4>
        {currentTagsArray.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {currentTagsArray.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="group px-3 py-1.5 cursor-pointer hover:bg-primary/10 transition-colors"
              >
                <span>{tag}</span>
                <button
                  onClick={() => setTagToDelete(tag)}
                  className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={tagsLoading}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Sin etiquetas</p>
        )}
      </div>

      {/* Add Tag Section */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Agregar Etiqueta</h4>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              disabled={tagsLoading}
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                {tagsLoading ? 'Cargando...' : 'Buscar etiqueta...'}
              </span>
              <Plus className="w-4 h-4 ml-2 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Buscar etiqueta existente..." 
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList>
                <CommandEmpty>
                  {searchValue ? (
                    <div className="p-4 text-sm text-center">
                      <p className="text-muted-foreground">No se encontró "{searchValue}"</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Solo puedes agregar etiquetas existentes en Shopify
                      </p>
                    </div>
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground text-center">
                      Escribe para buscar etiquetas
                    </p>
                  )}
                </CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {filteredTags?.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => handleAddTag(tag)}
                      className="cursor-pointer"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <p className="text-xs text-muted-foreground">
          Etiquetas disponibles: {availableTagsToAdd.length}
        </p>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar etiqueta?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar la etiqueta <strong>"{tagToDelete}"</strong> de esta orden?
              Esta acción se sincronizará con Shopify.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={tagsLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tagToDelete && handleRemoveTag(tagToDelete)}
              disabled={tagsLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tagsLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
