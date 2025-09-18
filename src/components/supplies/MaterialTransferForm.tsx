import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ArrowRight, Package } from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useMaterialInventory } from '@/hooks/useMaterialInventory';
import { useMaterialTransfers } from '@/hooks/useMaterialTransfers';

interface MaterialTransferFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const MaterialTransferForm: React.FC<MaterialTransferFormProps> = ({
  onSuccess,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    material_id: '',
    from_location_type: '' as 'warehouse' | 'workshop' | '',
    from_location_id: '',
    to_location_type: '' as 'warehouse' | 'workshop' | '',
    to_location_id: '',
    quantity: '',
    notes: ''
  });

  const { materials } = useMaterials();
  const { warehouses, centralWarehouse } = useWarehouses();
  const { workshops } = useWorkshops();
  const { getAvailableStock } = useMaterialInventory();
  const { createTransfer, loading } = useMaterialTransfers();

  const selectedMaterial = materials.find(m => m.id === formData.material_id);
  const availableStock = formData.from_location_id && formData.from_location_type 
    ? getAvailableStock(formData.material_id, formData.from_location_id, formData.from_location_type)
    : 0;

  const getLocationOptions = (type: 'warehouse' | 'workshop') => {
    if (type === 'warehouse') {
      return warehouses.map(w => ({ value: w.id, label: w.name }));
    } else {
      return workshops.map(w => ({ value: w.id, label: w.name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.material_id || !formData.from_location_type || !formData.from_location_id ||
        !formData.to_location_type || !formData.to_location_id || !formData.quantity) {
      return;
    }

    const quantity = parseFloat(formData.quantity);
    if (quantity <= 0 || quantity > availableStock) {
      return;
    }

    try {
      await createTransfer({
        material_id: formData.material_id,
        from_location_type: formData.from_location_type,
        from_location_id: formData.from_location_id,
        to_location_type: formData.to_location_type,
        to_location_id: formData.to_location_id,
        quantity,
        notes: formData.notes || undefined
      });

      // Reset form
      setFormData({
        material_id: '',
        from_location_type: '',
        from_location_id: '',
        to_location_type: '',
        to_location_id: '',
        quantity: '',
        notes: ''
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error creating transfer:', error);
    }
  };

  const isValidTransfer = () => {
    const quantity = parseFloat(formData.quantity);
    return formData.material_id && 
           formData.from_location_type && 
           formData.from_location_id &&
           formData.to_location_type && 
           formData.to_location_id &&
           formData.from_location_id !== formData.to_location_id &&
           quantity > 0 && 
           quantity <= availableStock;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Nueva Transferencia de Material
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Material Selection */}
          <div className="space-y-2">
            <Label htmlFor="material">Material *</Label>
            <Select 
              value={formData.material_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, material_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar material" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    <div className="flex items-center gap-2">
                      <span>{material.name}</span>
                      <Badge variant="outline">{material.sku}</Badge>
                      {material.color && (
                        <Badge variant="secondary">{material.color}</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Origen - Tipo *</Label>
              <Select 
                value={formData.from_location_type} 
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  from_location_type: value as 'warehouse' | 'workshop',
                  from_location_id: '' 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Bodega</SelectItem>
                  <SelectItem value="workshop">Taller</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Origen - Ubicación *</Label>
              <Select 
                value={formData.from_location_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, from_location_id: value }))}
                disabled={!formData.from_location_type}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar origen" />
                </SelectTrigger>
                <SelectContent>
                  {formData.from_location_type && getLocationOptions(formData.from_location_type).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Transfer Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>

          {/* To Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Destino - Tipo *</Label>
              <Select 
                value={formData.to_location_type} 
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  to_location_type: value as 'warehouse' | 'workshop',
                  to_location_id: '' 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de destino" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Bodega</SelectItem>
                  <SelectItem value="workshop">Taller</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Destino - Ubicación *</Label>
              <Select 
                value={formData.to_location_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, to_location_id: value }))}
                disabled={!formData.to_location_type}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar destino" />
                </SelectTrigger>
                <SelectContent>
                  {formData.to_location_type && getLocationOptions(formData.to_location_type).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad *</Label>
            <div className="flex gap-2">
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="0"
                min="0"
                step="0.01"
                className="flex-1"
              />
              {selectedMaterial && (
                <Badge variant="outline" className="px-3 py-2">
                  {selectedMaterial.unit}
                </Badge>
              )}
            </div>
            
            {formData.material_id && formData.from_location_id && formData.from_location_type && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>Stock disponible: {availableStock} {selectedMaterial?.unit}</span>
              </div>
            )}
          </div>

          {/* Stock validation alert */}
          {formData.quantity && availableStock > 0 && parseFloat(formData.quantity) > availableStock && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                La cantidad solicitada ({formData.quantity}) excede el stock disponible ({availableStock})
              </AlertDescription>
            </Alert>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Información adicional sobre la transferencia..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={!isValidTransfer() || loading}
            >
              {loading ? "Creando..." : "Crear Transferencia"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default MaterialTransferForm;