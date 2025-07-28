import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Users, Package, RefreshCw, Calendar, Webhook } from 'lucide-react';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { ShopifyOrdersTable } from '@/components/ShopifyOrdersTable';
import { CustomerAnalyticsTable } from '@/components/CustomerAnalyticsTable';
import { ProductAnalyticsTable } from '@/components/ProductAnalyticsTable';
import { ShopifyDashboardStats } from '@/components/ShopifyDashboardStats';
import { ShopifyWebhookConfig } from '@/components/ShopifyWebhookConfig';
import { WebhookStatusIndicator } from '@/components/WebhookStatusIndicator';
import { ShopifyRealTimeStats } from '@/components/ShopifyRealTimeStats';
import { useShopifySync } from '@/hooks/useShopifySync';

export const ShopifyDashboardPage: React.FC = () => {
  const {
    orders,
    customerAnalytics,
    productAnalytics,
    loading,
    refetch
  } = useShopifyOrders();

  const { triggerSync, loading: syncLoading } = useShopifySync();
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const handleSync = async () => {
    try {
      await triggerSync('daily', 30);
      setLastSyncTime(new Date());
      // Refetch data after sync
      setTimeout(() => {
        refetch();
      }, 2000);
    } catch (error) {
      console.error('Error during sync:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Dashboard Shopify</h1>
            <p className="text-gray-600">
              Análisis completo de órdenes, clientes y productos de Shopify
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {lastSyncTime && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Última sincronización: {lastSyncTime.toLocaleString()}
            </div>
          )}
          <Button 
            onClick={handleSync} 
            disabled={syncLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncLoading ? 'animate-spin' : ''}`} />
            {syncLoading ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <ShopifyDashboardStats 
            orders={orders}
            customerAnalytics={customerAnalytics}
            productAnalytics={productAnalytics}
          />
        </div>
        <div>
          <ShopifyRealTimeStats />
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Órdenes
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="webhook" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Configuración
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes de Shopify</CardTitle>
              <CardDescription>
                Listado completo de órdenes sincronizadas desde Shopify con información detallada de clientes y estados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShopifyOrdersTable orders={orders} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Clientes</CardTitle>
              <CardDescription>
                Segmentación de clientes basada en comportamiento de compra, lifetime value y frecuencia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomerAnalyticsTable customers={customerAnalytics} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Productos</CardTitle>
              <CardDescription>
                Rendimiento de productos por ventas, ingresos y popularidad entre clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProductAnalyticsTable products={productAnalytics} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhook" className="space-y-6">
          <WebhookStatusIndicator />
          <ShopifyWebhookConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
};