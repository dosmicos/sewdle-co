
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';

const OrdersPage = () => {
  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">Órdenes de Producción</h1>
          <p className="text-gray-600">Gestiona todas las órdenes de producción</p>
        </div>
        <Button className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Orden
        </Button>
      </div>

      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar órdenes..." 
              className="w-full pl-10 bg-white border border-gray-300 rounded-xl px-4 py-3 text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:ring-offset-0 transition-all duration-200" 
            />
          </div>
        </div>

        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-black">No hay órdenes aún</h3>
          <p className="text-gray-600 mb-4">Comienza creando tu primera orden de producción</p>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]">
            <Plus className="w-4 h-4 mr-2" />
            Crear Primera Orden
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default OrdersPage;
