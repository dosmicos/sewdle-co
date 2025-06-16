import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, FileText, Package, Settings, Truck, User, Eye, Edit, Trash2, Factory } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface OrderDetailsModalProps {
  order: any;
  open: boolean;
  onClose: () => void;
  onEdit: (order: any) => void;
  onDelete: (orderId: string) => void;
}

const OrderDetailsModal = ({ order, open, onClose, onEdit, onDelete }: OrderDetailsModalProps) => {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
              <Button
                onClick={() => onEdit(order)}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
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
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
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
                    <p className="font-medium">{formatDate(order.created_at)}</p>
                  </div>
                </div>
                {order.due_date && (
                  <div className="flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Fecha de Entrega</p>
                      <p className="font-medium">{formatDate(order.due_date)}</p>
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
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(file.file_url, '_blank')}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsModal;
