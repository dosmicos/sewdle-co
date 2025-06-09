
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building2, Star, Calendar } from 'lucide-react';

const WorkshopsPage = () => {
  const mockWorkshops = [
    {
      id: 1,
      name: 'Taller Principal',
      address: 'Av. Industrial 123, Lima',
      phone: '+51 999 888 777',
      email: 'taller1@ejemplo.com',
      activeOrders: 5,
      completionRate: 95,
      qualityScore: 4.8,
      onTimeDelivery: 92
    },
    {
      id: 2,
      name: 'Taller Norte',
      address: 'Jr. Los Confeccionistas 456, Lima',
      phone: '+51 988 777 666',
      email: 'tallernorte@ejemplo.com',
      activeOrders: 3,
      completionRate: 88,
      qualityScore: 4.6,
      onTimeDelivery: 85
    }
  ];

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Talleres</h1>
          <p className="text-muted-foreground">Gestiona y supervisa todos los talleres</p>
        </div>
        <Button className="apple-button">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Taller
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockWorkshops.map((workshop) => (
          <Card key={workshop.id} className="apple-card p-6 hover:shadow-lg transition-shadow duration-200">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{workshop.name}</h3>
                    <p className="text-sm text-muted-foreground">{workshop.email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{workshop.address}</p>
                <p className="text-sm text-muted-foreground">{workshop.phone}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted/30 rounded-xl">
                  <p className="text-lg font-bold">{workshop.activeOrders}</p>
                  <p className="text-xs text-muted-foreground">Órdenes Activas</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-xl">
                  <p className="text-lg font-bold">{workshop.completionRate}%</p>
                  <p className="text-xs text-muted-foreground">Finalización</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span>Calidad</span>
                  </span>
                  <span className="font-medium">{workshop.qualityScore}/5</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4 text-green-500" />
                    <span>Puntualidad</span>
                  </span>
                  <span className="font-medium">{workshop.onTimeDelivery}%</span>
                </div>
              </div>

              <Button variant="outline" className="w-full">
                Ver Detalles
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default WorkshopsPage;
