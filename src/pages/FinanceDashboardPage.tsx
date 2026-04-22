import React, { useState, useEffect } from 'react';
import { RefreshCw, Loader2, Settings, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import FinanceDatePicker from '@/components/finance-dashboard/FinanceDatePicker';
import AttributionTable, { type AttributionRow } from '@/components/finance-dashboard/AttributionTable';
import MetaAdsConnectionModal from '@/components/finance-dashboard/MetaAdsConnectionModal';
import GoogleAdsConnectionModal from '@/components/finance-dashboard/GoogleAdsConnectionModal';
import FinanceSettingsModal from '@/components/finance-dashboard/FinanceSettingsModal';
import ContributionMarginCard from '@/components/finance-dashboard/ContributionMarginCard';
import ContributionMarginBreakdown from '@/components/finance-dashboard/ContributionMarginBreakdown';
import FourQuarterChart from '@/components/finance-dashboard/FourQuarterChart';
import BusinessMetricsRow from '@/components/finance-dashboard/BusinessMetricsRow';
import CustomerHealthSection from '@/components/finance-dashboard/CustomerHealthSection';
import ForecastChart from '@/components/finance-dashboard/ForecastChart';
import AdSpendPaceChart from '@/components/finance-dashboard/AdSpendPaceChart';
import PaymentGatewayChart from '@/components/finance-dashboard/PaymentGatewayChart';
import { useFinanceDateRange } from '@/hooks/useFinanceDateRange';
import { useStoreMetrics } from '@/hooks/useStoreMetrics';
import { useAdMetrics } from '@/hooks/useAdMetrics';
import { useMetaAdsConnection } from '@/hooks/useMetaAdsConnection';
import { useGoogleAdsConnection } from '@/hooks/useGoogleAdsConnection';
import { useFinanceSettings } from '@/hooks/useFinanceSettings';
import { useMonthlyTargets } from '@/hooks/useMonthlyTargets';
import { useProphitMetrics } from '@/hooks/useProphitMetrics';
import { useCustomerHealth } from '@/hooks/useCustomerHealth';
import { usePaymentGatewayBreakdown } from '@/hooks/usePaymentGatewayBreakdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { toast } from 'sonner';

const formatCOP = (amount: number) => {
  return `COP ${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount))}`;
};

const MetaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" fill="#1877F2"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FinanceDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const dateRange = useFinanceDateRange();
  const storeMetrics = useStoreMetrics(dateRange.current, dateRange.previous);
  const metaAds = useAdMetrics(dateRange.current, dateRange.previous, 'meta');
  const googleAds = useAdMetrics(dateRange.current, dateRange.previous, 'google_ads');
  const metaConnection = useMetaAdsConnection();
  const googleConnection = useGoogleAdsConnection();
  const financeSettings = useFinanceSettings();
  const monthlyTargets = useMonthlyTargets(dateRange.current.start);
  // Prophit metrics (Contribution Margin + pacing + COGS + fees + MER/AMER)
  // come from the server-side `prophit-metrics` Edge Function so the dashboard
  // and the Growth Manager agent share the same numbers.
  const prophitMetrics = useProphitMetrics(dateRange.current, dateRange.previous);

  // Combine Meta + Google Ads into a single AdMetricsResult for Contribution Margin
  const combinedAdMetrics = React.useMemo(() => ({
    current: {
      spend: metaAds.current.spend + googleAds.current.spend,
      impressions: metaAds.current.impressions + googleAds.current.impressions,
      clicks: metaAds.current.clicks + googleAds.current.clicks,
      conversions: metaAds.current.conversions + googleAds.current.conversions,
      conversionValue: metaAds.current.conversionValue + googleAds.current.conversionValue,
      purchases: metaAds.current.purchases + googleAds.current.purchases,
      cpc: (metaAds.current.clicks + googleAds.current.clicks) > 0
        ? (metaAds.current.spend + googleAds.current.spend) / (metaAds.current.clicks + googleAds.current.clicks)
        : 0,
      cpm: (metaAds.current.impressions + googleAds.current.impressions) > 0
        ? ((metaAds.current.spend + googleAds.current.spend) / (metaAds.current.impressions + googleAds.current.impressions)) * 1000
        : 0,
      ctr: (metaAds.current.impressions + googleAds.current.impressions) > 0
        ? ((metaAds.current.clicks + googleAds.current.clicks) / (metaAds.current.impressions + googleAds.current.impressions)) * 100
        : 0,
      roas: (metaAds.current.spend + googleAds.current.spend) > 0
        ? (metaAds.current.conversionValue + googleAds.current.conversionValue) / (metaAds.current.spend + googleAds.current.spend)
        : 0,
      cpa: (metaAds.current.purchases + googleAds.current.purchases) > 0
        ? (metaAds.current.spend + googleAds.current.spend) / (metaAds.current.purchases + googleAds.current.purchases)
        : 0,
      dailyData: (() => {
        const map = new Map<string, { spend: number; roas: number; purchases: number }>();
        for (const d of metaAds.current.dailyData) {
          map.set(d.date, { spend: d.spend, roas: 0, purchases: d.purchases });
        }
        for (const d of googleAds.current.dailyData) {
          const existing = map.get(d.date);
          if (existing) {
            existing.spend += d.spend;
            existing.purchases += d.purchases;
          } else {
            map.set(d.date, { spend: d.spend, roas: 0, purchases: d.purchases });
          }
        }
        return Array.from(map.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, vals]) => ({ date, ...vals }));
      })(),
    },
    previous: {
      spend: metaAds.previous.spend + googleAds.previous.spend,
      impressions: metaAds.previous.impressions + googleAds.previous.impressions,
      clicks: metaAds.previous.clicks + googleAds.previous.clicks,
      conversions: metaAds.previous.conversions + googleAds.previous.conversions,
      conversionValue: metaAds.previous.conversionValue + googleAds.previous.conversionValue,
      purchases: metaAds.previous.purchases + googleAds.previous.purchases,
      cpc: 0,
      cpm: 0,
      ctr: 0,
      roas: 0,
      cpa: 0,
      dailyData: [],
    },
    changes: {} as Record<string, number>,
    isLoading: metaAds.isLoading || googleAds.isLoading,
  }), [metaAds, googleAds]);

  // CM + all derived metrics now come from the server-side Edge Function
  // (single source of truth shared with the Growth Manager).
  const cmData = prophitMetrics.current;

  const customerHealth = useCustomerHealth(
    storeMetrics.current.newCustomerRevenue,
    storeMetrics.current.returningCustomerRevenue,
    storeMetrics.current.newCustomerOrders,
    storeMetrics.current.orders,
    combinedAdMetrics.current.spend
  );

  const paymentGatewayBreakdown = usePaymentGatewayBreakdown(dateRange.current);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [channelMetricsOpen, setChannelMetricsOpen] = useState(false);

  // Auto-open modals if returning from OAuth callback
  useEffect(() => {
    if (sessionStorage.getItem('meta_oauth_result')) {
      setMetaModalOpen(true);
    }
    if (sessionStorage.getItem('google_ads_oauth_result')) {
      setGoogleModalOpen(true);
    }
  }, []);

  // Attribution rows
  const attributionRows: AttributionRow[] = [
    {
      source: 'Meta',
      icon: <MetaIcon />,
      budget: null,
      spend: metaAds.current.spend,
      cv: metaAds.current.conversionValue,
      roas: metaAds.current.roas,
      clicks: metaAds.current.clicks,
      impressions: metaAds.current.impressions,
    },
    {
      source: 'Google Ads',
      icon: <GoogleIcon />,
      budget: null,
      spend: googleAds.current.spend,
      cv: googleAds.current.conversionValue,
      roas: googleAds.current.roas,
      clicks: googleAds.current.clicks,
      impressions: googleAds.current.impressions,
    },
  ];

  const handleSync = async () => {
    const startStr = format(dateRange.current.start, 'yyyy-MM-dd');
    const endStr = format(dateRange.current.end, 'yyyy-MM-dd');
    const promises: Promise<boolean>[] = [];
    if (metaConnection.isConnected) {
      promises.push(metaConnection.syncMetrics(startStr, endStr));
    }
    if (googleConnection.isConnected) {
      promises.push(googleConnection.syncMetrics(startStr, endStr));
    }
    try {
      await Promise.all(promises);
      toast.success('Sincronización completada');
    } catch (err) {
      toast.error('Error en la sincronización');
    }
  };

  if (storeMetrics.isLoading || prophitMetrics.isLoading) {
    return (
      <FinanceDashboardLayout onOpenSettings={() => setSettingsOpen(true)}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </FinanceDashboardLayout>
    );
  }

  const anyError = storeMetrics.error || prophitMetrics.error;
  if (anyError) {
    return (
      <FinanceDashboardLayout onOpenSettings={() => setSettingsOpen(true)}>
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <p className="text-red-500 text-lg font-medium">Error al cargar los datos</p>
          <p className="text-gray-500 text-sm">{String(anyError)}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </FinanceDashboardLayout>
    );
  }

  return (
    <FinanceDashboardLayout onOpenSettings={() => setSettingsOpen(true)}>
      <div className="p-6 max-w-[1400px] mx-auto space-y-8">
        {/* ===================== HEADER ===================== */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 pl-10 md:pl-0">
            <h1 className="text-xl font-bold text-gray-900">Prophit Dashboard</h1>
            <FinanceDatePicker dateRange={dateRange} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {metaConnection.isConnected ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={metaConnection.syncing}
                >
                  {metaConnection.syncing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Sync Meta
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMetaModalOpen(true)}
                  className="px-2"
                  title="Configurar Meta Ads"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
                onClick={() => setMetaModalOpen(true)}
              >
                <MetaIcon />
                <span className="ml-1.5">Conectar Meta</span>
              </Button>
            )}
            {googleConnection.isConnected ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const startStr = format(dateRange.current.start, 'yyyy-MM-dd');
                    const endStr = format(dateRange.current.end, 'yyyy-MM-dd');
                    await googleConnection.syncMetrics(startStr, endStr);
                  }}
                  disabled={googleConnection.syncing}
                >
                  {googleConnection.syncing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Sync Google
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGoogleModalOpen(true)}
                  className="px-2"
                  title="Configurar Google Ads"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGoogleModalOpen(true)}
              >
                <GoogleIcon />
                <span className="ml-1.5">Conectar Google</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Settings
            </Button>
          </div>
        </div>

        {/* ========== SECTION 1: THE SCOREBOARD ========== */}
        <section className="space-y-4">
          <ContributionMarginCard data={cmData} formatCOP={formatCOP} />
          <ContributionMarginBreakdown
            data={cmData}
            targetPercents={{
              cogs: financeSettings.settings?.cogs_percent ?? 20,
              shipping: financeSettings.settings?.shipping_cost_percent ?? 10,
              gateway: financeSettings.settings?.payment_gateway_percent ?? 3.5,
              handling: financeSettings.settings?.handling_cost_percent ?? 2,
              adSpend: 30,
            }}
            formatCOP={formatCOP}
          />
          <ForecastChart
            cmData={cmData}
            target={monthlyTargets.target}
            formatCOP={formatCOP}
          />
          <AdSpendPaceChart
            cmData={cmData}
            target={monthlyTargets.target}
            formatCOP={formatCOP}
          />
        </section>

        {/* ========== SECTION 2: FOUR QUARTER VIEW ========== */}
        <section>
          <FourQuarterChart data={cmData} formatCOP={formatCOP} />
        </section>

        {/* ========== SECTION 3: BUSINESS METRICS ========== */}
        <section>
          <BusinessMetricsRow
            cmData={cmData}
            storeMetrics={storeMetrics}
            adMetrics={combinedAdMetrics}
            formatCOP={formatCOP}
          />
        </section>

        {/* ========== SECTION 4: CUSTOMER HEALTH ========== */}
        <section>
          <CustomerHealthSection
            data={customerHealth.data}
            isLoading={customerHealth.isLoading}
            formatCOP={formatCOP}
          />
        </section>

        {/* ========== SECTION 4.5: PAYMENT GATEWAYS ========== */}
        <section>
          <PaymentGatewayChart
            rows={paymentGatewayBreakdown.rows}
            totalOrders={paymentGatewayBreakdown.totalOrders}
            totalRevenue={paymentGatewayBreakdown.totalRevenue}
            isLoading={paymentGatewayBreakdown.isLoading}
            formatCOP={formatCOP}
          />
        </section>

        {/* ========== SECTION 5: CHANNEL METRICS (Contexto) ========== */}
        <section>
          <Collapsible open={channelMetricsOpen} onOpenChange={setChannelMetricsOpen}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 group cursor-pointer">
                    {channelMetricsOpen
                      ? <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                      : <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                    }
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider group-hover:text-gray-700">
                      Channel Metrics (Contexto)
                    </h3>
                    {metaConnection.isConnected && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                        Meta conectado
                      </Badge>
                    )}
                  </button>
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700"
                  onClick={() => navigate('/ad-performance')}
                >
                  Ver detalle
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <p className="text-xs text-gray-400 italic ml-6">
                Channel ROAS es contexto, no driver de decisiones. Usa CM y MER para gobernar.
              </p>
            </div>
            <CollapsibleContent className="mt-4 space-y-4">
              <AttributionTable rows={attributionRows} formatCurrency={formatCOP} />
              {!metaConnection.isConnected && (
                <Card className="border-dashed border-blue-200 bg-blue-50/50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Meta Ads no conectado</p>
                      <p className="text-xs text-blue-700 mt-0.5">Conecta tu cuenta para ver metricas reales de ads</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
                      onClick={() => setMetaModalOpen(true)}
                    >
                      Conectar
                    </Button>
                  </CardContent>
                </Card>
              )}
            </CollapsibleContent>
          </Collapsible>
        </section>
      </div>

      {/* Modals */}
      <FinanceSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={financeSettings.settings}
        target={monthlyTargets.target}
        onSaveSettings={financeSettings.updateSettings}
        onSaveTarget={monthlyTargets.upsertTarget}
        isUpdating={financeSettings.isUpdating}
        isUpserting={monthlyTargets.isUpserting}
      />
      <MetaAdsConnectionModal
        open={metaModalOpen}
        onOpenChange={setMetaModalOpen}
        onSuccess={() => setMetaModalOpen(false)}
      />
      <GoogleAdsConnectionModal
        open={googleModalOpen}
        onOpenChange={setGoogleModalOpen}
        onSuccess={() => setGoogleModalOpen(false)}
      />
    </FinanceDashboardLayout>
  );
};

export default FinanceDashboardPage;
