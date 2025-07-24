import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShopifySyncManager } from '@/components/supplies/ShopifySyncManager';
import { ShopifySyncDiagnostics } from '@/components/supplies/ShopifySyncDiagnostics';
import ShopifyDiagnosticTool from '@/components/supplies/ShopifyDiagnosticTool';
import { SuppliesDashboard } from '@/components/supplies/SuppliesDashboard';
import { MaterialsCatalog } from '@/components/supplies/MaterialsCatalog';
import { MaterialDelivery } from '@/components/supplies/MaterialDelivery';
import { MaterialConsumptionManager } from '@/components/supplies/MaterialConsumptionManager';
import { ReplenishmentSuggestions } from '@/components/supplies/ReplenishmentSuggestions';
import { InventorySyncManager } from '@/components/supplies/InventorySyncManager';

const SuppliesPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestión de Suministros</h1>
        <p className="text-gray-600">
          Administra materiales, entregas, consumos y sincronización con Shopify
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="materials">Materiales</TabsTrigger>
          <TabsTrigger value="deliveries">Entregas</TabsTrigger>
          <TabsTrigger value="consumption">Consumos</TabsTrigger>
          <TabsTrigger value="replenishment">Reposición</TabsTrigger>
          <TabsTrigger value="sync-sales">Sync Ventas</TabsTrigger>
          <TabsTrigger value="sync-inventory">Sync Inventario</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnóstico</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <SuppliesDashboard />
        </TabsContent>

        <TabsContent value="materials" className="space-y-6">
          <MaterialsCatalog />
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-6">
          <MaterialDelivery />
        </TabsContent>

        <TabsContent value="consumption" className="space-y-6">
          <MaterialConsumptionManager />
        </TabsContent>

        <TabsContent value="replenishment" className="space-y-6">
          <ReplenishmentSuggestions />
        </TabsContent>

        <TabsContent value="sync-sales" className="space-y-6">
          <ShopifySyncManager />
        </TabsContent>

        <TabsContent value="sync-inventory" className="space-y-6">
          <InventorySyncManager />
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-6">
          <div className="space-y-6">
            <ShopifyDiagnosticTool />
            <ShopifySyncDiagnostics />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SuppliesPage;
