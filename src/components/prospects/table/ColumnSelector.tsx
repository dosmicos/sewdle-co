import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Settings2, GripVertical, Save, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  onToggle: (columnId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onSave: () => void;
  onLoad: () => void;
}

function SortableColumn({ 
  column, 
  onToggle 
}: { 
  column: ColumnConfig; 
  onToggle: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (column.id === 'select') return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted',
        !column.visible && 'opacity-50'
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <Checkbox
        checked={column.visible}
        onCheckedChange={() => onToggle(column.id)}
      />
      <span className="text-sm flex-1">{column.label}</span>
    </div>
  );
}

export const ColumnSelector = ({
  columns,
  onToggle,
  onReorder,
  onSave,
  onLoad,
}: ColumnSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  const visibleCount = columns.filter(c => c.visible && c.id !== 'select').length;
  const totalCount = columns.filter(c => c.id !== 'select').length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Columnas ({visibleCount}/{totalCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Configurar Columnas</h4>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onLoad();
                  setIsOpen(false);
                }}
                title="Cargar preferencias guardadas"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSave();
                  setIsOpen(false);
                }}
                title="Guardar preferencias"
              >
                <Save className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Arrastra para reordenar columnas
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {columns.map((column) => (
                  <SortableColumn
                    key={column.id}
                    column={column}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </PopoverContent>
    </Popover>
  );
};