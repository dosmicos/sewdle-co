import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Users, Package } from 'lucide-react';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { ShopifyOrdersTable } from '@/components/ShopifyOrdersTable';
import { CustomerAnalyticsTable } from '@/components/CustomerAnalyticsTable';
import { ProductAnalyticsTable } from '@/components/ProductAnalyticsTable';
import { ShopifyRealTimeStats } from '@/components/ShopifyRealTimeStats';

export const ShopifyDashboardPage: React.FC = () => {
  const {
    orders,
    customerAnalytics,
    productAnalytics,
    loading,
    ordersLoading,
    customersLoading,
    totalOrders,
    totalCustomers,
    fetchOrders,
    fetchCustomerAnalytics,
    refetch
  } = useShopifyOrders();
  
  const [ordersCurrentPage, setOrdersCurrentPage] = useState(1);
  const [customersCurrentPage, setCustomersCurrentPage] = useState(1);

  const handleOrdersPageChange = (page: number) => {
    setOrdersCurrentPage(page);
    const offset = (page - 1) * 50;
    fetchOrders(50, offset);
  };

  const handleCustomersPageChange = (page: number) => {
    setCustomersCurrentPage(page);
    const offset = (page - 1) * 50;
    fetchCustomerAnalytics(50, offset, undefined, undefined);
  };


  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Dashboard Shopify</h1>
          <p className="text-muted-foreground">
            Análisis automático con datos en tiempo real de Shopify
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <ShopifyRealTimeStats />

      {/* Main Content */}
      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
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
              <ShopifyOrdersTable 
                orders={orders} 
                loading={ordersLoading} 
                totalOrders={totalOrders}
                onPageChange={handleOrdersPageChange}
                currentPage={ordersCurrentPage}
              />
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
              <CustomerAnalyticsTable 
                customers={customerAnalytics} 
                loading={customersLoading} 
                totalCustomers={totalCustomers}
                onPageChange={handleCustomersPageChange}
                currentPage={customersCurrentPage}
              />
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

      </Tabs>
    </div>
  );
};