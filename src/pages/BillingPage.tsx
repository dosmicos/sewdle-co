import React, { useState } from 'react';
import { OrganizationGuard } from '@/components/OrganizationGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Crown, Building2, Calendar, CreditCard, Download, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type BillingSummary = {
  subscription: {
    id: string;
    status: string;
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: boolean;
    currency: string;
    plan_name: string | null;
  } | null;
  upcoming_invoice: {
    amount_due: number;
    amount_remaining: number;
    currency: string;
    next_payment_attempt: number | null;
  } | null;
  payment_method: {
    type: string | null;
    card_brand: string | null;
    card_last4: string | null;
    card_exp_month: number | null;
    card_exp_year: number | null;
  } | null;
  invoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    amount_due: number;
    amount_paid: number;
    total: number;
    currency: string;
    created: number;
    hosted_invoice_url: string | null;
    invoice_pdf: string | null;
  }>;
};

const BillingPage = () => {
  const { currentOrganization, getUsageStats } = useOrganization();
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: usageStats, isLoading: statsLoading, refetch } = useQuery({
    queryKey: ['organization-stats', currentOrganization?.id],
    queryFn: getUsageStats,
    enabled: !!currentOrganization,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: billingSummary, isLoading: billingLoading, refetch: refetchBilling } = useQuery({
    queryKey: ['billing-summary', currentOrganization?.id],
    enabled: !!currentOrganization,
    queryFn: async (): Promise<BillingSummary> => {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { action: 'summary' }
      });

      if (error) throw error;
      return (data ?? { subscription: null, upcoming_invoice: null, payment_method: null, invoices: [] }) as BillingSummary;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const getUsagePercentage = (current: number, max: number): number => {
    if (max === -1) return 0; // Unlimited
    return Math.min((current / max) * 100, 100);
  };

  const openCustomerPortal = async () => {
    try {
      setPortalLoading(true);
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;

      if (!data?.url) {
        throw new Error('No se recibió URL del portal de facturación');
      }

      window.location.href = data.url;
    } catch (error: unknown) {
      console.error('Error opening customer portal:', error);
      const message = error instanceof Error ? error.message : 'No se pudo abrir el portal de facturación';
      toast.error(message);
    } finally {
      setPortalLoading(false);
    }
  };

  const formatCurrency = (amountCents: number | null | undefined, currency: string | null | undefined) => {
    if (amountCents == null) return 'No disponible';
    const code = (currency || 'USD').toUpperCase();
    try {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: code,
      }).format(amountCents / 100);
    } catch {
      return `${(amountCents / 100).toFixed(2)} ${code}`;
    }
  };

  const formatUnixDate = (unixSeconds: number | null | undefined) => {
    if (!unixSeconds) return 'No disponible';
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date(unixSeconds * 1000));
  };

  const humanInvoiceStatus = (status: string | null | undefined) => {
    switch (status) {
      case 'paid':
        return 'Pagada';
      case 'open':
        return 'Pendiente';
      case 'draft':
        return 'Borrador';
      case 'void':
        return 'Anulada';
      case 'uncollectible':
        return 'Incobrable';
      default:
        return status || 'Desconocido';
    }
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
      price: '$69',
      period: '/mes',
      description: 'Para marcas en crecimiento',
      current: currentOrganization?.plan === 'professional',
      popular: true,
      features: [
        'Hasta 22 usuarios',
        'Órdenes ilimitadas',
        '20 talleres máximo',
        'Integración completa Shopify',
        'Analíticas avanzadas',
        'Soporte prioritario'
      ]
    },
    {
      name: 'Enterprise',
      price: '$190',
      period: '/mes',
      description: 'Para marcas establecidas',
      current: currentOrganization?.plan === 'enterprise',
      features: [
        'Todo ilimitado',
        'Usuarios ilimitados',
        'White-label disponible',
        'API personalizada',
        'Gerente de cuenta dedicado',
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
          <Button onClick={() => { refetch(); refetchBilling(); }} variant="outline" size="sm">
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
                  <div className="space-y-3">
                    {billingLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : (
                      <>
                        <p className="text-2xl font-bold">
                          {formatCurrency(
                            billingSummary?.upcoming_invoice?.amount_due ?? billingSummary?.invoices?.[0]?.amount_due,
                            billingSummary?.upcoming_invoice?.currency ?? billingSummary?.invoices?.[0]?.currency
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Próximo cobro: {formatUnixDate(
                            billingSummary?.upcoming_invoice?.next_payment_attempt ??
                            billingSummary?.subscription?.current_period_end
                          )}
                        </p>
                      </>
                    )}
                    <Button onClick={openCustomerPortal} disabled={portalLoading} className="w-full">
                      {portalLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Abriendo portal...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Ver Próxima Factura
                        </>
                      )}
                    </Button>
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
                  <div className="space-y-3">
                    {billingLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : billingSummary?.payment_method?.card_last4 ? (
                      <div>
                        <p className="font-medium">
                          {billingSummary.payment_method.card_brand?.toUpperCase()} •••• {billingSummary.payment_method.card_last4}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Expira {billingSummary.payment_method.card_exp_month}/{billingSummary.payment_method.card_exp_year}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No hay método de pago disponible en Stripe para este cliente.
                      </p>
                    )}
                    <Button onClick={openCustomerPortal} disabled={portalLoading} variant="outline" className="w-full">
                      {portalLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Abriendo portal...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Actualizar Método de Pago
                        </>
                      )}
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
                  Facturas reales desde Stripe.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {billingLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : billingSummary?.invoices?.length ? (
                  <div className="space-y-3">
                    {billingSummary.invoices.map((invoice) => {
                      const url = invoice.invoice_pdf || invoice.hosted_invoice_url;
                      return (
                        <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="text-sm">
                            <p className="font-medium">{invoice.number || invoice.id}</p>
                            <p className="text-muted-foreground">
                              {formatUnixDate(invoice.created)} • {formatCurrency(invoice.amount_paid || invoice.total, invoice.currency)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{humanInvoiceStatus(invoice.status)}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!url}
                              onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">No hay facturas disponibles todavía.</p>
                    <Button onClick={openCustomerPortal} disabled={portalLoading} variant="outline">
                      {portalLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Abriendo portal...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Ver Historial en Stripe
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </OrganizationGuard>
  );
};

export default BillingPage;
