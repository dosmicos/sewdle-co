
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Package, RefreshCw } from 'lucide-react';
import { ReplenishmentSuggestions } from '@/components/supplies/ReplenishmentSuggestions';
import { ShopifySyncManager } from '@/components/supplies/ShopifySyncManager';

export const ReplenishmentPage: React.FC = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Gestión de Reposición</h1>
          <p className="text-gray-600">
            Analiza las ventas y gestiona las sugerencias de reposición inteligente
          </p>
        </div>
      </div>

      <Tabs defaultValue="suggestions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="suggestions" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Sugerencias de Reposición
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sincronización Shopify
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle>Sugerencias Inteligentes de Reposición</CardTitle>
              <CardDescription>
                Basado en análisis de ventas, stock actual y demanda proyectada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReplenishmentSuggestions />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <ShopifySyncManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};
