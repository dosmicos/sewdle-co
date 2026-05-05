import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Trash2, TrendingUp, Building2 } from 'lucide-react';
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
import { useWorkshops } from '@/hooks/useWorkshops';

interface BulkActionsBarProps {
  selectedCount: number;
  selectedIds: string[];
  prospects: WorkshopProspect[];
  onUpdate: (id: string, updates: Partial<WorkshopProspect>) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  onClear: () => void;
}

export const BulkActionsBar = ({
  selectedCount,
  selectedIds,
  prospects,
  onUpdate,
  onDelete,
  onClear,
}: BulkActionsBarProps) => {
  const { createWorkshop } = useWorkshops();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);

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

  const handleConvertToWorkshops = async () => {
    setIsConverting(true);
    const toastId = toast.loading('Convirtiendo prospectos a talleres...');
    
    try {
      const selectedProspects = prospects.filter(p => selectedIds.includes(p.id));
      let successful = 0;
      let skipped = 0;
      let failed = 0;

      for (const prospect of selectedProspects) {
        // Validar que tenga nombre (campo obligatorio)
        if (!prospect.name || prospect.name.trim() === '') {
          skipped++;
          continue;
        }

        // Omitir si ya está convertido
        if (prospect.converted_workshop_id) {
          skipped++;
          continue;
        }

        try {
          // Crear el taller
          const { data: workshop, error } = await createWorkshop({
            name: prospect.name,
            contact_person: prospect.contact_person || '',
            phone: prospect.phone || '',
            email: prospect.email || '',
            address: prospect.address || '',
            city: prospect.city || '',
            specialties: prospect.specialties || [],
            notes: prospect.notes || '',
            status: 'active',
            payment_method: 'approved',
          });

          if (error || !workshop) {
            failed++;
            continue;
          }

          // Actualizar el prospecto con el ID del taller creado
          await onUpdate(prospect.id, {
            stage: 'approved_workshop',
            converted_workshop_id: workshop.id,
          });

          successful++;
        } catch (err) {
          console.error('Error converting prospect:', err);
          failed++;
        }
      }

      toast.dismiss(toastId);

      // Mostrar resumen
      if (successful > 0) {
        toast.success(`✅ ${successful} taller${successful > 1 ? 'es creados' : ' creado'} exitosamente`);
      }
      if (skipped > 0) {
        toast.warning(`⚠️ ${skipped} prospecto${skipped > 1 ? 's omitidos' : ' omitido'} (sin nombre o ya convertido)`);
      }
      if (failed > 0) {
        toast.error(`❌ ${failed} prospecto${failed > 1 ? 's fallaron' : ' falló'}`);
      }

      onClear();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('Error al convertir prospectos');
      console.error(err);
    } finally {
      setIsConverting(false);
      setShowConvertConfirm(false);
    }
  };

  const selectedProspects = prospects.filter(p => selectedIds.includes(p.id));
  const validProspectsCount = selectedProspects.filter(
    p => p.name && p.name.trim() !== '' && !p.converted_workshop_id
  ).length;

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

          {/* Convert to Workshops */}
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:bg-green-600 hover:text-white"
            onClick={() => setShowConvertConfirm(true)}
            disabled={isConverting || validProspectsCount === 0}
            title={validProspectsCount === 0 ? "No hay prospectos válidos para convertir" : "Convertir a Talleres"}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Crear como Talleres
          </Button>

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

      {/* Convert Confirmation Dialog */}
      <AlertDialog open={showConvertConfirm} onOpenChange={setShowConvertConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Crear {validProspectsCount} taller{validProspectsCount > 1 ? 'es' : ''}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Se crearán talleres activos con la información de los prospectos seleccionados y se marcarán como "Taller Aprobado".
              </p>
              {validProspectsCount < selectedCount && (
                <p className="text-amber-600">
                  ⚠️ {selectedCount - validProspectsCount} prospecto{selectedCount - validProspectsCount > 1 ? 's' : ''} será{selectedCount - validProspectsCount > 1 ? 'n' : ''} omitido{selectedCount - validProspectsCount > 1 ? 's' : ''} (sin nombre o ya convertido)
                </p>
              )}
              <div className="mt-3 max-h-32 overflow-y-auto text-sm">
                <p className="font-medium mb-1">Prospectos a convertir:</p>
                <ul className="list-disc list-inside space-y-1">
                  {selectedProspects
                    .filter(p => p.name && p.name.trim() !== '' && !p.converted_workshop_id)
                    .map(p => (
                      <li key={p.id}>{p.name}</li>
                    ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConvertToWorkshops}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Crear Talleres
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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