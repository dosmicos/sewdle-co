import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw, ArrowRight, Barcode } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import DeliveryManualBarcodeModal from './delivery/DeliveryManualBarcodeModal';

interface DeliveryReviewSummaryProps {
  delivery: any;
  totalDelivered: number;
  totalApproved: number;
  totalDefective: number;
}

const DeliveryReviewSummary = ({ delivery, totalDelivered, totalApproved, totalDefective }: DeliveryReviewSummaryProps) => {
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const approvalRate = totalDelivered > 0 ? ((totalApproved / totalDelivered) * 100) : 0;
  
  const getSyncStatusInfo = () => {
    if (delivery.synced_to_shopify) {
      return {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        text: 'Sincronizado con Shopify',
        description: delivery.last_sync_attempt 
          ? `Sincronizado el ${format(new Date(delivery.last_sync_attempt), 'dd/MM/yyyy HH:mm', { locale: es })}`
          : 'Inventario actualizado en Shopify'
      };
    } else if (delivery.sync_attempts > 0 && !delivery.synced_to_shopify && delivery.sync_error_message) {
      return {
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        text: 'Error de Sincronización',
        description: delivery.sync_error_message || 
          `${delivery.sync_attempts} intento(s) fallidos. Último intento: ${
            delivery.last_sync_attempt 
              ? format(new Date(delivery.last_sync_attempt), 'dd/MM/yyyy HH:mm', { locale: es })
              : 'N/A'
          }`
      };
    } else if (totalApproved > 0) {
      return {
        icon: Clock,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        text: 'Pendiente de Sincronización',
        description: 'Las unidades aprobadas están pendientes de sincronizar con Shopify'
      };
    } else {
      return {
        icon: AlertTriangle,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        text: 'Sin Items para Sincronizar',
        description: 'No hay unidades aprobadas para sincronizar'
      };
    }
  };

  const getDeliveryStatusInfo = () => {
    switch (delivery.status) {
      case 'approved':
        return { icon: CheckCircle, color: 'text-green-600', text: 'Entrega Aprobada' };
      case 'partial_approved':
        return { icon: AlertTriangle, color: 'text-orange-600', text: 'Parcialmente Aprobada' };
      case 'rejected':
        return { icon: XCircle, color: 'text-red-600', text: 'Entrega Rechazada' };
      case 'in_quality':
        return { icon: RefreshCw, color: 'text-blue-600', text: 'En Revisión de Calidad' };
      default:
        return { icon: Clock, color: 'text-gray-600', text: 'Pendiente' };
    }
  };

  const syncStatus = getSyncStatusInfo();
  const deliveryStatus = getDeliveryStatusInfo();

  // Solo mostrar el resumen si la entrega ha sido procesada
  if (delivery.status === 'pending') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Resumen de Números */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <deliveryStatus.icon className={`w-5 h-5 ${deliveryStatus.color}`} />
            <span>Resumen de Revisión de Calidad</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-blue-600 mb-1">{totalDelivered}</div>
              <div className="text-sm font-medium text-blue-700">Total Entregadas</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-3xl font-bold text-green-600 mb-1">{totalApproved}</div>
              <div className="text-sm font-medium text-green-700">Aprobadas</div>
            </div>
            
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-3xl font-bold text-red-600 mb-1">{totalDefective}</div>
              <div className="text-sm font-medium text-red-700">Defectuosas</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-3xl font-bold text-purple-600 mb-1">{approvalRate.toFixed(1)}%</div>
              <div className="text-sm font-medium text-purple-700">Tasa de Aprobación</div>
            </div>
          </div>

          {/* Barcode Print Button - Always visible when there are approved items */}
          {totalApproved > 0 && (
            <div className="mt-6 pt-4 border-t">
              <Button 
                onClick={() => setShowBarcodeModal(true)}
                variant="outline"
                className="w-full gap-2"
              >
                <Barcode className="w-4 h-4" />
                Imprimir Códigos de Barras (Manual)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Barcode Modal */}
      <DeliveryManualBarcodeModal
        isOpen={showBarcodeModal}
        onClose={() => setShowBarcodeModal(false)}
        deliveryItems={delivery.delivery_items || []}
        trackingNumber={delivery.tracking_number || ''}
      />

      {/* Estado de Sincronización con Shopify */}
      <Card className={`${syncStatus.bgColor} ${syncStatus.borderColor} border-2`}>
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <syncStatus.icon className={`w-8 h-8 ${syncStatus.color}`} />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${syncStatus.color} mb-2`}>
                Estado de Sincronización con Shopify
              </h3>
              <div className="space-y-2">
                <Badge variant="outline" className={`${syncStatus.color} ${syncStatus.bgColor} border-current`}>
                  {syncStatus.text}
                </Badge>
                <p className="text-sm text-gray-700">
                  {syncStatus.description}
                </p>
                {delivery.sync_attempts > 0 && (
                  <p className="text-xs text-gray-600">
                    Intentos de sincronización: {delivery.sync_attempts}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline del Proceso - Horizontal Compacto */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline del Proceso</CardTitle>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <div className="flex flex-wrap items-center gap-2 p-4 bg-gray-50 rounded-lg">
              
              {/* Entrega Creada */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Creada</span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(delivery.created_at), 'dd/MM', { locale: es })}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Entrega creada el {format(new Date(delivery.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                </TooltipContent>
              </Tooltip>

              <ArrowRight className="w-4 h-4 text-gray-400" />

              {/* Revisión de Calidad */}
              {(totalApproved > 0 || totalDefective > 0) && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">Revisión QC</span>
                        <span className="text-xs text-gray-500">
                          {totalApproved}✓ {totalDefective}✗
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Revisión de Calidad Completada: {totalApproved} aprobadas, {totalDefective} defectuosas</p>
                    </TooltipContent>
                  </Tooltip>

                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </>
              )}

              {/* Estado Final */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
                    <deliveryStatus.icon className={`w-4 h-4 ${deliveryStatus.color}`} />
                    <span className={`text-sm font-medium ${deliveryStatus.color.replace('text-', 'text-')}`}>
                      {delivery.status === 'approved' ? 'Aprobada' : 
                       delivery.status === 'partial_approved' ? 'Parcial' :
                       delivery.status === 'rejected' ? 'Rechazada' : 'En Proceso'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {approvalRate.toFixed(0)}%
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{deliveryStatus.text} - Tasa de aprobación: {approvalRate.toFixed(1)}%</p>
                </TooltipContent>
              </Tooltip>

              <ArrowRight className="w-4 h-4 text-gray-400" />

              {/* Sincronización con Shopify */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
                    <syncStatus.icon className={`w-4 h-4 ${syncStatus.color}`} />
                    <span className={`text-sm font-medium ${syncStatus.color.replace('text-', 'text-')}`}>
                      {delivery.synced_to_shopify ? 'Sincronizado' :
                       delivery.sync_attempts > 0 ? 'Error Sync' : 
                       totalApproved > 0 ? 'Pendiente' : 'Sin Sync'}
                    </span>
                    {totalApproved > 0 && (
                      <span className="text-xs text-gray-500">
                        {totalApproved} unds
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{syncStatus.text}</p>
                  <p className="text-xs">{syncStatus.description}</p>
                </TooltipContent>
              </Tooltip>

            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeliveryReviewSummary;
