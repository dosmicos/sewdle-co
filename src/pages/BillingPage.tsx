import React from 'react';
import { OrganizationGuard } from '@/components/OrganizationGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Crown, Zap, Building2, Calendar, CreditCard, Download, RefreshCw } from 'lucide-react';

const BillingPage = () => {
  const { currentOrganization, getUsageStats } = useOrganization();

  const { data: usageStats, isLoading: statsLoading, refetch } = useQuery({
    queryKey: ['organization-stats', currentOrganization?.id],
    queryFn: getUsageStats,
    enabled: !!currentOrganization,
    refetchInterval: 5 * 60 * 1000,
  });

  const getUsagePercentage = (current: number, max: number): number => {
    if (max === -1) return 0; // Unlimited
    return Math.min((current / max) * 100, 100);
  };

  const getUsageColor = (percentage: number): 'destructive' | 'warning' | 'default' => {
    if (percentage >= 90) return 'destructive';
    if (percentage >= 75) return 'warning';
    return 'default';
  };

  const plans = [
    {
      name: 'Starter',
      price: '$29',
      period: '/mes',
      description: 'Perfecto para marcas emergentes',
      current: currentOrganization?.plan === 'starter',
      features: [
        'Hasta 7 usuarios',
        'Hasta 10 órdenes por mes',
        '5 talleres máximo',
        '1GB de almacenamiento',
        'Soporte por email'
      ]
    },
    {
      name: 'Professional',
      price: '$99',
      period: '/mes',
      description: 'Para marcas en crecimiento',
      current: currentOrganization?.plan === 'professional',
      popular: true,
      features: [
        'Hasta 22 usuarios',
        'Órdenes ilimitadas',
        '20 talleres máximo',
        '10GB de almacenamiento',
        'Analíticas avanzadas',
        'Integración Shopify',
        'Soporte prioritario'
      ]
    },
    {
      name: 'Enterprise',
      price: '$299',
      period: '/mes',
      description: 'Para marcas establecidas',
      current: currentOrganization?.plan === 'enterprise',
      features: [
        'Usuarios ilimitados',
        'Órdenes ilimitadas',
        'Talleres ilimitados',
        'Almacenamiento ilimitado',
        'API personalizada',
        'Soporte 24/7'
      ]
    }
  ];

  if (statsLoading || !currentOrganization) {
    return (
      <OrganizationGuard>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </OrganizationGuard>
    );
  }

  return (
    <OrganizationGuard>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Plan & Facturación</h1>
            <p className="text-muted-foreground">
              Gestiona tu plan de suscripción y facturación
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>

        <Tabs defaultValue="current-plan" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="current-plan">Mi Plan</TabsTrigger>
            <TabsTrigger value="change-plan">Cambiar Plan</TabsTrigger>
            <TabsTrigger value="billing">Facturación</TabsTrigger>
          </TabsList>

          <TabsContent value="current-plan" className="space-y-6">
            {/* Plan Actual */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-primary" />
                      Plan Actual
                    </CardTitle>
                    <CardDescription>
                      {currentOrganization.name} - Plan {currentOrganization.plan.charAt(0).toUpperCase() + currentOrganization.plan.slice(1)}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="text-sm">
                    Activo
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Stats de Uso */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Órdenes este mes</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {usageStats?.ordersThisMonth || 0}
                    {usageStats?.maxOrdersPerMonth !== -1 && (
                      <span className="text-sm text-muted-foreground ml-1">
                        / {usageStats?.maxOrdersPerMonth}
                      </span>
                    )}
                  </div>
                  {usageStats?.maxOrdersPerMonth !== -1 && (
                    <Progress 
                      value={getUsagePercentage(usageStats?.ordersThisMonth || 0, usageStats?.maxOrdersPerMonth || 1)} 
                      className="mt-2"
                    />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {usageStats?.maxOrdersPerMonth === -1 ? 'Ilimitadas' : 'Limite mensual'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {usageStats?.activeUsers || 0}
                    {usageStats?.maxUsers !== -1 && (
                      <span className="text-sm text-muted-foreground ml-1">
                        / {usageStats?.maxUsers}
                      </span>
                    )}
                  </div>
                  {usageStats?.maxUsers !== -1 && (
                    <Progress 
                      value={getUsagePercentage(usageStats?.activeUsers || 0, usageStats?.maxUsers || 1)} 
                      className="mt-2"
                    />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {usageStats?.maxUsers === -1 ? 'Ilimitados' : 'Usuarios máximos'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Talleres</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {usageStats?.workshopsCount || 0}
                    {usageStats?.maxWorkshops !== -1 && (
                      <span className="text-sm text-muted-foreground ml-1">
                        / {usageStats?.maxWorkshops}
                      </span>
                    )}
                  </div>
                  {usageStats?.maxWorkshops !== -1 && (
                    <Progress 
                      value={getUsagePercentage(usageStats?.workshopsCount || 0, usageStats?.maxWorkshops || 1)} 
                      className="mt-2"
                    />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {usageStats?.maxWorkshops === -1 ? 'Ilimitados' : 'Talleres máximos'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Almacenamiento</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {((usageStats?.storageUsed || 0) / 1024).toFixed(1)} GB
                    {usageStats?.maxStorage !== -1 && (
                      <span className="text-sm text-muted-foreground ml-1">
                        / {((usageStats?.maxStorage || 0) / 1024).toFixed(1)} GB
                      </span>
                    )}
                  </div>
                  {usageStats?.maxStorage !== -1 && (
                    <Progress 
                      value={getUsagePercentage(usageStats?.storageUsed || 0, usageStats?.maxStorage || 1)} 
                      className="mt-2"
                    />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {usageStats?.maxStorage === -1 ? 'Ilimitado' : 'Almacenamiento máximo'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="change-plan" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {plans.map((plan) => (
                <Card key={plan.name} className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        Más Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      {plan.current && (
                        <Badge variant="outline">Actual</Badge>
                      )}
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className="w-full" 
                      variant={plan.current ? "outline" : "default"}
                      disabled={plan.current}
                    >
                      {plan.current ? 'Plan Actual' : 'Seleccionar Plan'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Próxima Factura */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Próxima Factura
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">$99.00</p>
                    <p className="text-sm text-muted-foreground">
                      Se cobrará el 15 de febrero, 2024
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Método de Pago */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Método de Pago
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">•••• •••• •••• 4242</p>
                        <p className="text-sm text-muted-foreground">Expira 12/26</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Actualizar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Historial de Facturas */}
            <Card>
              <CardHeader>
                <CardTitle>Historial de Facturas</CardTitle>
                <CardDescription>
                  Descarga tus facturas anteriores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { date: '15 Ene 2024', amount: '$99.00', status: 'Pagada' },
                    { date: '15 Dic 2023', amount: '$99.00', status: 'Pagada' },
                    { date: '15 Nov 2023', amount: '$99.00', status: 'Pagada' },
                  ].map((invoice, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-sm">
                          <p className="font-medium">{invoice.date}</p>
                          <p className="text-muted-foreground">{invoice.amount}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-600">
                          {invoice.status}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </OrganizationGuard>
  );
};

export default BillingPage;