
import React from 'react';
import { useOrderStats } from '@/hooks/useOrderStats';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Eye, Edit, FileText, Building, Trash2 } from 'lucide-react';

// Helper function to format dates for the orders list
const formatDateForList = (dateString: string): string => {
  if (!dateString) return 'Sin fecha';
  
  // Parse the date components manually to avoid timezone issues
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
  
  // Create date using local timezone (month is 0-indexed)
  const date = new Date(year, month - 1, day);
  
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

interface OrderCardProps {
  order: unknown;
  onView: (order: unknown) => void;
  onEdit: (order: unknown) => void;
  onDelete: (order: unknown) => void;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  getWorkshopName: (order: unknown) => string;
  getWorkshopColor: (order: unknown) => string;
  canEdit: boolean;
  canDelete: boolean;
}

const OrderCard = ({
  order,
  onView,
  onEdit,
  onDelete,
  getStatusColor,
  getStatusText,
  getWorkshopName,
  getWorkshopColor,
  canEdit,
  canDelete
}: OrderCardProps) => {
  const {
    stats,
    loading: statsLoading,
    error: statsError
  } = useOrderStats(order.id);
  const isMobile = useIsMobile();

  return (
    <Card className="bg-white border-0 shadow-sm rounded-2xl hover:shadow-md transition-all duration-200">
      <CardContent className="p-4 md:p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
              <FileText className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-gray-900">{order.order_number}</h3>
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-xs md:text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                  {formatDateForList(order.created_at)}
                </span>
                <span>
                  Entrega: {order.due_date ? formatDateForList(order.due_date) : 'Sin fecha'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge className={`${getStatusColor(order.status)} border rounded-full px-2 md:px-3 py-1 text-xs`}>
              {getStatusText(order.status)}
            </Badge>
          </div>
        </div>

        {/* Información del taller - Más prominente */}
        <div className="mb-4">
          <Badge className={`${getWorkshopColor(order)} border rounded-full px-2 md:px-3 py-1 text-xs md:text-sm`}>
            <Building className="w-3 h-3 md:w-4 md:h-4 mr-1" />
            {getWorkshopName(order)}
          </Badge>
        </div>

        {/* Estadísticas de progreso */}
        <div className="mb-6 p-3 md:p-4 bg-gray-50 rounded-2xl">
          {statsError ? (
            <div className="text-center py-4">
              <div className="text-sm text-red-600 mb-2">
                Error al cargar estadísticas
              </div>
              <div className="text-xs text-gray-500">
                Los datos se mostrarán cuando estén disponibles
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg md:text-2xl font-bold text-blue-600">
                    {statsLoading ? (
                      <div className="w-6 md:w-8 h-4 md:h-6 bg-gray-200 rounded animate-pulse mx-auto"></div>
                    ) : (
                      stats.totalOrdered
                    )}
                  </div>
                  <div className="text-xs md:text-sm text-gray-500">Ordenado</div>
                </div>
                <div className="text-center border-l border-r border-gray-200">
                  <div className="text-lg md:text-2xl font-bold text-green-600">
                    {statsLoading ? (
                      <div className="w-6 md:w-8 h-4 md:h-6 bg-gray-200 rounded animate-pulse mx-auto"></div>
                    ) : (
                      stats.totalApproved
                    )}
                  </div>
                  <div className="text-xs md:text-sm text-gray-500">Aprobado</div>
                </div>
                <div className="text-center">
                  <div className="text-lg md:text-2xl font-bold text-orange-600">
                    {statsLoading ? (
                      <div className="w-6 md:w-8 h-4 md:h-6 bg-gray-200 rounded animate-pulse mx-auto"></div>
                    ) : (
                      stats.totalPending
                    )}
                  </div>
                  <div className="text-xs md:text-sm text-gray-500">Pendiente</div>
                </div>
              </div>
              
              {/* Barra de progreso */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-gray-600">Progreso de producción</span>
                  <span className="font-medium text-gray-900">
                    {statsLoading ? (
                      <div className="w-8 md:w-12 h-3 md:h-4 bg-gray-200 rounded animate-pulse"></div>
                    ) : (
                      `${stats.completionPercentage}%`
                    )}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      statsLoading ? 'bg-gray-300 animate-pulse' : 'bg-blue-500'
                    }`} 
                    style={{
                      width: `${statsLoading ? 30 : stats.completionPercentage}%`
                    }}
                  ></div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className={`flex gap-2 md:gap-3 ${isMobile ? 'justify-center' : 'justify-end'}`}>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onView(order)} 
            className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl text-xs md:text-sm"
          >
            <Eye className="w-3 h-3 md:w-4 md:h-4" />
            {isMobile ? '' : 'Ver'}
          </Button>
          {canEdit && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit(order)} 
              className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 border-green-200 text-green-600 hover:bg-green-50 rounded-xl text-xs md:text-sm"
            >
              <Edit className="w-3 h-3 md:w-4 md:h-4" />
              {isMobile ? '' : 'Editar'}
            </Button>
          )}
          {canDelete && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onDelete(order)} 
              className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs md:text-sm"
            >
              <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
              {isMobile ? '' : 'Eliminar'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderCard;
