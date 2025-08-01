import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SuppliesDashboard from '@/components/supplies/SuppliesDashboard';
import MaterialsCatalog from '@/components/supplies/MaterialsCatalog';
import MaterialDelivery from '@/components/supplies/MaterialDelivery';
import MaterialConsumptionManager from '@/components/supplies/MaterialConsumptionManager';
import { useAuth } from '@/contexts/AuthContext';

const SuppliesPage = () => {
  const { hasPermission } = useAuth();
  
  // Verificar permisos para entregas
  const canCreateDeliveries = hasPermission('insumos', 'create') || 
                              hasPermission('insumos', 'edit') || 
                              hasPermission('insumos', 'delete');
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestión de Suministros</h1>
        <p className="text-gray-600">
          Administra materiales, entregas, consumos y sincronización con Shopify
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="materials">Materiales</TabsTrigger>
          <TabsTrigger value="deliveries">Entregas</TabsTrigger>
          <TabsTrigger value="consumption">Consumos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <SuppliesDashboard />
        </TabsContent>

        <TabsContent value="materials" className="space-y-6">
          <MaterialsCatalog />
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-6">
          <MaterialDelivery canCreateDeliveries={canCreateDeliveries} />
        </TabsContent>

        <TabsContent value="consumption" className="space-y-6">
          <MaterialConsumptionManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SuppliesPage;
