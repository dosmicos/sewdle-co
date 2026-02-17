import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Edit3, Trash2 } from 'lucide-react';

interface MaterialConsumptionEditFormProps {
  consumption: unknown;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MaterialConsumptionEditForm = ({ 
  consumption, 
  open, 
  onClose, 
  onSuccess 
}: MaterialConsumptionEditFormProps) => {
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (consumption) {
      setQuantity(consumption.quantity_consumed?.toString() || '');
      setNotes(consumption.notes || '');
    }
  }, [consumption]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumption) return;

    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast({
        title: "Error de validación",
        description: "La cantidad debe ser un número mayor a 0",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Actualizar el consumo de material
      const { error } = await supabase
        .from('material_deliveries')
        .update({
          quantity_consumed: quantityNum,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', consumption.id);

      if (error) throw error;

      toast({
        title: "Consumo actualizado",
        description: "El consumo de material se ha actualizado correctamente.",
      });

      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error('Error updating material consumption:', error);
      toast({
        title: "Error al actualizar",
        description: error.message || "No se pudo actualizar el consumo de material",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!consumption) return;

    setLoading(true);
    try {
      // Eliminar el consumo de material
      const { error } = await supabase
        .from('material_deliveries')
        .delete()
        .eq('id', consumption.id);

      if (error) throw error;

      toast({
        title: "Consumo eliminado",
        description: "El consumo de material se ha eliminado correctamente.",
      });

      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error('Error deleting material consumption:', error);
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar el consumo de material",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  if (!consumption) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5" />
            <span>Editar Consumo de Material</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Información del material */}
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="font-medium text-black">
              {consumption.materials?.name || 'Material'}
            </h4>
            <p className="text-sm text-gray-600">
              SKU: {consumption.materials?.sku} • Categoría: {consumption.materials?.category}
            </p>
            {consumption.materials?.color && (
              <p className="text-sm text-gray-600">
                Color: {consumption.materials.color}
              </p>
            )}
          </div>

          {/* Cantidad consumida */}
          <div>
            <Label htmlFor="quantity">
              Cantidad Consumida ({consumption.materials?.unit || 'unidad'})
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ingrese la cantidad"
              required
            />
          </div>

          {/* Notas */}
          <div>
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agregar notas sobre el consumo..."
              rows={3}
            />
          </div>

          {/* Botones */}
          <div className="flex justify-between pt-4">
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={loading}
                  className="flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar consumo de material?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará permanentemente el registro del consumo de este material.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={loading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Actualizar Consumo
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialConsumptionEditForm;