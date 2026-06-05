import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronUp, ChevronDown, Trash2, Plus, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useMarketingEventCategories,
  type MarketingEventCategory,
} from '@/hooks/useMarketingEventCategories';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NEW_TYPE_DEFAULT_COLOR = '#64748b';

const EventCategoryManager: React.FC<Props> = ({ open, onOpenChange }) => {
  const {
    categories,
    addCategory,
    updateCategory,
    removeCategory,
    reorderCategory,
    isMutating,
  } = useMarketingEventCategories();

  const ordered = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  const commitLabel = (cat: MarketingEventCategory, value: string) => {
    const next = value.trim();
    if (next && next !== cat.label) {
      updateCategory({ id: cat.id, patch: { label: next } });
    }
  };

  const commitColor = (cat: MarketingEventCategory, value: string) => {
    if (value && value !== cat.color) {
      updateCategory({ id: cat.id, patch: { color: value } });
    }
  };

  const handleDelete = async (cat: MarketingEventCategory) => {
    if (cat.is_builtin) return;
    const ok = window.confirm(
      `¿Eliminar el tipo "${cat.label}"? Las actividades que lo usen pasarán a "Otro".`
    );
    if (ok) await removeCategory(cat);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] max-h-[90vh] overflow-hidden p-0 gap-0">
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-tight text-slate-900">
              Tipos de actividad
            </DialogTitle>
            <p className="text-xs text-slate-400 mt-0.5">
              Personaliza el color y la etiqueta de cada tipo. El color es el que aparece en el calendario.
            </p>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-4 space-y-2">
            {ordered.map((cat, idx) => (
              <div
                key={cat.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 transition-opacity',
                  !cat.is_active && 'opacity-50'
                )}
              >
                {/* Reorder */}
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={idx === 0 || isMutating}
                    onClick={() => reorderCategory({ id: cat.id, direction: 'up' })}
                    className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
                    aria-label="Subir"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === ordered.length - 1 || isMutating}
                    onClick={() => reorderCategory({ id: cat.id, direction: 'down' })}
                    className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
                    aria-label="Bajar"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Color swatch (native picker = free color) */}
                <label
                  className="relative h-7 w-7 shrink-0 rounded-full border border-black/10 cursor-pointer overflow-hidden"
                  style={{ backgroundColor: cat.color }}
                  title="Cambiar color"
                >
                  <input
                    type="color"
                    defaultValue={cat.color}
                    onBlur={(e) => commitColor(cat, e.target.value)}
                    onChange={(e) => commitColor(cat, e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>

                {/* Label */}
                <Input
                  defaultValue={cat.label}
                  onBlur={(e) => commitLabel(cat, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="h-8 text-sm flex-1 border-slate-200"
                />

                {/* Active toggle */}
                <div className="flex items-center gap-1.5 shrink-0" title={cat.is_active ? 'Visible' : 'Oculto'}>
                  <Switch
                    checked={cat.is_active}
                    onCheckedChange={(checked) =>
                      updateCategory({ id: cat.id, patch: { is_active: checked } })
                    }
                  />
                </div>

                {/* Delete (custom only) */}
                {cat.is_builtin ? (
                  <span className="w-7 flex justify-center text-slate-300" title="Tipo predeterminado — se puede ocultar pero no eliminar">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => handleDelete(cat)}
                    className="w-7 flex justify-center text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t px-6 py-3 flex items-center justify-between bg-slate-50/50">
          <p className="text-[11px] text-slate-400">
            Los tipos predeterminados se pueden ocultar, no eliminar.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isMutating}
            onClick={() => addCategory({ label: 'Nuevo tipo', color: NEW_TYPE_DEFAULT_COLOR })}
            className="h-8 gap-1.5 border-slate-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar tipo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventCategoryManager;
