import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, FileText, Package, Settings, Truck, Factory, Download, AlertTriangle, Zap, ArrowLeft, Plus, Edit3 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import OrderDeliveryTracker from '@/components/OrderDeliveryTracker';
import DeliveryForm from '@/components/DeliveryForm';
import OrderEditModal from '@/components/OrderEditModal';
import { useUserContext } from '@/hooks/useUserContext';
import { formatDateSafe } from '@/lib/dateUtils';
import { useOrderMaterialConsumptions } from '@/hooks/useOrderMaterialConsumptions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import MaterialConsumptionEditForm from '@/components/supplies/MaterialConsumptionEditForm';

const OrderDetailsPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingConsumption, setEditingConsumption] = useState<any>(null);
  
  const { orders, loading, fetchOrders } = useOrders();
  const { canEditOrders, canDeleteOrders, canCreateDeliveries } = useUserContext();
  const order = orders.find(o => o.id === orderId);
  const { hasPermission } = useAuth();
  const { data: materialConsumptions, isLoading: loadingConsumptions } = useOrderMaterialConsumptions(orderId || '');

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Orden no encontrada</h2>
          <p className="text-gray-600 mt-2">La orden que buscas no existe o no tienes permisos para verla.</p>
          <Button onClick={() => navigate('/orders')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Órdenes
          </Button>
        </div>
      </div>
    );
  }

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

  const getTotalQuantity = () => {
    if (!order.order_items) return 0;
    return order.order_items.reduce((total: number, item: any) => total + item.quantity, 0);
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    fetchOrders();
    toast({
      title: "Orden actualizada",
      description: "La orden ha sido actualizada correctamente.",
    });
  };

  const handleDelete = async () => {
    try {
      // Implement delete functionality
      toast({
        title: "Función en desarrollo",
        description: "La eliminación de órdenes será implementada próximamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la orden.",
        variant: "destructive",
      });
    }
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

  const handleDeliveryCreated = () => {
    setShowDeliveryForm(false);
    toast({
      title: "Entrega creada",
      description: "La entrega ha sido creada exitosamente.",
    });
  };

  const handleEditConsumptionSuccess = () => {
    setEditingConsumption(null);
    // Refetch material consumptions
    window.location.reload(); // Simple way to refresh data
  };

  const canEditMaterials = hasPermission('insumos', 'edit');

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/orders')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </Button>
          
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {order.order_number}
              </h1>
              <Badge className={getStatusColor(order.status)}>
                {getStatusText(order.status)}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {canCreateDeliveries && (
            <Button
              onClick={() => setShowDeliveryForm(true)}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Entrega
            </Button>
          )}
          
          {canEditOrders && (
            <Button
              onClick={handleEdit}
              variant="outline"
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              <Settings className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
          
          {canDeleteOrders && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
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
                    onClick={handleDelete}
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

      {/* Content */}
      <Tabs defaultValue="deliveries" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="deliveries">Seguimiento de Entregas</TabsTrigger>
          <TabsTrigger value="details">Detalles de la Orden</TabsTrigger>
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
                  <div className="flex items-center space-x-2">
                    <Factory className="w-4 h-4 text-blue-600" />
                    <p className="text-sm text-blue-600 font-medium">Taller Asignado:</p>
                    <p className="text-sm text-blue-800">{order.workshop_assignments[0].workshops?.name}</p>
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
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
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
                      <div className="text-right">
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
                        {!isLegacyFile(file.file_url) && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFileAction(file, 'view')}
                            >
                              Ver
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFileAction(file, 'download')}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </>
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
          <OrderDeliveryTracker orderId={order.id} orderNumber={order.order_number} />
        </TabsContent>
      </Tabs>

      {/* Modal de creación de entrega */}
      {showDeliveryForm && (
        <DeliveryForm 
          preselectedOrderId={orderId}
          onClose={() => setShowDeliveryForm(false)}
          onDeliveryCreated={handleDeliveryCreated}
        />
      )}

      {/* Modal de edición de orden */}
      {showEditModal && order && (
        <OrderEditModal
          order={order}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Modal de edición de consumo de material */}
      {editingConsumption && (
        <MaterialConsumptionEditForm
          consumption={editingConsumption}
          open={!!editingConsumption}
          onClose={() => setEditingConsumption(null)}
          onSuccess={handleEditConsumptionSuccess}
        />
      )}
    </div>
  );
};

export default OrderDetailsPage;