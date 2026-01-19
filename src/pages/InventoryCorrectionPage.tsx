import React from 'react';
import { InventoryCorrectionTool } from '@/components/supplies/InventoryCorrectionTool';
import { OrderDuplicationFixer } from '@/components/OrderDuplicationFixer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const InventoryCorrectionPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Herramientas de Corrección</h1>
        <p className="text-muted-foreground mt-2">
          Detecta y corrige problemas de datos en el sistema
        </p>
      </div>
      
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="inventory">Inventario Shopify</TabsTrigger>
          <TabsTrigger value="orders">Duplicados en Órdenes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="inventory">
          <InventoryCorrectionTool />
        </TabsContent>
        
        <TabsContent value="orders">
          <OrderDuplicationFixer />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventoryCorrectionPage;