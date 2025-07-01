
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';

interface OrdersEmptyStateProps {
  searchTerm: string;
  selectedWorkshop: string;
  selectedStatus: string;
  isAdmin: boolean;
}

const OrdersEmptyState = ({ 
  searchTerm, 
  selectedWorkshop, 
  selectedStatus, 
  isAdmin 
}: OrdersEmptyStateProps) => {
  const hasActiveFilters = searchTerm || selectedWorkshop !== 'all' || selectedStatus !== 'all';
  
  return (
    <Card className="bg-white border-0 shadow-sm rounded-2xl">
      <CardContent className="p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900">
          {hasActiveFilters 
            ? 'No se encontraron órdenes' 
            : isAdmin 
              ? 'No hay órdenes' 
              : 'No tienes órdenes asignadas'
          }
        </h3>
        <p className="text-gray-500">
          {hasActiveFilters 
            ? 'Intenta ajustar los filtros de búsqueda' 
            : isAdmin 
              ? 'Cuando se creen órdenes, aparecerán aquí.' 
              : 'Cuando se te asignen órdenes, aparecerán aquí.'
          }
        </p>
      </CardContent>
    </Card>
  );
};

export default OrdersEmptyState;
