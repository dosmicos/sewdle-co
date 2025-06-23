
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, MapPin, Phone, Mail, Star, Calendar, Package, Clock, User } from 'lucide-react';
import { useWorkshopStats } from '@/hooks/useWorkshopStats';
import { useWorkshopOrders } from '@/hooks/useWorkshopOrders';
import type { Workshop } from '@/hooks/useWorkshops';

interface WorkshopDetailsProps {
  workshop: Workshop;
  onBack: () => void;
}

const WorkshopDetails = ({ workshop, onBack }: WorkshopDetailsProps) => {
  const { stats, loading: statsLoading } = useWorkshopStats(workshop.id);
  const { orders, loading: ordersLoading } = useWorkshopOrders(workshop.id);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completado':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'En Progreso':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Alta':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Media':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Baja':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (statsLoading || ordersLoading) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos del taller...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center space-x-4">
        <Button 
          onClick={onBack}
          variant="outline"
          className="border border-gray-300 bg-white hover:bg-gray-50 text-black rounded-xl px-4 py-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Talleres
        </Button>
      </div>

      {/* Información General del Taller */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-black">{workshop.name}</h2>
              <p className="text-gray-600">{workshop.email || 'Sin email'}</p>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {workshop.address && (
                <div className="flex items-center space-x-3">
                  <MapPin className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-700">{workshop.address}</span>
                </div>
              )}
              {workshop.phone && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-700">{workshop.phone}</span>
                </div>
              )}
              {workshop.email && (
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-700">{workshop.email}</span>
                </div>
              )}
              {workshop.contactPerson && (
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-700">{workshop.contactPerson}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{stats.activeOrders}</p>
                <p className="text-sm text-gray-600">Órdenes Activas</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{stats.completionRate}%</p>
                <p className="text-sm text-gray-600">Finalización</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center space-x-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="text-gray-700">Calidad</span>
              </div>
              <span className="font-bold text-black">{stats.qualityScore}/5</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-green-500" />
                <span className="text-gray-700">Puntualidad</span>
              </div>
              <span className="font-bold text-black">{stats.onTimeDelivery}%</span>
            </div>
          </div>

          {/* Especialidades */}
          {workshop.specialties && workshop.specialties.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-black">Especialidades</h3>
              <div className="flex flex-wrap gap-2">
                {workshop.specialties.map((specialty, index) => (
                  <span key={index} className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full">
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Información adicional */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workshop.city && (
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600">Ciudad</p>
                <p className="font-semibold text-black">{workshop.city}</p>
              </div>
            )}
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600">Capacidad</p>
              <p className="font-semibold text-black">{workshop.capacity}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600">Estado</p>
              <p className="font-semibold text-black">{workshop.status === 'active' ? 'Activo' : 'Inactivo'}</p>
            </div>
          </div>

          {/* Horarios de trabajo */}
          {(workshop.workingHoursStart || workshop.workingHoursEnd) && (
            <div className="p-4 bg-blue-50 rounded-xl">
              <h4 className="font-semibold text-black mb-2">Horarios de Trabajo</h4>
              <p className="text-gray-600">
                {workshop.workingHoursStart || '--'} - {workshop.workingHoursEnd || '--'}
              </p>
            </div>
          )}

          {/* Notas */}
          {workshop.notes && (
            <div className="p-4 bg-yellow-50 rounded-xl">
              <h4 className="font-semibold text-black mb-2">Notas</h4>
              <p className="text-gray-600">{workshop.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Órdenes de Producción Asignadas */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <Package className="w-6 h-6 text-blue-500" />
            <span>Órdenes de Producción Asignadas</span>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-black">{order.productName}</h3>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getPriorityColor(order.priority)}`}>
                        {order.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">ID: {order.orderNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Cantidad: {order.quantity}</p>
                    {order.dueDate && (
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(order.dueDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Barra de Progreso */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progreso</span>
                    <span className="font-medium text-black">{order.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${order.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {orders.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No hay órdenes asignadas a este taller</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkshopDetails;
