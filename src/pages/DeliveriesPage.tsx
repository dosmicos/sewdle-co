
import React, { useState } from 'react';
import { useFilteredDeliveries } from '@/hooks/useFilteredDeliveries';
import { useUserContext } from '@/hooks/useUserContext';
import DeliveryForm from '@/components/DeliveryForm';
import DeliveryDetails from '@/components/DeliveryDetails';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Truck, Calendar, MapPin, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const DeliveriesPage = () => {
  const { deliveries, loading } = useFilteredDeliveries();
  const { isAdmin } = useUserContext();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);

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

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">
            {isAdmin ? 'Gestión de Entregas' : 'Mis Entregas'}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Administra todas las entregas del sistema' : 'Entregas de tu taller'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Entrega
          </Button>
        )}
      </div>

      {showCreateForm && isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nueva Entrega</CardTitle>
            <CardDescription>Registra una nueva entrega</CardDescription>
          </CardHeader>
          <CardContent>
            <DeliveryForm onSuccess={() => setShowCreateForm(false)} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {deliveries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {isAdmin ? 'No hay entregas' : 'No tienes entregas'}
              </h3>
              <p className="text-muted-foreground">
                {isAdmin 
                  ? 'Cuando se registren entregas, aparecerán aquí.'
                  : 'Cuando tengas entregas registradas, aparecerán aquí.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          deliveries.map((delivery) => (
            <Card key={delivery.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{delivery.tracking_number}</h3>
                    <p className="text-muted-foreground">{delivery.order_number}</p>
                  </div>
                  <Badge className={getStatusColor(delivery.status)}>
                    {getStatusText(delivery.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2" />
                    {delivery.delivery_date ? format(new Date(delivery.delivery_date), 'dd/MM/yyyy', { locale: es }) : 'Sin fecha'}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2" />
                    {delivery.workshop_name || 'Sin taller'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Items: {delivery.items_count || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Cantidad: {delivery.total_quantity || 0}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedDelivery(delivery)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Detalles
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedDelivery && (
        <DeliveryDetails
          delivery={selectedDelivery}
          isOpen={!!selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
        />
      )}
    </div>
  );
};

export default DeliveriesPage;
