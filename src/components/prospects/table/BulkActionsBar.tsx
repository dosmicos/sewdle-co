import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Trash2, UserCog, TrendingUp } from 'lucide-react';
import { STAGE_LABELS, ProspectStage, WorkshopProspect } from '@/types/prospects';
import { toast } from 'sonner';
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

interface BulkActionsBarProps {
  selectedCount: number;
  selectedIds: string[];
  onUpdate: (id: string, updates: Partial<WorkshopProspect>) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  onClear: () => void;
}

export const BulkActionsBar = ({
  selectedCount,
  selectedIds,
  onUpdate,
  onDelete,
  onClear,
}: BulkActionsBarProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleBulkStageChange = async (newStage: ProspectStage) => {
    setIsUpdating(true);
    try {
      await Promise.all(
        selectedIds.map(id => onUpdate(id, { stage: newStage }))
      );
      toast.success(`${selectedCount} prospectos actualizados`);
      onClear();
    } catch (err) {
      toast.error('Error al actualizar prospectos');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      await Promise.all(selectedIds.map(id => onDelete(id)));
      toast.success(`${selectedCount} prospectos eliminados`);
      onClear();
    } catch (err) {
      toast.error('Error al eliminar prospectos');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">{selectedCount} seleccionados</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={onClear}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-primary-foreground/30" />

          {/* Bulk Stage Change */}
          <Select onValueChange={handleBulkStageChange} disabled={isUpdating}>
            <SelectTrigger className="w-[200px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <SelectValue placeholder="Cambiar etapa" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STAGE_LABELS).map(([stage, label]) => (
                <SelectItem key={stage} value={stage}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bulk Delete */}
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedCount} prospectos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los prospectos seleccionados serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
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