import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, User, Package, CheckCircle, XCircle, AlertTriangle, Camera, FileText } from 'lucide-react';

interface DeliveryDetailsProps {
  delivery: any;
  onBack: () => void;
}

// Mock user data for role checking
const currentUser = {
  role: 'qc_leader' // This would come from your auth context
};

const DeliveryDetails: React.FC<DeliveryDetailsProps> = ({ delivery, onBack }) => {
  const [qualityData, setQualityData] = useState({
    variants: {} as Record<string, { approved: number; defective: number; reason: string }>,
    evidenceFiles: null as FileList | null,
    generalNotes: ''
  });

  const handleQualityReview = () => {
    console.log('Processing quality review:', delivery.id, qualityData);
    // Here you would normally send the data to your backend
    // The system will automatically:
    // - Approve the quantities marked as approved
    // - Return the quantities marked as defective with their reasons
  };

  const handleVariantQuality = (variant: string, field: string, value: string | number) => {
    setQualityData(prev => ({
      ...prev,
      variants: {
        ...prev.variants,
        [variant]: {
          ...prev.variants[variant],
          [field]: value
        }
      }
    }));
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'en-calidad':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <AlertTriangle className="w-4 h-4 mr-1" />
            En Calidad
          </span>
        );
      case 'devuelto':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1" />
            Devuelto
          </span>
        );
      case 'aprobado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            Aprobado
          </span>
        );
      default:
        return null;
    }
  };

  // Mock delivery details
  const mockVariants = [
    { name: 'S', delivered: 30, pending: 20 },
    { name: 'M', delivered: 60, pending: 40 },
    { name: 'L', delivered: 45, pending: 30 },
    { name: 'XL', delivered: 15, pending: 10 }
  ];

  const mockFiles = [
    { name: 'entrega_foto_1.jpg', type: 'image' },
    { name: 'entrega_foto_2.jpg', type: 'image' },
    { name: 'documento_entrega.pdf', type: 'document' }
  ];

  const isQCLeader = currentUser.role === 'qc_leader';
  const isWorkshop = currentUser.role === 'workshop';

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{delivery.id}</h1>
            <p className="text-gray-600">Orden: {delivery.orderId}</p>
          </div>
        </div>
        {renderStatusBadge(delivery.status)}
      </div>

      {/* Timeline */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Timeline del Proceso</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm">Entrega Creada</span>
          </div>
          <div className="flex-1 h-px bg-gray-300"></div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${delivery.status !== 'en-calidad' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className="text-sm">Revisión de Calidad</span>
          </div>
          <div className="flex-1 h-px bg-gray-300"></div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${delivery.status === 'aprobado' ? 'bg-green-500' : delivery.status === 'devuelto' ? 'bg-red-500' : 'bg-gray-300'}`}></div>
            <span className="text-sm">
              {delivery.status === 'aprobado' ? 'Aprobada' : delivery.status === 'devuelto' ? 'Devuelta' : 'Pendiente'}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Delivery Information */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Información de Entrega</h3>
            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <Package className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium">Orden:</span>
                <span className="ml-2">{delivery.orderId}</span>
              </div>
              <div className="flex items-center text-sm">
                <User className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium">Taller:</span>
                <span className="ml-2">{delivery.workshop}</span>
              </div>
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium">Fecha:</span>
                <span className="ml-2">{new Date(delivery.date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="font-medium">Entrega #:</span>
                <span className="ml-2">{delivery.deliveryNumber}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Detalle por Variante</h3>
            <div className="space-y-3">
              {mockVariants.map((variant) => (
                <div key={variant.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <span className="font-medium">{variant.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      <span className="font-medium">{variant.delivered}</span> entregadas
                    </div>
                    <div className="text-xs text-gray-500">
                      {variant.pending} pendientes
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Archivos Adjuntos</h3>
            <div className="space-y-2">
              {mockFiles.map((file, index) => (
                <div key={index} className="flex items-center p-2 border rounded-lg">
                  {file.type === 'image' ? (
                    <Camera className="w-4 h-4 mr-2 text-blue-500" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2 text-red-500" />
                  )}
                  <span className="text-sm">{file.name}</span>
                  <Button variant="ghost" size="sm" className="ml-auto">
                    Ver
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column - Quality Control */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Control de Calidad</h3>
            
            {isQCLeader ? (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Instrucciones:</strong> Especifica las cantidades aprobadas y defectuosas para cada variante. 
                    Las cantidades aprobadas se procesarán automáticamente y las defectuosas se devolverán al taller con el motivo especificado.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Resultado por Variante</h4>
                  {mockVariants.map((variant) => (
                    <div key={variant.name} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{variant.name}</span>
                        <span className="text-sm text-gray-600">{variant.delivered} entregadas</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`approved-${variant.name}`}>Aprobadas</Label>
                          <Input
                            id={`approved-${variant.name}`}
                            type="number"
                            min="0"
                            max={variant.delivered}
                            value={qualityData.variants[variant.name]?.approved || ''}
                            onChange={(e) => handleVariantQuality(variant.name, 'approved', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`defective-${variant.name}`}>Defectuosas</Label>
                          <Input
                            id={`defective-${variant.name}`}
                            type="number"
                            min="0"
                            max={variant.delivered}
                            value={qualityData.variants[variant.name]?.defective || ''}
                            onChange={(e) => handleVariantQuality(variant.name, 'defective', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor={`reason-${variant.name}`}>Motivo (si hay defectos)</Label>
                        <Input
                          id={`reason-${variant.name}`}
                          placeholder="Describir defectos encontrados..."
                          value={qualityData.variants[variant.name]?.reason || ''}
                          onChange={(e) => handleVariantQuality(variant.name, 'reason', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="evidence">Fotos de Evidencia</Label>
                  <input
                    type="file"
                    id="evidence"
                    multiple
                    accept="image/*"
                    onChange={(e) => setQualityData(prev => ({ ...prev, evidenceFiles: e.target.files }))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="notes">Notas Generales</Label>
                  <Textarea
                    id="notes"
                    placeholder="Observaciones generales sobre la calidad..."
                    value={qualityData.generalNotes}
                    onChange={(e) => setQualityData(prev => ({ ...prev, generalNotes: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleQualityReview}
                    className="w-full bg-blue-500 hover:bg-blue-600"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Procesar Revisión de Calidad
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
                <p>Solo el Líder de Calidad puede realizar inspecciones</p>
              </div>
            )}
          </Card>

          {/* History */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Historial de Correcciones</h3>
            <div className="space-y-3">
              <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Entrega 1</span>
                  <span className="text-sm text-gray-600">{new Date(delivery.date).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-700 mt-1">Entrega inicial registrada</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDetails;
