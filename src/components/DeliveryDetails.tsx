
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Calendar, User, Package, CheckCircle, XCircle, AlertTriangle, Camera, FileText, AlertCircle } from 'lucide-react';
import { useDeliveries } from '@/hooks/useDeliveries';

interface DeliveryDetailsProps {
  delivery: any;
  onBack: () => void;
}

// Mock user data for role checking
const currentUser = {
  role: 'qc_leader' // This would come from your auth context
};

const DeliveryDetails: React.FC<DeliveryDetailsProps> = ({ delivery, onBack }) => {
  const [deliveryData, setDeliveryData] = useState(null);
  const [qualityData, setQualityData] = useState({
    variants: {} as Record<string, { approved: number; defective: number; reason: string }>,
    evidenceFiles: null as FileList | null,
    generalNotes: ''
  });
  const { fetchDeliveryById, processQualityReview, loading } = useDeliveries();

  useEffect(() => {
    if (delivery?.id) {
      loadDeliveryDetails();
    }
  }, [delivery?.id]);

  const loadDeliveryDetails = async () => {
    const details = await fetchDeliveryById(delivery.id);
    setDeliveryData(details);
  };

  const handleQualityReview = async () => {
    console.log('Processing quality review:', delivery.id, qualityData);
    
    // Validate that quantities are entered
    const hasValidData = Object.values(qualityData.variants).some(variant => 
      variant.approved > 0 || variant.defective > 0
    );

    if (!hasValidData) {
      alert('Por favor, ingresa las cantidades aprobadas y/o defectuosas para al menos un item.');
      return;
    }

    const success = await processQualityReview(delivery.id, qualityData);
    if (success) {
      // Reload the delivery details to show updated status
      await loadDeliveryDetails();
      // Reset the form
      setQualityData({
        variants: {},
        evidenceFiles: null,
        generalNotes: ''
      });
    }
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
      case 'in_quality':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <AlertTriangle className="w-4 h-4 mr-1" />
            En Calidad
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1" />
            Devuelto
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            Aprobado
          </span>
        );
      case 'partial_approved':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <AlertCircle className="w-4 h-4 mr-1" />
            Parcialmente Aprobado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            <Package className="w-4 h-4 mr-1" />
            {status}
          </span>
        );
    }
  };

  const renderItemStatusBadge = (status: string, notes: string) => {
    switch (status) {
      case 'approved':
        return (
          <div>
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3 mr-1" />
              Aprobado
            </span>
            {notes && <p className="text-xs text-gray-600 mt-1">{notes}</p>}
          </div>
        );
      case 'rejected':
        return (
          <div>
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
              <XCircle className="w-3 h-3 mr-1" />
              Rechazado
            </span>
            {notes && <p className="text-xs text-gray-600 mt-1">{notes}</p>}
          </div>
        );
      case 'partial_approved':
        return (
          <div>
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
              <AlertCircle className="w-3 h-3 mr-1" />
              Parcial
            </span>
            {notes && <p className="text-xs text-gray-600 mt-1">{notes}</p>}
          </div>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Pendiente
          </span>
        );
    }
  };

  // Calculate summary statistics
  const calculateSummaryStats = () => {
    if (!deliveryData?.delivery_items) return { totalDelivered: 0, totalApproved: 0, totalDefective: 0 };
    
    let totalDelivered = 0;
    let totalApproved = 0;
    let totalDefective = 0;
    
    deliveryData.delivery_items.forEach(item => {
      totalDelivered += item.quantity_delivered;
      
      if (item.notes) {
        const approvedMatch = item.notes.match(/Aprobadas: (\d+)/);
        const defectiveMatch = item.notes.match(/Defectuosas: (\d+)/);
        
        if (approvedMatch) totalApproved += parseInt(approvedMatch[1]);
        if (defectiveMatch) totalDefective += parseInt(defectiveMatch[1]);
      }
    });
    
    return { totalDelivered, totalApproved, totalDefective };
  };

  if (loading || !deliveryData) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Cargando...</h1>
          </div>
        </div>
      </div>
    );
  }

  const isQCLeader = currentUser.role === 'qc_leader';
  const summaryStats = calculateSummaryStats();

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
            <h1 className="text-2xl font-bold">{deliveryData.tracking_number}</h1>
            <p className="text-gray-600">Orden: {deliveryData.orders?.order_number}</p>
          </div>
        </div>
        {renderStatusBadge(deliveryData.status)}
      </div>

      {/* Summary Stats */}
      {(deliveryData.status === 'approved' || deliveryData.status === 'partial_approved' || deliveryData.status === 'rejected') && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Resumen de Revisión</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{summaryStats.totalDelivered}</p>
              <p className="text-sm text-blue-700">Total Entregadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{summaryStats.totalApproved}</p>
              <p className="text-sm text-green-700">Aprobadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{summaryStats.totalDefective}</p>
              <p className="text-sm text-red-700">Defectuosas</p>
            </div>
          </div>
          {summaryStats.totalDelivered > 0 && (
            <div className="mt-3 text-center">
              <p className="text-sm text-gray-600">
                Tasa de Aprobación: {Math.round((summaryStats.totalApproved / summaryStats.totalDelivered) * 100)}%
              </p>
            </div>
          )}
        </Card>
      )}

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
            <div className={`w-3 h-3 rounded-full ${deliveryData.status !== 'pending' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className="text-sm">Revisión de Calidad</span>
          </div>
          <div className="flex-1 h-px bg-gray-300"></div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              deliveryData.status === 'approved' ? 'bg-green-500' : 
              deliveryData.status === 'partial_approved' ? 'bg-yellow-500' :
              deliveryData.status === 'rejected' ? 'bg-red-500' : 'bg-gray-300'
            }`}></div>
            <span className="text-sm">
              {deliveryData.status === 'approved' ? 'Aprobada' : 
               deliveryData.status === 'partial_approved' ? 'Parcialmente Aprobada' :
               deliveryData.status === 'rejected' ? 'Devuelta' : 'Pendiente'}
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
                <span className="ml-2">{deliveryData.orders?.order_number}</span>
              </div>
              <div className="flex items-center text-sm">
                <User className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium">Taller:</span>
                <span className="ml-2">{deliveryData.workshops?.name}</span>
              </div>
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium">Fecha:</span>
                <span className="ml-2">{new Date(deliveryData.delivery_date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="font-medium">Entrega #:</span>
                <span className="ml-2">{deliveryData.tracking_number}</span>
              </div>
              {deliveryData.recipient_name && (
                <div className="flex items-center text-sm">
                  <span className="font-medium">Receptor:</span>
                  <span className="ml-2">{deliveryData.recipient_name}</span>
                </div>
              )}
              {deliveryData.recipient_phone && (
                <div className="flex items-center text-sm">
                  <span className="font-medium">Teléfono:</span>
                  <span className="ml-2">{deliveryData.recipient_phone}</span>
                </div>
              )}
              {deliveryData.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 font-medium mb-1">Notas:</p>
                  <p className="text-sm text-gray-700">{deliveryData.notes}</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Items de la Entrega</h3>
            <div className="space-y-4">
              {deliveryData.delivery_items && deliveryData.delivery_items.length > 0 ? (
                <div className="space-y-3">
                  {deliveryData.delivery_items.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">
                            {item.order_items?.product_variants?.products?.name || 'Producto'}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Variante: {item.order_items?.product_variants?.size} - {item.order_items?.product_variants?.color}
                          </p>
                          <p className="text-sm text-gray-600">
                            SKU: {item.order_items?.product_variants?.sku_variant}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-lg text-blue-600">
                            {item.quantity_delivered} entregadas
                          </p>
                          <p className="text-sm text-gray-600">
                            de {item.order_items?.quantity} solicitadas
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        {renderItemStatusBadge(item.quality_status, item.notes)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No hay items registrados para esta entrega</p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Quality Control */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Control de Calidad</h3>
            
            {isQCLeader && deliveryData.status !== 'approved' && deliveryData.status !== 'rejected' ? (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Instrucciones:</strong> Especifica las cantidades aprobadas y defectuosas para cada variante. 
                    Las cantidades aprobadas se procesarán automáticamente y las defectuosas se devolverán al taller con el motivo especificado.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Resultado por Item</h4>
                  
                  {/* Quality Review Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Variante</TableHead>
                          <TableHead className="text-center">Entregadas</TableHead>
                          <TableHead className="text-center">Aprobadas</TableHead>
                          <TableHead className="text-center">Defectuosas</TableHead>
                          <TableHead>Motivo (si hay defectos)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveryData.delivery_items?.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.order_items?.product_variants?.products?.name}</p>
                                <p className="text-sm text-gray-600">
                                  {item.order_items?.product_variants?.size} - {item.order_items?.product_variants?.color}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-medium text-blue-600">{item.quantity_delivered}</span>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max={item.quantity_delivered}
                                value={qualityData.variants[`item-${index}`]?.approved || ''}
                                onChange={(e) => handleVariantQuality(`item-${index}`, 'approved', parseInt(e.target.value) || 0)}
                                className="w-20 text-center"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max={item.quantity_delivered}
                                value={qualityData.variants[`item-${index}`]?.defective || ''}
                                onChange={(e) => handleVariantQuality(`item-${index}`, 'defective', parseInt(e.target.value) || 0)}
                                className="w-20 text-center"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="Describir defectos..."
                                value={qualityData.variants[`item-${index}`]?.reason || ''}
                                onChange={(e) => handleVariantQuality(`item-${index}`, 'reason', e.target.value)}
                                className="min-w-[200px]"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
                    disabled={loading}
                    className="w-full bg-blue-500 hover:bg-blue-600"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {loading ? 'Procesando...' : 'Procesar Revisión de Calidad'}
                  </Button>
                </div>
              </div>
            ) : deliveryData.status === 'approved' || deliveryData.status === 'rejected' ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p className="text-gray-600">
                  Esta entrega ya ha sido {deliveryData.status === 'approved' ? 'aprobada' : 'devuelta'}
                </p>
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
            <h3 className="text-lg font-semibold mb-4">Historial de la Entrega</h3>
            <div className="space-y-3">
              <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Entrega Creada</span>
                  <span className="text-sm text-gray-600">{new Date(deliveryData.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-700 mt-1">Entrega registrada en el sistema</p>
              </div>
              
              {deliveryData.status !== 'pending' && (
                <div className="p-3 border-l-4 border-green-500 bg-green-50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Estado Actual</span>
                    <span className="text-sm text-gray-600">{new Date().toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">
                    {deliveryData.status === 'approved' ? 'Entrega aprobada' :
                     deliveryData.status === 'rejected' ? 'Entrega rechazada' :
                     deliveryData.status === 'in_quality' ? 'En proceso de revisión de calidad' :
                     'Estado actualizado'}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDetails;
