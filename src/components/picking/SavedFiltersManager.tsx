import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Bookmark, Trash2, Users, Package, Plus } from 'lucide-react';
import { useSavedFilters } from '@/hooks/useSavedFilters';
import { cn } from '@/lib/utils';

// Filtros predeterminados fijos (no se pueden eliminar)
const PRESET_FILTERS = [
  {
    id: 'para-empacar',
    name: 'Para Empacar',
    filters: {
      financial_status: ['paid', 'pending', 'partially_paid'],
      tags: ['confirmado'],
      exclude_tags: ['empacado'],
    }
  }
];

interface SavedFiltersManagerProps {
  currentFilters: Record<string, any>;
  onLoadFilter: (filters: Record<string, any>) => void;
  onAddFilter?: () => void;
}

export const SavedFiltersManager: React.FC<SavedFiltersManagerProps> = ({
  currentFilters,
  onLoadFilter,
  onAddFilter,
}) => {
  const { savedFilters, loading, saveFilter, deleteFilter } = useSavedFilters();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [hoveredFilterId, setHoveredFilterId] = useState<string | null>(null);

  const handleSaveFilter = async () => {
    if (!filterName.trim()) return;
    
    await saveFilter(filterName, currentFilters, isShared);
    setFilterName('');
    setIsShared(false);
    setSaveDialogOpen(false);
  };

  const hasActiveFilters = Object.values(currentFilters).some(value => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== '' && value !== null && value !== undefined;
  });

  return (
    <>
      <div className="space-y-2">
        {/* Botón para guardar nuevo filtro */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Filtros guardados
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
            disabled={!hasActiveFilters}
            className="gap-1.5 text-xs md:text-sm px-2 md:px-3 h-7 md:h-9"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Guardar filtro actual</span>
          </Button>
        </div>

        {/* Fila de botones de filtros */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {/* Filtros fijos (preset) - siempre visibles */}
            {PRESET_FILTERS.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                size="sm"
                onClick={() => onLoadFilter(preset.filters)}
                className="gap-1.5 text-xs md:text-sm px-2 md:px-3 h-7 md:h-9 bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-700 shrink-0"
              >
                <Package className="w-3 h-3" />
                <span>{preset.name}</span>
              </Button>
            ))}

            {/* Botón agregar filtro inline - visible en móvil */}
            {onAddFilter && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddFilter}
                className="gap-1 text-xs md:text-sm px-2 md:px-3 h-7 md:h-9 shrink-0 md:hidden"
              >
                <Plus className="w-3 h-3" />
              </Button>
            )}

            {/* Separador visual si hay filtros guardados */}
            {savedFilters.length > 0 && (
              <div className="w-px bg-border shrink-0" />
            )}

            {/* Filtros guardados por el usuario */}
            {loading ? (
              <div className="text-sm text-muted-foreground flex items-center">Cargando...</div>
            ) : (
              savedFilters.map((filter) => (
                <div
                  key={filter.id}
                  className="relative inline-block"
                  onMouseEnter={() => setHoveredFilterId(filter.id)}
                  onMouseLeave={() => setHoveredFilterId(null)}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onLoadFilter(filter.filters)}
                    className={cn(
                      "gap-2 pr-8 transition-all",
                      "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Bookmark className="w-3 h-3" />
                    <span>{filter.name}</span>
                    {filter.is_shared && (
                      <Users className="w-3 h-3 text-blue-500" />
                    )}
                  </Button>
                  
                  {/* Botón de eliminar (visible al hover) */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute right-0 top-0 h-full w-8 rounded-l-none",
                      "transition-opacity",
                      hoveredFilterId === filter.id ? "opacity-100" : "opacity-0"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFilter(filter.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Dialog para guardar filtro */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar filtro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filter-name">Nombre del filtro</Label>
              <Input
                id="filter-name"
                placeholder="Ej: Pedidos urgentes por procesar"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveFilter();
                  }
                }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-shared"
                checked={isShared}
                onCheckedChange={(checked) => setIsShared(checked as boolean)}
              />
              <Label htmlFor="is-shared" className="cursor-pointer">
                Compartir con todo el equipo
              </Label>
            </div>
            <div className="text-sm text-muted-foreground">
              Los filtros compartidos serán visibles para todos los usuarios de la organización.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveFilter} disabled={!filterName.trim()}>
              Guardar filtro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
