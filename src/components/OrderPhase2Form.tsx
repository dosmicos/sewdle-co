import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Scissors } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkshops } from '@/hooks/useWorkshops';

interface OrderPhase2FormProps {
  orderId: string;
  onPhaseComplete: (formData: Phase2FormData) => void;
}

// Phase 2 Form Data Structure
interface Phase2FormData {
  workshopId: string;
  workshopName: string;
}

const OrderPhase2Form: React.FC<OrderPhase2FormProps> = ({ 
  orderId,
  onPhaseComplete 
}) => {
  const { toast } = useToast();
  const { workshops, loading: workshopsLoading } = useWorkshops();
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<Phase2FormData>({
    workshopId: '',
    workshopName: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form field
  const updateField = <K extends keyof Phase2FormData>(
    field: K,
    value: Phase2FormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user updates field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleWorkshopChange = (workshopId: string) => {
    const selectedWorkshop = workshops.find(w => w.id === workshopId);
    if (selectedWorkshop) {
      setFormData({
        workshopId: selectedWorkshop.id,
        workshopName: selectedWorkshop.name,
      });
      // Clear error
      if (errors.workshopId) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.workshopId;
          return newErrors;
        });
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.workshopId) {
      newErrors.workshopId = 'Debe seleccionar un taller';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCompletePhase = async () => {
    if (!validateForm()) {
      toast({
        title: 'Error de validación',
        description: 'Por favor complete todos los campos requeridos',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      // Call parent handler with form data
      await onPhaseComplete(formData);
      
      toast({
        title: 'Fase 2 completada',
        description: 'El tiempo de corte y confección ha sido registrado correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo completar la Fase 2',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Scissors className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h4 className="font-semibold text-purple-900 dark:text-purple-100">
                ✂️ Fase 2: Corte y Confección (Taller Interno)
              </h4>
            </div>
            <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
              Esta fase comienza la manufactura física del producto. Aquí medimos el tiempo que toma procesar la orden dentro de nuestro taller de corte y costura.
            </p>
            <div className="space-y-2 text-sm text-purple-700 dark:text-purple-300">
              <p><strong>⏱️ Medición de Eficiencia:</strong> El tiempo transcurrido hasta completar esta fase será registrado como el <strong>Tiempo de Corte y Confección</strong>, un KPI vital para la evaluación de la eficiencia operativa interna.</p>
              <p><strong>📦 Siguiente Paso:</strong> Una vez que las piezas estén listas para ser bordadas externamente, complete esta fase para pasar al despacho (Fase 3).</p>
            </div>
          </div>

          {/* Workshop Assignment */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Asignación de Taller</h3>
            
            <div>
              <Label htmlFor="workshop">Taller de Corte/Confección Responsable *</Label>
              <Select
                value={formData.workshopId}
                onValueChange={handleWorkshopChange}
              >
                <SelectTrigger id="workshop" className={errors.workshopId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Seleccionar taller..." />
                </SelectTrigger>
                <SelectContent>
                  {workshopsLoading ? (
                    <SelectItem value="loading" disabled>Cargando talleres...</SelectItem>
                  ) : workshops.length === 0 ? (
                    <SelectItem value="empty" disabled>No hay talleres disponibles</SelectItem>
                  ) : (
                    workshops.map(workshop => (
                      <SelectItem key={workshop.id} value={workshop.id}>
                        {workshop.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.workshopId && (
                <p className="text-destructive text-xs mt-1">{errors.workshopId}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Seleccione el taller que será responsable del corte y confección de esta orden
              </p>
            </div>
          </div>

          {/* Complete Button */}
          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              onClick={handleCompletePhase}
              disabled={loading || !formData.workshopId}
              size="lg"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {loading ? 'Completando Fase 2...' : 'Completar Fase 2'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderPhase2Form;
