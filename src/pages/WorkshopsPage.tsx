
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building2, Star, Calendar, ArrowLeft } from 'lucide-react';
import WorkshopForm from '@/components/WorkshopForm';

const WorkshopsPage = () => {
  const [showForm, setShowForm] = useState(false);

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

  if (showForm) {
    return (
      <div className="animate-fade-in">
        <div className="p-6 mb-6">
          <Button 
            onClick={() => setShowForm(false)}
            variant="outline"
            className="border border-gray-300 bg-white hover:bg-gray-50 text-black rounded-xl px-4 py-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Talleres
          </Button>
        </div>
        <WorkshopForm />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">Talleres</h1>
          <p className="text-gray-600">Gestiona y supervisa todos los talleres</p>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Taller
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockWorkshops.map((workshop) => (
          <Card key={workshop.id} className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 hover:shadow-lg transition-shadow duration-200">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-black">{workshop.name}</h3>
                    <p className="text-sm text-gray-600">{workshop.email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">{workshop.address}</p>
                <p className="text-sm text-gray-600">{workshop.phone}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-lg font-bold text-black">{workshop.activeOrders}</p>
                  <p className="text-xs text-gray-600">Órdenes Activas</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-lg font-bold text-black">{workshop.completionRate}%</p>
                  <p className="text-xs text-gray-600">Finalización</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-1 text-gray-700">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span>Calidad</span>
                  </span>
                  <span className="font-medium text-black">{workshop.qualityScore}/5</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-1 text-gray-700">
                    <Calendar className="w-4 h-4 text-green-500" />
                    <span>Puntualidad</span>
                  </span>
                  <span className="font-medium text-black">{workshop.onTimeDelivery}%</span>
                </div>
              </div>

              <Button variant="outline" className="w-full border border-gray-300 bg-white hover:bg-gray-50 text-black rounded-xl py-2">
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
