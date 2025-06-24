
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Package, TruckIcon, BarChart3, Activity } from 'lucide-react';
import MaterialsCatalog from '@/components/supplies/MaterialsCatalog';
import MaterialDelivery from '@/components/supplies/MaterialDelivery';
import SuppliesDashboard from '@/components/supplies/SuppliesDashboard';
import MaterialConsumptionManager from '@/components/supplies/MaterialConsumptionManager';
import MaterialForm from '@/components/supplies/MaterialForm';
import { useAuth } from '@/contexts/AuthContext';

const SuppliesPage = () => {
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const { hasPermission } = useAuth();

  const canCreateMaterials = hasPermission('insumos', 'create');
  const canCreateDeliveries = hasPermission('insumos', 'create');
  const canManageConsumption = hasPermission('insumos', 'edit');

  return (
    <>
      <div className="p-6 space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black">Gestión de Insumos</h1>
            <p className="text-gray-600">Administra materiales, entregas y consumo por taller</p>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="catalog" className="flex items-center space-x-2">
              <Package className="w-4 h-4" />
              <span>Catálogo</span>
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="flex items-center space-x-2">
              <TruckIcon className="w-4 h-4" />
              <span>Entregas</span>
            </TabsTrigger>
            <TabsTrigger value="consumption" className="flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <span>Consumo</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <SuppliesDashboard />
          </TabsContent>

          <TabsContent value="catalog">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-black">Catálogo de Materiales</h2>
                {canCreateMaterials && (
                  <Button 
                    onClick={() => setShowMaterialForm(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Material
                  </Button>
                )}
              </div>
              <MaterialsCatalog />
            </div>
          </TabsContent>

          <TabsContent value="deliveries">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-black">Registro de Entregas</h2>
              <MaterialDelivery canCreateDeliveries={canCreateDeliveries} />
            </div>
          </TabsContent>

          <TabsContent value="consumption">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-black">Gestión de Consumos</h2>
              {canManageConsumption ? (
                <MaterialConsumptionManager />
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Activity className="w-8 h-8 text-gray-600" />
                  </Activity>
                  <h3 className="text-lg font-semibold mb-2 text-black">Sin permisos para gestionar consumos</h3>
                  <p className="text-gray-600">
                    No tienes permisos para gestionar el consumo de materiales. Contacta al administrador.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {showMaterialForm && canCreateMaterials && (
        <MaterialForm onClose={() => setShowMaterialForm(false)} />
      )}
    </>
  );
};

export default SuppliesPage;
