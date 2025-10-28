import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Package, 
  Truck, 
  Send, 
  ArrowLeft,
  CheckCheck,
  Scissors
} from 'lucide-react';
import { useOrderTimeline, PhaseType } from '@/hooks/useOrderTimeline';
import { formatDateSafe } from '@/lib/dateUtils';
import { usePermissions } from '@/hooks/usePermissions';
import OrderPhase1Form from '@/components/OrderPhase1Form';
import OrderPhase2Form from '@/components/OrderPhase2Form';

interface OrderTimelineProps {
  orderId: string;
  workshopId?: string;
}

const phaseConfig = [
  {
    type: 'order_received' as PhaseType,
    label: 'Fase 1: Recepción de OP, Optimización y Registro de Insumos',
    icon: Package,
    description: 'Especificación del producto y registro de cantidades de insumos despachados al taller de Corte y Confección',
  },
  {
    type: 'cutting_sewing' as PhaseType,
    label: 'Fase 2: Corte y Confección (Taller Interno)',
    icon: Scissors,
    description: 'Manufactura física del producto en taller de corte y costura',
  },
  {
    type: 'supplies_packed' as PhaseType,
    label: 'Embalaje de Insumos a Talleres',
    icon: Truck,
    description: 'Insumos empacados y listos para envío',
  },
  {
    type: 'caps_sent_embroidery' as PhaseType,
    label: 'Despacho de Capotas para Bordados',
    icon: Send,
    description: 'Capotas enviadas para proceso de bordado',
  },
  {
    type: 'embroidered_caps_received' as PhaseType,
    label: 'Entrega Capota Bordados',
    icon: ArrowLeft,
    description: 'Capotas bordadas recibidas de vuelta',
  },
  {
    type: 'final_production_delivered' as PhaseType,
    label: 'Entrega Producción Final',
    icon: CheckCheck,
    description: 'Producción final completada y entregada',
  },
];

const OrderTimeline: React.FC<OrderTimelineProps> = ({ orderId, workshopId }) => {
  const { phases, loading, updatePhase, refetch } = useOrderTimeline(orderId);
  const { hasPermission } = usePermissions();
  const [editingPhase, setEditingPhase] = useState<PhaseType | null>(null);
  const [notes, setNotes] = useState('');
  const [showPhase1Form, setShowPhase1Form] = useState(false);
  const [showPhase2Form, setShowPhase2Form] = useState(false);

  const canEdit = hasPermission('orders', 'edit');

  const getPhaseData = (phaseType: PhaseType) => {
    return phases.find((p) => p.phase_type === phaseType);
  };

  const handleTogglePhase = async (phaseType: PhaseType) => {
    const phaseData = getPhaseData(phaseType);
    const isCompleted = !!phaseData?.completed_at;
    
    // Para la fase 1, mostrar el formulario en lugar de toggle directo
    if (phaseType === 'order_received' && !isCompleted) {
      setShowPhase1Form(!showPhase1Form);
      return;
    }
    
    // Para la fase 2, mostrar el formulario en lugar de toggle directo
    if (phaseType === 'cutting_sewing' && !isCompleted) {
      setShowPhase2Form(!showPhase2Form);
      return;
    }
    
    if (editingPhase === phaseType) {
      // Save with notes
      await updatePhase(phaseType, !isCompleted, notes);
      setEditingPhase(null);
      setNotes('');
    } else {
      // Quick toggle without notes
      await updatePhase(phaseType, !isCompleted);
    }
  };

  const handlePhase1Complete = async (formData: any) => {
    await updatePhase('order_received', true, undefined, formData);
    setShowPhase1Form(false);
    refetch();
  };

  const handlePhase2Complete = async (formData: any) => {
    await updatePhase('cutting_sewing', true, undefined, formData);
    setShowPhase2Form(false);
    refetch();
  };

  const calculateDuration = (index: number): string | null => {
    if (index === 0) return null;

    const currentPhase = getPhaseData(phaseConfig[index].type);
    const previousPhase = getPhaseData(phaseConfig[index - 1].type);

    if (!currentPhase?.completed_at || !previousPhase?.completed_at) {
      return null;
    }

    const start = new Date(previousPhase.completed_at);
    const end = new Date(currentPhase.completed_at);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    }
    return `${diffHours}h`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Historial de Producción</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {phaseConfig.map((phase, index) => {
              const phaseData = getPhaseData(phase.type);
              const isCompleted = !!phaseData?.completed_at;
              const duration = calculateDuration(index);
              const Icon = phase.icon;

              return (
                <div key={phase.type} className="relative">
                  {index < phaseConfig.length - 1 && (
                    <div
                      className={`absolute left-6 top-12 bottom-0 w-0.5 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      style={{ height: 'calc(100% + 1.5rem)' }}
                    />
                  )}

                  <div className="flex items-start space-x-4">
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <Circle className="w-6 h-6" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Icon className="w-5 h-5 text-muted-foreground" />
                          <h3 className="font-semibold text-foreground">
                            {phase.label}
                          </h3>
                        </div>
                        {duration && (
                          <Badge variant="outline" className="ml-2">
                            <Clock className="w-3 h-3 mr-1" />
                            {duration}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        {phase.description}
                      </p>

                      {isCompleted && phaseData.completed_at && (
                        <div className="text-sm text-muted-foreground">
                          Completado: {formatDateSafe(phaseData.completed_at.split('T')[0])} 
                          {' '}a las {new Date(phaseData.completed_at).toLocaleTimeString('es-ES', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}

                      {phaseData?.notes && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <strong>Notas:</strong> {phaseData.notes}
                        </div>
                      )}

                      {canEdit && editingPhase === phase.type && (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            placeholder="Agregar notas (opcional)"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                          />
                        </div>
                      )}

                      {canEdit && (
                        <div className="mt-3 flex space-x-2">
                          <Button
                            size="sm"
                            variant={isCompleted ? 'outline' : 'default'}
                            onClick={() => handleTogglePhase(phase.type)}
                          >
                            {(phase.type === 'order_received' || phase.type === 'cutting_sewing') && !isCompleted 
                              ? ((phase.type === 'order_received' && showPhase1Form) || (phase.type === 'cutting_sewing' && showPhase2Form) 
                                  ? 'Ocultar Formulario' 
                                  : `Iniciar ${phase.type === 'order_received' ? 'Fase 1' : 'Fase 2'}`)
                              : (isCompleted ? 'Marcar Incompleta' : 'Marcar Completa')
                            }
                          </Button>
                          {!isCompleted && phase.type !== 'order_received' && phase.type !== 'cutting_sewing' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (editingPhase === phase.type) {
                                  setEditingPhase(null);
                                  setNotes('');
                                } else {
                                  setEditingPhase(phase.type);
                                  setNotes(phaseData?.notes || '');
                                }
                              }}
                            >
                              {editingPhase === phase.type ? 'Cancelar' : 'Agregar Notas'}
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Formulario expandido para Fase 1 */}
                      {phase.type === 'order_received' && showPhase1Form && !isCompleted && (
                        <OrderPhase1Form
                          orderId={orderId}
                          workshopId={workshopId}
                          onPhaseComplete={handlePhase1Complete}
                        />
                      )}

                      {/* Formulario expandido para Fase 2 */}
                      {phase.type === 'cutting_sewing' && showPhase2Form && !isCompleted && (
                        <OrderPhase2Form
                          orderId={orderId}
                          onPhaseComplete={handlePhase2Complete}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderTimeline;