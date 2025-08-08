import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialConsumptionManager } from '@/components/supplies/MaterialConsumptionManager';
import { MaterialConsumptionDuplicationFixer } from '@/components/supplies/MaterialConsumptionDuplicationFixer';

export const MaterialConsumptionManagementPage: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Consumos de Materiales</h1>
        <p className="text-muted-foreground">
          Administra y supervisa el consumo de materiales en las órdenes de producción
        </p>
      </div>

      <Tabs defaultValue="consumptions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="consumptions">Consumos</TabsTrigger>
          <TabsTrigger value="duplicates">Corrector de Duplicados</TabsTrigger>
        </TabsList>

        <TabsContent value="consumptions">
          <MaterialConsumptionManager />
        </TabsContent>

        <TabsContent value="duplicates">
          <MaterialConsumptionDuplicationFixer />
        </TabsContent>
      </Tabs>
    </div>
  );
};