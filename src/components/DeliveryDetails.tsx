import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Edit2, Package, Upload, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useUserContext } from '@/hooks/useUserContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import DeliveryEvidenceGallery from './DeliveryEvidenceGallery';
import DeliveryReviewSummary from './DeliveryReviewSummary';

interface DeliveryDetailsProps {
  delivery: any;
  onBack: (shouldRefresh?: boolean) => void;
}

const DeliveryDetails = ({ delivery: initialDelivery, onBack }: DeliveryDetailsProps) => {
  const [delivery, setDelivery] = useState(initialDelivery);
  const [isEditing, setIsEditing] = useState(false);
  const [quantityData, setQuantityData] = useState<any>({});
  const [qualityData, setQualityData] = useState<any>({ variants: {} });
  const [generalNotes, setGeneralNotes] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { fetchDeliveryById, updateDeliveryQuantities, processQualityReview, loading } = useDeliveries();
  const { canEditDeliveries } = useUserContext();

  useEffect(() => {
    loadDelivery();
  }, [initialDelivery.id]);

  const loadDelivery = async () => {
    const refreshedDelivery = await fetchDeliveryById(initialDelivery.id);
    if (refreshedDelivery) {
      setDelivery(refreshedDelivery);
      
      // Initialize quantity data
      const initialQuantityData: any = {};
      refreshedDelivery.delivery_items?.forEach((item: any) => {
        initialQuantityData[item.id] = item.quantity_delivered || 0;
      });
      setQuantityData(initialQuantityData);
      
      // Initialize quality data
      const initialQualityData: any = { variants: {} };
      refreshedDelivery.delivery_items?.forEach((item: any) => {
        initialQualityData.variants[item.id] = {
          approved: item.quantity_approved || 0,
          defective: item.quantity_defective || 0,
          reason: item.quality_notes || ''
        };
      });
      setQualityData(initialQualityData);
    }
  };

  const handleQuantityChange = (itemId: string, value: number) => {
    setQuantityData(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handleSaveQuantities = async () => {
    const updates = Object.entries(quantityData).map(([id, quantity]) => ({
      id,
      quantity: Number(quantity)
    }));
    
    const success = await updateDeliveryQuantities(delivery.id, updates);
    if (success) {
      setIsEditing(false);
      loadDelivery();
    }
  };

  const handleQualityChange = (itemId: string, field: string, value: any) => {
    setQualityData(prev => ({
      ...prev,
      variants: {
        ...prev.variants,
        [itemId]: {
          ...prev.variants[itemId],
          [field]: value
        }
      }
    }));
  };

  const handleEvidenceFilesSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file types (only images)
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      alert('Solo se permiten archivos de imagen (JPG, PNG, WEBP, GIF)');
      return;
    }

    // Validate file sizes (max 5MB each)
    const oversizedFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert('Cada archivo debe ser menor a 5MB');
      return;
    }

    // Validate total files (max 10)
    if (evidenceFiles.length + files.length > 10) {
      alert('Máximo 10 archivos de evidencia por entrega');
      return;
    }

    // Update files and create previews
    setEvidenceFiles(prev => [...prev, ...files]);
    
    // Create preview URLs
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setEvidencePreviews(prev => [...prev, ...newPreviews]);
  };

  const handleRemoveEvidenceFile = (index: number) => {
    // Revoke the preview URL to prevent memory leaks
    URL.revokeObjectURL(evidencePreviews[index]);
    
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
    setEvidencePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleQualitySubmit = async () => {
    try {
      const qualityDataWithEvidence = {
        ...qualityData,
        generalNotes,
        evidenceFiles: evidenceFiles.length > 0 ? evidenceFiles : undefined
      };

      await processQualityReview(delivery.id, qualityDataWithEvidence);
      
      // Clear evidence files after successful upload
      setEvidenceFiles([]);
      setEvidencePreviews([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      loadDelivery();
    } catch (error) {
      console.error('Error processing quality review:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_quality': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'partial_approved': return 'bg-orange-100 text-orange-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_quality': return 'En Revisión';
      case 'approved': return 'Aprobada';
      case 'partial_approved': return 'Parcial';
      case 'rejected': return 'Rechazada';
      default: return status;
    }
  };

  const getTotalQuantities = () => {
    if (!delivery.delivery_items) return { delivered: 0, approved: 0, defective: 0 };
    
    return delivery.delivery_items.reduce((totals: any, item: any) => ({
      delivered: totals.delivered + (item.quantity_delivered || 0),
      approved: totals.approved + (item.quantity_approved || 0),
      defective: totals.defective + (item.quantity_defective || 0)
    }), { delivered: 0, approved: 0, defective: 0 });
  };

  const getQualityTotals = () => {
    let totalApproved = 0;
    let totalDefective = 0;
    
    Object.values(qualityData.variants).forEach((variant: any) => {
      totalApproved += variant.approved || 0;
      totalDefective += variant.defective || 0;
    });
    
    return { totalApproved, totalDefective };
  };

  const getDiscrepancies = () => {
    const discrepancies: any[] = [];
    
    delivery.delivery_items?.forEach((item: any) => {
      const delivered = item.quantity_delivered || 0;
      const variantData = qualityData.variants[item.id] || {};
      const approved = variantData.approved || 0;
      const defective = variantData.defective || 0;
      const reviewed = approved + defective;
      
      // Only consider discrepancy if user has entered values (approved > 0 OR defective > 0)
      if ((approved > 0 || defective > 0) && delivered !== reviewed) {
        discrepancies.push({
          item,
          delivered,
          reviewed,
          difference: delivered - reviewed
        });
      }
    });
    
    return discrepancies;
  };

  const totals = getTotalQuantities();
  const qualityTotals = getQualityTotals();
  const discrepancies = getDiscrepancies();
  const canEdit = canEditDeliveries && ['pending', 'in_quality'].includes(delivery.status);
  const canProcessQuality = canEditDeliveries && ['pending', 'in_quality'].includes(delivery.status);
  const hasDiscrepancies = discrepancies.length > 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => onBack()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{delivery.tracking_number}</h1>
            <p className="text-muted-foreground">
              Orden: {delivery.orders?.order_number} • 
              Taller: {delivery.workshops?.name || 'Sin asignar'}
            </p>
          </div>
        </div>
        <Badge className={getStatusColor(delivery.status)}>
          {getStatusText(delivery.status)}
        </Badge>
      </div>

      {/* Resumen de Revisión - Solo mostrar si ha sido procesada */}
      <DeliveryReviewSummary 
        delivery={delivery}
        totalDelivered={totals.delivered}
        totalApproved={totals.approved}
        totalDefective={totals.defective}
      />

      {/* Delivery Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información de la Entrega</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Fecha de Entrega</Label>
              <p className="font-medium">
                {delivery.delivery_date ? format(new Date(delivery.delivery_date), 'dd/MM/yyyy', { locale: es }) : 'Sin fecha'}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Total Entregado</Label>
              <p className="font-medium text-blue-600">{totals.delivered} unidades</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Estado</Label>
              <p className="font-medium">{getStatusText(delivery.status)}</p>
            </div>
          </div>
          {delivery.notes && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Notas</Label>
              <p className="text-sm bg-gray-50 p-3 rounded">{delivery.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Entregados - Only for users WITHOUT QC permissions */}
      {!canProcessQuality && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-5 h-5" />
              <span>Items Entregados ({delivery.delivery_items?.length || 0})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {delivery.delivery_items?.map((item: any) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {item.order_items?.product_variants?.products?.name || 'Producto'}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {item.order_items?.product_variants?.size} - {item.order_items?.product_variants?.color}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        SKU: {item.order_items?.product_variants?.sku_variant}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-lg">
                        {item.quantity_delivered} entregadas
                      </p>
                      {item.quantity_approved > 0 && (
                        <p className="text-sm text-green-600">
                          {item.quantity_approved} aprobadas
                        </p>
                      )}
                      {item.quantity_defective > 0 && (
                        <p className="text-sm text-red-600">
                          {item.quantity_defective} defectuosas
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Control Section - Only for users WITH QC permissions */}
      {canProcessQuality && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Control de Calidad</CardTitle>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  {isEditing ? 'Cancelar' : 'Editar Cantidades'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quality Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Total Entregadas</Label>
                <p className="text-2xl font-bold text-blue-600">{totals.delivered}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Total Aprobadas</Label>
                <p className="text-2xl font-bold text-green-600">{qualityTotals.totalApproved}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Total Defectuosas</Label>
                <p className="text-2xl font-bold text-red-600">{qualityTotals.totalDefective}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Total Revisadas</Label>
                <p className="text-2xl font-bold text-purple-600">{qualityTotals.totalApproved + qualityTotals.totalDefective}</p>
              </div>
            </div>

            {/* Quality Control Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-3 text-left">Variante</th>
                    <th className="border border-gray-300 p-3 text-center">Entregadas</th>
                    <th className="border border-gray-300 p-3 text-center">Aprobadas</th>
                    <th className="border border-gray-300 p-3 text-center">Defectuosas</th>
                    <th className="border border-gray-300 p-3 text-left">Motivo/Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {delivery.delivery_items?.map((item: any) => {
                    const delivered = item.quantity_delivered || 0;
                    const variantData = qualityData.variants[item.id] || {};
                    const approved = variantData.approved || 0;
                    const defective = variantData.defective || 0;
                    const reviewed = approved + defective;
                    const hasUserInput = approved > 0 || defective > 0;
                    const hasDiscrepancy = hasUserInput && delivered !== reviewed;
                    
                    return (
                      <tr key={item.id}>
                        <td className="border border-gray-300 p-3">
                          <div>
                            <p className="font-medium">{item.order_items?.product_variants?.products?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.order_items?.product_variants?.size} - {item.order_items?.product_variants?.color}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              SKU: {item.order_items?.product_variants?.sku_variant}
                            </p>
                          </div>
                        </td>
                        <td className="border border-gray-300 p-3 text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              value={quantityData[item.id] || 0}
                              onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                              className="w-20 mx-auto text-center"
                            />
                          ) : (
                            <span className="font-bold text-blue-600">{delivered}</span>
                          )}
                        </td>
                        <td className="border border-gray-300 p-3 text-center">
                          <Input
                            type="number"
                            min="0"
                            max={delivered}
                            value={approved}
                            onChange={(e) => handleQualityChange(item.id, 'approved', parseInt(e.target.value) || 0)}
                            className="w-20 mx-auto text-center"
                            disabled={isEditing}
                          />
                        </td>
                        <td className="border border-gray-300 p-3 text-center">
                          <Input
                            type="number"
                            min="0"
                            max={delivered}
                            value={defective}
                            onChange={(e) => handleQualityChange(item.id, 'defective', parseInt(e.target.value) || 0)}
                            className="w-20 mx-auto text-center"
                            disabled={isEditing}
                          />
                        </td>
                        <td className="border border-gray-300 p-3">
                          <Textarea
                            placeholder="Observaciones..."
                            value={variantData.reason || ''}
                            onChange={(e) => handleQualityChange(item.id, 'reason', e.target.value)}
                            rows={2}
                            className="text-sm"
                            disabled={isEditing}
                          />
                          {hasDiscrepancy && (
                            <p className="text-orange-600 text-sm mt-1">
                              Total revisadas: {reviewed} (entregadas: {delivered})
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Save quantities button when editing */}
            {isEditing && (
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveQuantities} disabled={loading}>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </Button>
              </div>
            )}

            {/* General Notes */}
            {!isEditing && (
              <div>
                <Label className="text-sm font-medium">Notas Generales de Calidad</Label>
                <Textarea
                  placeholder="Comentarios adicionales sobre la entrega..."
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Evidence Upload Section */}
            {!isEditing && (
              <div className="space-y-4">
                <Label className="text-sm font-medium">Evidencia Fotográfica (Opcional)</Label>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleEvidenceFilesSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center space-x-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Subir Fotos de Evidencia</span>
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      (Máximo 10 archivos, 5MB cada uno)
                    </span>
                  </div>

                  {/* Preview Selected Files */}
                  {evidenceFiles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Archivos seleccionados:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {evidenceFiles.map((file, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
                              <img
                                src={evidencePreviews[index]}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="absolute top-1 right-1">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveEvidenceFile(index)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-center mt-1 truncate">{file.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isEditing && (
              <div className="flex justify-end">
                <Button 
                  onClick={handleQualitySubmit} 
                  disabled={loading || hasDiscrepancies}
                  className={hasDiscrepancies ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Procesar Control de Calidad
                </Button>
              </div>
            )}

            {hasDiscrepancies && !isEditing && (
              <p className="text-sm text-orange-600 text-center">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Corrige las discrepancias antes de procesar el control de calidad
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Evidence Gallery - Only for users without QC permissions */}
      {!canProcessQuality && (
        <DeliveryEvidenceGallery deliveryId={delivery.id} />
      )}
    </div>
  );
};

export default DeliveryDetails;
