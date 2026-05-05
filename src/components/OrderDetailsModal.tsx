import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, FileText, Package, Settings, Truck, User, Eye, Edit, Trash2, Factory, Download, AlertTriangle, Zap, Edit3, RefreshCw } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import OrderDeliveryTracker from './OrderDeliveryTracker';
import { useUserContext } from '@/hooks/useUserContext';
import { formatDateSafe } from '@/lib/dateUtils';
import { useOrderMaterialConsumptions } from '@/hooks/useOrderMaterialConsumptions';
import MaterialConsumptionEditForm from '@/components/supplies/MaterialConsumptionEditForm';
import { usePermissions } from '@/hooks/usePermissions';
import { WorkshopReassignmentDialog } from './WorkshopReassignmentDialog';

interface OrderDetailsModalProps {
  order: any;
  open: boolean;
  onClose: () => void;
  onEdit: (order: any) => void;
  onDelete: (orderId: string) => void;
}

const OrderDetailsModal = ({ order, open, onClose, onEdit, onDelete }: OrderDetailsModalProps) => {
  const { canEditOrders, canDeleteOrders } = useUserContext();
  const { hasPermission } = usePermissions();
  const { data: materialConsumptions, isLoading: loadingConsumptions } = useOrderMaterialConsumptions(order?.id);
  const [editingConsumption, setEditingConsumption] = useState<any>(null);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  
  if (!order) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEditConsumptionSuccess = () => {
    setEditingConsumption(null);
    // Refetch material consumptions
    window.location.reload(); // Simple way to refresh data
  };

  const canEditMaterials = hasPermission('insumos', 'edit');

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'assigned':
        return 'Asignada';
      case 'in_progress':
        return 'En Progreso';
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTotalQuantity = () => {
    if (!order.order_items) return 0;
    return order.order_items.reduce((total: number, item: any) => total + item.quantity, 0);
  };

  const handleFileAction = (file: any, action: 'view' | 'download') => {
    // Check if it's a legacy mock URL
    if (file.file_url && file.file_url.includes('mock-url/')) {
      console.warn('Legacy file URL detected:', file.file_url);
      return;
    }

    try {
      if (action === 'view') {
        window.open(file.file_url, '_blank');
      } else if (action === 'download') {
        // Create a temporary link to trigger download
        const link = document.createElement('a');
        link.href = file.file_url;
        link.download = file.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error handling file action:', error);
    }
  };

  const isLegacyFile = (fileUrl: string) => {
    return fileUrl && fileUrl.includes('mock-url/');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-black">
                  {order.order_number}
                </DialogTitle>
                <Badge className={getStatusColor(order.status)}>
                  {getStatusText(order.status)}
                </Badge>
              </div>
            </div>
            <div className="flex space-x-2">
              {canEditOrders && (
                <Button
                  onClick={() => onEdit(order)}
                  variant="outline"
                  size="sm"
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}
              {canDeleteOrders && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar orden de producción?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará permanentemente la orden {order.order_number} y todos sus datos asociados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(order.id)}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6">
          <Tabs defaultValue="details" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Detalles de la Orden</TabsTrigger>
              <TabsTrigger value="deliveries">Seguimiento de Entregas</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              {/* Información General */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>Información General</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-600">Fecha de Creación</p>
                        <p className="font-medium">{formatDateSafe(order.created_at?.split('T')[0])}</p>
                      </div>
                    </div>
                    {order.due_date && (
                      <div className="flex items-center space-x-2">
                        <Truck className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-600">Fecha de Entrega</p>
                          <p className="font-medium">{formatDateSafe(order.due_date)}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Package className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-600">Cantidad Total</p>
                        <p className="font-medium text-blue-600">{getTotalQuantity()} unidades</p>
                      </div>
                    </div>
                  </div>

                  {/* Mostrar taller asignado si existe */}
                  {order.workshop_assignments && order.workshop_assignments.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Factory className="w-4 h-4 text-blue-600" />
                          <p className="text-sm text-blue-600 font-medium">Taller Asignado:</p>
                          <p className="text-sm text-blue-800">{order.workshop_assignments[0].workshops?.name}</p>
                        </div>
                        {canEditOrders && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowReassignDialog(true)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Cambiar Taller
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {order.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 font-medium mb-1">Notas:</p>
                      <p className="text-sm text-gray-700">{order.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Productos */}
              {order.order_items && order.order_items.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Package className="w-5 h-5" />
                      <span>Productos ({order.order_items.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {order.order_items.map((item: any, index: number) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          {item.product_variants?.products?.image_url ? (
                            <img
                              src={item.product_variants.products.image_url}
                              alt={item.product_variants.products.name || ''}
                              className="w-12 h-12 rounded object-cover flex-shrink-0 border border-border"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-black">
                              {item.product_variants?.products?.name || 'Producto'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              Variante: {item.product_variants?.size} - {item.product_variants?.color}
                            </p>
                            <p className="text-sm text-gray-600">
                              SKU: {item.product_variants?.sku}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-medium text-lg text-blue-600">Cantidad: {item.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Insumos */}
              {order.order_supplies && order.order_supplies.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Settings className="w-5 h-5" />
                      <span>Insumos ({order.order_supplies.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {order.order_supplies.map((supply: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-medium text-black">
                              {supply.materials?.name || 'Material'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              Categoría: {supply.materials?.category}
                            </p>
                            {supply.notes && (
                              <p className="text-sm text-gray-600">
                                Notas: {supply.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {supply.quantity} {supply.unit}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Consumos de Materiales */}
              {materialConsumptions && materialConsumptions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Zap className="w-5 h-5" />
                      <span>Consumos de Materiales ({materialConsumptions.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingConsumptions ? (
                      <div className="text-center py-4 text-gray-500">
                        Cargando consumos...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {materialConsumptions.map((consumption: any, index: number) => (
                           <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                             <div className="flex-1">
                               <div className="flex items-center space-x-2">
                                 <h4 className="font-medium text-black">
                                   {consumption.materials?.name || 'Material'}
                                 </h4>
                                 {consumption.has_duplicates && (
                                   <Badge variant="destructive" className="text-xs">
                                     Duplicado
                                   </Badge>
                                 )}
                               </div>
                               <p className="text-sm text-gray-600">
                                 SKU: {consumption.materials?.sku} • Categoría: {consumption.materials?.category}
                               </p>
                               {consumption.materials?.color && (
                                 <p className="text-sm text-gray-600">
                                   Color: {consumption.materials.color}
                                 </p>
                               )}
                               <p className="text-xs text-gray-500 mt-1">
                                 Consumido el: {formatDateSafe(consumption.delivery_date)}
                               </p>
                               {consumption.notes && (
                                 <p className="text-sm text-gray-600 mt-1">
                                   Notas: {consumption.notes}
                                 </p>
                               )}
                             </div>
                            <div className="flex items-center space-x-3">
                              <div className="text-right">
                                <p className="font-medium text-orange-600">
                                  -{consumption.quantity_consumed} {consumption.materials?.unit}
                                </p>
                                <p className="text-xs text-gray-500">Consumido</p>
                              </div>
                              {canEditMaterials && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingConsumption(consumption)}
                                  className="h-8 w-8 p-0 text-gray-500 hover:text-orange-600"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Archivos */}
              {order.order_files && order.order_files.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="w-5 h-5" />
                      <span>Archivos Adjuntos ({order.order_files.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {order.order_files.map((file: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <FileText className="w-8 h-8 text-blue-500" />
                            <div>
                              <p className="font-medium text-black">{file.file_name}</p>
                              <p className="text-sm text-gray-600">
                                {file.file_type} • {Math.round(file.file_size / 1024)} KB
                              </p>
                              {isLegacyFile(file.file_url) && (
                                <div className="flex items-center space-x-1 mt-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                  <span className="text-xs text-amber-600">Archivo legacy - No disponible</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            {!isLegacyFile(file.file_url) ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleFileAction(file, 'view')}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleFileAction(file, 'download')}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Descargar
                                </Button>
                              </>
                            ) : (
                              <Alert className="max-w-xs">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                  Este archivo fue creado antes de la actualización del sistema y no está disponible.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="deliveries">
              <OrderDeliveryTracker 
                orderId={order.id} 
                orderNumber={order.order_number}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
      
      {/* Modal de edición de consumo de material */}
      {editingConsumption && (
        <MaterialConsumptionEditForm
          consumption={editingConsumption}
          open={!!editingConsumption}
          onClose={() => setEditingConsumption(null)}
          onSuccess={handleEditConsumptionSuccess}
        />
      )}

      {/* Modal de reasignación de taller */}
      {order.workshop_assignments && order.workshop_assignments.length > 0 && (
        <WorkshopReassignmentDialog
          open={showReassignDialog}
          onClose={() => setShowReassignDialog(false)}
          orderId={order.id}
          orderNumber={order.order_number}
          currentAssignment={{
            id: order.workshop_assignments[0].id,
            workshop_id: order.workshop_assignments[0].workshop_id,
            workshop_name: order.workshop_assignments[0].workshops?.name || ''
          }}
          onSuccess={() => {
            setShowReassignDialog(false);
            window.location.reload();
          }}
        />
      )}
    </Dialog>
  );
};

export default OrderDetailsModal;
