
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Users, BarChart3 } from 'lucide-react';
import OrderForm from '@/components/OrderForm';
import WorkshopAssignmentForm from '@/components/WorkshopAssignmentForm';
import WorkshopAssignmentsList from '@/components/WorkshopAssignmentsList';
import WorkshopCapacityDashboard from '@/components/WorkshopCapacityDashboard';

const OrdersPage = () => {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);

  return (
    <>
      <div className="p-6 space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black">Gestión de Órdenes</h1>
            <p className="text-gray-600">Gestiona órdenes de producción y asignaciones de trabajo</p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={() => setShowAssignmentForm(true)}
              variant="outline"
              className="border border-gray-300 bg-white hover:bg-gray-50 text-black font-medium rounded-xl px-6 py-3"
            >
              <Users className="w-4 h-4 mr-2" />
              Asignar a Taller
            </Button>
            <Button 
              onClick={() => setShowOrderForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Orden
            </Button>
          </div>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="orders">Órdenes de Producción</TabsTrigger>
            <TabsTrigger value="assignments">Asignaciones de Trabajo</TabsTrigger>
            <TabsTrigger value="capacity">Capacidad de Talleres</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-6">
            <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="Buscar órdenes..." 
                    className="w-full bg-white border border-gray-300 rounded-xl text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:ring-offset-0 transition-all duration-200"
                    style={{ paddingLeft: '2.5rem', paddingRight: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                </div>
              </div>

              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-black">No hay órdenes aún</h3>
                <p className="text-gray-600 mb-4">Comienza creando tu primera orden de producción</p>
                <Button 
                  onClick={() => setShowOrderForm(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primera Orden
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-6">
            <WorkshopAssignmentsList />
          </TabsContent>

          <TabsContent value="capacity" className="space-y-6">
            <WorkshopCapacityDashboard />
          </TabsContent>
        </Tabs>
      </div>

      {showOrderForm && (
        <OrderForm onClose={() => setShowOrderForm(false)} />
      )}

      {showAssignmentForm && (
        <WorkshopAssignmentForm 
          open={showAssignmentForm} 
          onClose={() => setShowAssignmentForm(false)} 
        />
      )}
    </>
  );
};

export default OrdersPage;
