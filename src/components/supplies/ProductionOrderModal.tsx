import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useProductionOrders } from '@/hooks/useProductionOrders';
import { ReplenishmentSuggestion } from '@/hooks/useReplenishment';
import { CalendarDays, Factory, Package, ShoppingCart } from 'lucide-react';

interface ProductionOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSuggestions: ReplenishmentSuggestion[];
  onSuccess: () => void;
}

export const ProductionOrderModal: React.FC<ProductionOrderModalProps> = ({
  isOpen,
  onClose,
  selectedSuggestions,
  onSuccess
}) => {
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const { workshops } = useWorkshops();
  const { creating, createProductionOrder } = useProductionOrders();

  const activeWorkshops = workshops.filter(w => w.status === 'active');

  const totalQuantity = selectedSuggestions.reduce((sum, s) => sum + s.suggested_quantity, 0);
  const totalProducts = selectedSuggestions.length;

  const handleSubmit = async () => {
    if (!selectedWorkshop || !expectedDeliveryDate) {
      return;
    }

    const result = await createProductionOrder({
      workshopId: selectedWorkshop,
      expectedDeliveryDate,
      notes,
      suggestions: selectedSuggestions
    });

    if (result.success) {
      onSuccess();
      onClose();
      // Reset form
      setSelectedWorkshop('');
      setExpectedDeliveryDate('');
      setNotes('');
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedWorkshop('');
    setExpectedDeliveryDate('');
    setNotes('');
  };

  // Generate default delivery date (30 days from now)
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 30);
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-primary" />
            Crear Orden de Producción
          </DialogTitle>
          <DialogDescription>
            Asigna las sugerencias seleccionadas a un taller para crear una orden de producción
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Productos</p>
                    <p className="font-semibold">{totalProducts}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cantidad Total</p>
                    <p className="font-semibold">{totalQuantity} unidades</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Products */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Productos Seleccionados</Label>
            <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-3">
              {selectedSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{suggestion.product_name}</p>
                    {(suggestion.variant_size || suggestion.variant_color) && (
                      <p className="text-xs text-muted-foreground">
                        {[suggestion.variant_size, suggestion.variant_color].filter(Boolean).join(' - ')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono">
                      SKU: {suggestion.sku_variant}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="font-medium">
                      {suggestion.suggested_quantity} unidades
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestion.urgency_level === 'critical' ? '🔴 CRÍTICA' :
                       suggestion.urgency_level === 'high' ? '🟠 ALTA' : '🟢 NORMAL'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Workshop Selection */}
          <div className="space-y-2">
            <Label htmlFor="workshop">Taller Asignado *</Label>
            <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar taller..." />
              </SelectTrigger>
              <SelectContent>
                {activeWorkshops.map((workshop) => (
                  <SelectItem key={workshop.id} value={workshop.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{workshop.name}</span>
                      <Badge variant="outline" className="ml-2">
                        {workshop.paymentMethod === 'approved' ? 'Por aprobadas' : 'Por entregadas'}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeWorkshops.length === 0 && (
              <p className="text-sm text-red-600">No hay talleres activos disponibles</p>
            )}
          </div>

          {/* Expected Delivery Date */}
          <div className="space-y-2">
            <Label htmlFor="deliveryDate" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Fecha de Entrega Esperada *
            </Label>
            <Input
              id="deliveryDate"
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              min={minDate.toISOString().split('T')[0]}
              placeholder={defaultDate.toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              Recomendado: Mínimo 30 días para producción normal
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones especiales, observaciones..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={creating}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={creating || !selectedWorkshop || !expectedDeliveryDate || activeWorkshops.length === 0}
            className="flex items-center gap-2"
          >
            {creating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Creando...
              </>
            ) : (
              <>
                <Factory className="h-4 w-4" />
                Crear Orden de Producción
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};