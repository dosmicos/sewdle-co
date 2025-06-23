import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Calendar, User, Package, CheckCircle, XCircle, AlertTriangle, Camera, FileText, AlertCircle } from 'lucide-react';
import { useDeliveries } from '@/hooks/useDeliveries';

interface DeliveryDetailsProps {
  delivery: any;
  onBack: (shouldRefresh?: boolean) => void;
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
    console.log('Loading delivery details for ID:', delivery.id);
    const details = await fetchDeliveryById(delivery.id);
    console.log('Loaded delivery details:', details);
    setDeliveryData(details);
  };

  // Helper function to get product info with fallbacks
  const getProductInfo = (item: any) => {
    console.log('Getting product info for item:', item);
    
    const product = item?.order_items?.product_variants?.products;
    const variant = item?.order_items?.product_variants;
    const orderItem = item?.order_items;
    
    // Datos del producto con fallbacks
    const productName = product?.name || 'Producto sin nombre';
    const variantSize = variant?.size || 'N/A';
    const variantColor = variant?.color || 'N/A';
    const skuVariant = variant?.sku_variant || `SKU-${item?.id || 'unknown'}`;
    
    console.log('Product info extracted:', {
      productName,
      variantSize,
      variantColor,
      skuVariant,
      hasProduct: !!product,
      hasVariant: !!variant,
      hasOrderItem: !!orderItem
    });
    
    return {
      productName,
      variantSize,
      variantColor,
      skuVariant,
      isDataComplete: !!(product && variant && orderItem)
    };
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <div className="w-2 h-2 rounded-full bg-gray-500 mr-1"></div>
            Pendiente
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
            En Tránsito
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>
            Entregado
          </span>
        );
      case 'in_quality':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>
            En Calidad
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
            Devuelto
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
            Aprobado
          </span>
        );
      case 'partial_approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
            Parcialmente Aprobado
          </span>
        );
      default:
        return null;
    }
  };

  const renderItemStatusBadge = (qualityStatus, notes) => {
    if (qualityStatus === 'approved') {
      return (
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aprobado
          </span>
          {notes && (
            <span className="text-xs text-gray-600">{notes}</span>
          )}
        </div>
      );
    } else if (qualityStatus === 'rejected') {
      return (
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rechazado
          </span>
          {notes && (
            <span className="text-xs text-red-600">{notes}</span>
          )}
        </div>
      );
    } else if (qualityStatus === 'partial_approved') {
      return (
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Parcialmente Aprobado
          </span>
          {notes && (
            <span className="text-xs text-yellow-600">{notes}</span>
          )}
        </div>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Pendiente de Revisión
        </span>
      );
    }
  };

  const handleQualityReview = async () => {
    console.log('Processing quality review with quality data:', qualityData);
    
    // Validar que hay datos de calidad
    const hasValidData = Object.values(qualityData.variants).some(variant => 
      variant.approved > 0 || variant.defective > 0
    );

    if (!hasValidData) {
      alert('Por favor, ingresa las cantidades aprobadas y/o defectuosas para al menos un item.');
      return;
    }

    console.log('Validation passed, processing quality review...');
    
    const success = await processQualityReview(delivery.id, qualityData);
    
    if (success) {
      console.log('Quality review processed successfully, reloading delivery details...');
      
      // Reset the form first
      setQualityData({
        variants: {},
        evidenceFiles: null,
        generalNotes: ''
      });
      
      // Reload the delivery details
      await loadDeliveryDetails();
      
      // Notify parent to refresh data and return to list
      console.log('Calling onBack with refresh flag...');
      onBack(true);
    } else {
      console.log('Quality review failed');
    }
  };

  const handleVariantQuality = (deliveryItemId: string, field: string, value: string | number) => {
    console.log('Updating variant quality for delivery_item_id:', deliveryItemId, field, value);
    
    setQualityData(prev => ({
      ...prev,
      variants: {
        ...prev.variants,
        [deliveryItemId]: {
          ...prev.variants[deliveryItemId],
          [field]: value
        }
      }
    }));
  };

  // Calculate quality review totals
  const calculateQualityTotals = () => {
    let totalApproved = 0;
    let totalDefective = 0;
    
    Object.values(qualityData.variants).forEach(variant => {
      totalApproved += variant.approved || 0;
      totalDefective += variant.defective || 0;
    });
    
    return { totalApproved, totalDefective };
  };

  // Calculate total delivered quantity
  const calculateTotalDelivered = () => {
    if (!deliveryData?.delivery_items) return 0;
    
    return deliveryData.delivery_items.reduce((total, item) => {
      return total + (item.quantity_delivered || 0);
    }, 0);
  };

  // Get quantity mismatches for validation - actualizado para usar IDs reales
  const getQuantityMismatches = () => {
    const mismatches = [];
    
    if (!deliveryData?.delivery_items) return mismatches;
    
    deliveryData.delivery_items.forEach((item) => {
      const deliveryItemId = item.id; // Usar el ID real del delivery_item
      const variantData = qualityData.variants[deliveryItemId];
      
      if (variantData) {
        const approved = variantData.approved || 0;
        const defective = variantData.defective || 0;
        const reviewed = approved + defective;
        const delivered = item.quantity_delivered;
        
        if (reviewed > 0 && reviewed !== delivered) {
          const productInfo = getProductInfo(item);
          mismatches.push({
            id: deliveryItemId,
            productName: `${productInfo.productName} (${productInfo.variantSize} - ${productInfo.variantColor})`,
            reviewed,
            delivered,
            difference: delivered - reviewed
          });
        }
      }
    });
    
    return mismatches;
  };

  // Calculate summary statistics using real data from delivery_items
  const calculateSummaryStats = () => {
    if (!deliveryData?.delivery_items) return { totalDelivered: 0, totalApproved: 0, totalDefective: 0 };
    
    let totalDelivered = 0;
    let totalApproved = 0;
    let totalDefective = 0;
    
    deliveryData.delivery_items.forEach(item => {
      totalDelivered += item.quantity_delivered || 0;
      totalApproved += item.quantity_approved || 0;
      totalDefective += item.quantity_defective || 0;
    });
    
    return { totalDelivered, totalApproved, totalDefective };
  };

  if (loading || !deliveryData) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => onBack()}>
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
  const qualityTotals = calculateQualityTotals();
  const quantityMismatches = getQuantityMismatches();
  const totalDelivered = calculateTotalDelivered();

  // Check if the delivery has been processed (not pending or in_quality)
  const isDeliveryProcessed = deliveryData.status === 'approved' || 
                             deliveryData.status === 'rejected' || 
                             deliveryData.status === 'partial_approved';

  console.log('Delivery status:', deliveryData.status, 'Is processed:', isDeliveryProcessed);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => onBack()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{deliveryData.tracking_number}</h1>
            <p className="text-gray-600">Orden: {deliveryData.orders?.order_number}</p>
            <p className="text-sm text-blue-600 font-medium">Total Entregado: {totalDelivered} unidades</p>
          </div>
        </div>
        {renderStatusBadge(deliveryData.status)}
      </div>

      {/* Summary Stats */}
      {isDeliveryProcessed && (
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
            <div className={`w-3 h-3 rounded-full ${isDeliveryProcessed ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Delivery Information */}
        <div className="lg:col-span-1 space-y-6">
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
              <div className="flex items-center text-sm">
                <span className="font-medium">Total Entregado:</span>
                <span className="ml-2 font-bold text-blue-600">{totalDelivered} unidades</span>
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

          {/* Items Table */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Items de la Entrega</h3>
            {deliveryData.delivery_items && deliveryData.delivery_items.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Producto</TableHead>
                      <TableHead className="text-xs text-center">Cantidad Total</TableHead>
                      <TableHead className="text-xs text-center">Aprobadas</TableHead>
                      <TableHead className="text-xs text-center">Defectuosas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryData.delivery_items.map((item, index) => {
                      const productInfo = getProductInfo(item);
                      
                      return (
                        <TableRow key={index}>
                          <TableCell className="py-2">
                            <div>
                              <p className="font-medium text-xs text-black">
                                {productInfo.productName}
                              </p>
                              <p className="text-xs text-gray-600">
                                {productInfo.variantSize} - {productInfo.variantColor}
                              </p>
                              <p className="text-xs text-gray-500">
                                {productInfo.skuVariant}
                              </p>
                              {!productInfo.isDataComplete && (
                                <p className="text-xs text-amber-600 font-medium">
                                  ⚠️ Datos incompletos
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <span className="font-medium text-blue-600">{item.quantity_delivered || 0}</span>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <span className="font-medium text-green-600">{item.quantity_approved || 0}</span>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <span className="font-medium text-red-600">{item.quantity_defective || 0}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No hay items registrados para esta entrega</p>
            )}
          </Card>
        </div>

        {/* Right Column - Quality Control (Expanded width) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Control de Calidad</h3>
            
            {isQCLeader && !isDeliveryProcessed ? (
              <div className="space-y-4">
                {/* Mostrar advertencia si ya está sincronizada */}
                {deliveryData.synced_to_shopify && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>⚠️ Nota:</strong> Esta entrega ya fue sincronizada con Shopify. 
                      Los cambios de calidad no afectarán el inventario de Shopify.
                    </p>
                  </div>
                )}

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
                        {deliveryData.delivery_items?.map((item) => {
                          const productInfo = getProductInfo(item);
                          const deliveryItemId = item.id; // Usar el ID real del delivery_item
                          const variantData = qualityData.variants[deliveryItemId];
                          const approved = variantData?.approved || 0;
                          const defective = variantData?.defective || 0;
                          const reviewed = approved + defective;
                          const delivered = item.quantity_delivered;
                          
                          console.log('Rendering quality row for delivery_item:', deliveryItemId, {
                            productInfo,
                            variantData,
                            approved,
                            defective,
                            delivered
                          });
                          
                          return (
                            <TableRow key={deliveryItemId}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{productInfo.productName}</p>
                                  <p className="text-sm text-gray-600">
                                    {productInfo.variantSize} - {productInfo.variantColor}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {productInfo.skuVariant}
                                  </p>
                                  <p className="text-xs text-blue-500">
                                    ID: {deliveryItemId}
                                  </p>
                                  {!productInfo.isDataComplete && (
                                    <p className="text-xs text-amber-600 font-medium">
                                      ⚠️ Verificar datos
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-medium text-blue-600">{delivered}</span>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max={delivered}
                                  value={approved || ''}
                                  onChange={(e) => handleVariantQuality(deliveryItemId, 'approved', parseInt(e.target.value) || 0)}
                                  className="w-20 text-center"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max={delivered}
                                  value={defective || ''}
                                  onChange={(e) => handleVariantQuality(deliveryItemId, 'defective', parseInt(e.target.value) || 0)}
                                  className="w-20 text-center"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  placeholder="Describir defectos..."
                                  value={variantData?.reason || ''}
                                  onChange={(e) => handleVariantQuality(deliveryItemId, 'reason', e.target.value)}
                                  className="min-w-[200px]"
                                />
                                {reviewed > 0 && reviewed !== delivered && (
                                  <p className="text-xs text-amber-600 mt-1">
                                    Total revisadas: {reviewed} (entregadas: {delivered})
                                  </p>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Quality Review Summary */}
                <Card className="p-4 bg-gray-50 border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3">Resumen de Revisión</h4>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-xl font-bold text-green-600">{qualityTotals.totalApproved}</p>
                      <p className="text-sm text-green-700">Total Aprobadas</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-red-600">{qualityTotals.totalDefective}</p>
                      <p className="text-sm text-red-700">Total Defectuosas</p>
                    </div>
                  </div>
                  {(qualityTotals.totalApproved + qualityTotals.totalDefective) > 0 && (
                    <div className="mt-3 text-center">
                      <p className="text-sm text-gray-600">
                        Total Revisadas: {qualityTotals.totalApproved + qualityTotals.totalDefective}
                      </p>
                    </div>
                  )}
                </Card>

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

                {/* Quantity Mismatch Warning Alert */}
                {quantityMismatches.length > 0 && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>Discrepancia detectada:</strong> Las cantidades reportadas no coinciden con las entregadas:
                      <ul className="mt-2 ml-4 list-disc">
                        {quantityMismatches.map((item, index) => (
                          <li key={index} className="text-sm">
                            <strong>{item.productName}:</strong> {item.reviewed} revisadas de {item.delivered} entregadas 
                            ({item.difference > 0 ? `faltan ${item.difference}` : `sobran ${Math.abs(item.difference)}`})
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm mt-2">
                        Esta discrepancia será registrada en el sistema para seguimiento.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

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
            ) : isDeliveryProcessed ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p className="text-gray-600">
                  Esta entrega ya ha sido {
                    deliveryData.status === 'approved' ? 'aprobada completamente' : 
                    deliveryData.status === 'partial_approved' ? 'parcialmente aprobada' :
                    'devuelta'
                  }
                </p>
                {deliveryData.synced_to_shopify && (
                  <p className="text-sm text-green-600 mt-2">
                    ✅ Sincronizada con Shopify
                  </p>
                )}
                {deliveryData.notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left">
                    <p className="text-sm text-gray-600 font-medium mb-1">Resumen:</p>
                    <p className="text-sm text-gray-700">{deliveryData.notes}</p>
                  </div>
                )}
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
              
              {isDeliveryProcessed && (
                <div className="p-3 border-l-4 border-green-500 bg-green-50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Estado Actual</span>
                    <span className="text-sm text-gray-600">{new Date().toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">
                    {deliveryData.status === 'approved' ? 'Entrega aprobada completamente' :
                     deliveryData.status === 'rejected' ? 'Entrega rechazada' :
                     deliveryData.status === 'partial_approved' ? 'Entrega parcialmente aprobada' :
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
