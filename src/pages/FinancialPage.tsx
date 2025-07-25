import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, Receipt, PiggyBank } from 'lucide-react';
import { WorkshopPricingManager } from '@/components/financial/WorkshopPricingManager';
import { DeliveryPaymentsList } from '@/components/financial/DeliveryPaymentsList';
import { OrderAdvancesManager } from '@/components/financial/OrderAdvancesManager';
import { useFinancialSummary } from '@/hooks/useFinancialSummary';

const FinancialPage = () => {
  const [activeTab, setActiveTab] = useState('payments');
  const { summary, loading } = useFinancialSummary();
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('COP', 'COP $');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Módulo Financiero</h1>
          <p className="text-muted-foreground">
            Gestiona pagos, precios y finanzas del sistema
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? 'Cargando...' : formatCurrency(summary.pendingPayments)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pagos pendientes de entregas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Realizados</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? 'Cargando...' : formatCurrency(summary.completedPayments)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pagos completados este período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anticipos</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? 'Cargando...' : formatCurrency(summary.totalAdvances)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total en anticipos de órdenes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? 'Cargando...' : summary.totalDeliveries}
            </div>
            <p className="text-xs text-muted-foreground">
              Total de entregas registradas
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="payments">Pagos de Entregas</TabsTrigger>
          <TabsTrigger value="pricing">Precios por Taller</TabsTrigger>
          <TabsTrigger value="advances">Anticipos de Órdenes</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-6">
          <DeliveryPaymentsList />
        </TabsContent>

        <TabsContent value="pricing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Precios por Taller</CardTitle>
              <CardDescription>
                Configura los precios que se pagan a cada taller por producto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkshopPricingManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advances" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Anticipos de Órdenes</CardTitle>
              <CardDescription>
                Gestiona los anticipos pagados a talleres por órdenes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrderAdvancesManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinancialPage;