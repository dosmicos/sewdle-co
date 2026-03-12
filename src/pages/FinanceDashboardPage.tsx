import React, { useState, useEffect } from 'react';
import { Pin, DollarSign, BarChart3, ShoppingBag, Globe, CreditCard, RefreshCw, Loader2, Settings, Target } from 'lucide-react';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import FinanceDatePicker from '@/components/finance-dashboard/FinanceDatePicker';
import MetricCard from '@/components/finance-dashboard/MetricCard';
import MetricSection from '@/components/finance-dashboard/MetricSection';
import AttributionTable, { type AttributionRow } from '@/components/finance-dashboard/AttributionTable';
import AdPerformanceDiagnostics from '@/components/finance-dashboard/AdPerformanceDiagnostics';
import AdPerformanceTable from '@/components/finance-dashboard/AdPerformanceTable';
import MetaAdsConnectionModal from '@/components/finance-dashboard/MetaAdsConnectionModal';
import { useFinanceDateRange } from '@/hooks/useFinanceDateRange';
import { useStoreMetrics } from '@/hooks/useStoreMetrics';
import { useAdMetrics } from '@/hooks/useAdMetrics';
import { useAdPerformance } from '@/hooks/useAdPerformance';
import { useMetaAdsConnection } from '@/hooks/useMetaAdsConnection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, subDays } from 'date-fns';

const formatCOP = (amount: number) => {
  return `COP ${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
};

const formatNumber = (n: number) => new Intl.NumberFormat('es-CO').format(n);

const formatPercent = (n: number) => `${n.toFixed(2)}%`;

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

const AnalyticsIcon = () => (
  <BarChart3 className="h-4 w-4 text-blue-500" />
);

const StoreIcon = () => (
  <ShoppingBag className="h-4 w-4 text-green-500" />
);

const ExpensesIcon = () => (
  <CreditCard className="h-4 w-4 text-purple-500" />
);

const FinanceDashboardPage: React.FC = () => {
  const dateRange = useFinanceDateRange();
  const { current, changes, isLoading } = useStoreMetrics(dateRange.current, dateRange.previous);
  const metaAds = useAdMetrics(dateRange.current, dateRange.previous, 'meta');
  const metaConnection = useMetaAdsConnection();
  const adPerformance = useAdPerformance(dateRange.current);

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Auto-open settings modal if returning from OAuth callback
  useEffect(() => {
    const oauthResult = sessionStorage.getItem('meta_oauth_result');
    if (oauthResult) {
      setSettingsOpen(true);
    }
  }, []);

  const dailySales = current.dailyData.map(d => d.totalSales);
  const dailyOrders = current.dailyData.map(d => d.orders);
  const dailyMetaSpend = metaAds.current.dailyData.map(d => d.spend);
  const dailyMetaRoas = metaAds.current.dailyData.map(d => d.roas);

  // Total ad spend (Meta + Google when available)
  const totalAdSpend = metaAds.current.spend;
  const totalAdRoas = totalAdSpend > 0 ? metaAds.current.conversionValue / totalAdSpend : 0;

  // MER = Total Revenue / Total Ad Spend
  const mer = totalAdSpend > 0 ? current.totalSales / totalAdSpend : 0;

  // Net Profit (simplified: Revenue - Ad Spend)
  const netProfit = current.totalSales - totalAdSpend;
  const prevNetProfit = (changes.totalSales !== undefined ? current.totalSales / (1 + changes.totalSales / 100) : 0) - metaAds.previous.spend;
  const netProfitChange = prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : (netProfit > 0 ? 100 : 0);

  // NCPA = Ad Spend / New Customer Orders
  const ncpa = current.newCustomerOrders > 0 ? totalAdSpend / current.newCustomerOrders : 0;

  // NC-ROAS = New Customer Revenue / Ad Spend
  const ncRoas = totalAdSpend > 0 ? current.newCustomerRevenue / totalAdSpend : 0;

  // Attribution rows with real Meta data
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
      spend: 0,
      cv: 0,
      roas: 0,
      clicks: 0,
      impressions: 0,
    },
  ];

  // Sync handler — syncs both account-level and ad-level data
  const handleSync = async () => {
    const startStr = format(dateRange.current.start, 'yyyy-MM-dd');
    const endStr = format(dateRange.current.end, 'yyyy-MM-dd');
    // Also sync 7 days back for trend data
    const sevenDaysAgo = format(subDays(dateRange.current.end, 6), 'yyyy-MM-dd');
    await Promise.all([
      metaConnection.syncMetrics(startStr, endStr),
      adPerformance.syncAdPerformance(sevenDaysAgo, endStr),
    ]);
  };

  if (isLoading) {
    return (
      <FinanceDashboardLayout onOpenSettings={() => setSettingsOpen(true)}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </FinanceDashboardLayout>
    );
  }

  return (
    <FinanceDashboardLayout onOpenSettings={() => setSettingsOpen(true)}>
      <div className="p-6 max-w-[1400px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-lg">🏠</span> Summary
            </h1>
            <FinanceDatePicker dateRange={dateRange} />
          </div>
          <div className="flex items-center gap-2">
            {metaConnection.isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={metaConnection.syncing || adPerformance.syncing}
              >
                {metaConnection.syncing || adPerformance.syncing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Sync Meta
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
                onClick={() => setSettingsOpen(true)}
              >
                <MetaIcon />
                <span className="ml-1.5">Conectar Meta Ads</span>
              </Button>
            )}
          </div>
        </div>

        {/* Pins Section */}
        <MetricSection title="Pins" icon={<Pin className="h-4 w-4" />}>
          <MetricCard
            icon={<StoreIcon />}
            label="Total Sales"
            value={formatCOP(current.totalSales)}
            changePercent={changes.totalSales}
            sparklineData={dailySales}
            isPinned
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Ads"
            value={formatCOP(totalAdSpend)}
            changePercent={metaAds.changes.spend}
            sparklineData={dailyMetaSpend}
          />
          <MetricCard
            label="ROAS"
            value={totalAdRoas.toFixed(2)}
            changePercent={metaAds.changes.roas}
            sparklineData={dailyMetaRoas}
          />
        </MetricSection>

        {/* Custom Metrics */}
        <MetricSection title="Custom Metrics" icon={<BarChart3 className="h-4 w-4" />}>
          <MetricCard
            label="Net Profit"
            value={formatCOP(netProfit)}
            changePercent={netProfitChange}
            sparklineData={dailySales}
          />
          <MetricCard
            label="ROAS"
            value={totalAdRoas.toFixed(2)}
            changePercent={metaAds.changes.roas}
            sparklineData={dailyMetaRoas}
            isPinned
          />
          <MetricCard
            label="MER"
            value={mer.toFixed(2)}
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            label="Net Margin"
            value={current.totalSales > 0 ? formatPercent((netProfit / current.totalSales) * 100) : '0%'}
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Ads"
            value={formatCOP(totalAdSpend)}
            changePercent={metaAds.changes.spend}
            sparklineData={dailyMetaSpend}
            isPinned
          />
          <MetricCard
            label="NCPA"
            value={formatCOP(ncpa)}
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            label="NC-ROAS"
            value={ncRoas.toFixed(2)}
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            label="Contraentrega"
            value="0%"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="Taxes"
            value={formatCOP(current.taxes)}
            changePercent={changes.taxes}
            sparklineData={[]}
          />
          <MetricCard
            label="BA-ROAS"
            value={totalAdRoas.toFixed(2)}
            changePercent={metaAds.changes.roas}
            sparklineData={[]}
          />
          <MetricCard
            label="Cash Turnover"
            value={formatCOP(current.totalSales - current.taxes)}
            changePercent={changes.totalSales}
            sparklineData={[]}
          />
          <MetricCard
            label="POAS"
            value={totalAdSpend > 0 ? (netProfit / totalAdSpend).toFixed(2) : '0.00'}
            changePercent={0}
            sparklineData={[]}
          />
        </MetricSection>

        {/* Attribution */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h2 className="text-lg font-semibold text-gray-900">Attribution</h2>
            {metaConnection.isConnected && (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                Meta conectado
              </Badge>
            )}
          </div>
          <AttributionTable rows={attributionRows} formatCurrency={formatCOP} />
          {!metaConnection.isConnected && (
            <p className="text-sm text-gray-400 italic">
              Conecta Meta Ads y Google Ads en configuración para ver datos reales.
            </p>
          )}
        </div>

        {/* Ad Performance */}
        {metaConnection.isConnected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-500" />
              <h2 className="text-lg font-semibold text-gray-900">Ad Performance</h2>
              <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 text-xs">
                {adPerformance.ads.length} ads
              </Badge>
              {adPerformance.syncing && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
              )}
            </div>
            <AdPerformanceDiagnostics
              ads={adPerformance.ads}
              formatCurrency={formatCOP}
            />
            <AdPerformanceTable
              ads={adPerformance.ads}
              formatCurrency={formatCOP}
              formatNumber={formatNumber}
              formatPercent={formatPercent}
            />
          </div>
        )}

        {/* Web Analytics */}
        <MetricSection title="Web Analytics" icon={<AnalyticsIcon />}>
          <MetricCard
            icon={<AnalyticsIcon />}
            label="Conversion Rate"
            value="0%"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<AnalyticsIcon />}
            label="Users"
            value="0"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<AnalyticsIcon />}
            label="Sessions"
            value="0"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<AnalyticsIcon />}
            label="Pages per Session"
            value="0"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<AnalyticsIcon />}
            label="Session Duration"
            value="00:00:00"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<AnalyticsIcon />}
            label="Bounce Rate"
            value="0%"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<AnalyticsIcon />}
            label="New Users"
            value="0"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<AnalyticsIcon />}
            label="New Users %"
            value="0%"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<AnalyticsIcon />}
            label="Sessions with Add to Carts"
            value="0"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<AnalyticsIcon />}
            label="Add to Cart %"
            value="0%"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<AnalyticsIcon />}
            label="Cost per Add to Cart"
            value={formatCOP(0)}
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<AnalyticsIcon />}
            label="Cost per Session"
            value={formatCOP(0)}
            changePercent={0}
            sparklineData={[]}
          />
        </MetricSection>

        {/* Store */}
        <MetricSection title="Store" icon={<StoreIcon />}>
          <MetricCard
            icon={<StoreIcon />}
            label="Order Revenue"
            value={formatCOP(current.totalSales)}
            changePercent={changes.totalSales}
            sparklineData={dailySales}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="Orders > $0"
            value={formatNumber(current.orders)}
            changePercent={changes.orders}
            sparklineData={dailyOrders}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="New Customer Orders"
            value={formatNumber(current.newCustomerOrders)}
            changePercent={changes.newCustomerOrders}
            sparklineData={[]}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="Units Sold"
            value={formatNumber(current.unitsSold)}
            changePercent={changes.unitsSold}
            sparklineData={[]}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="New Customer Revenue"
            value={formatCOP(current.newCustomerRevenue)}
            changePercent={changes.newCustomerRevenue}
            sparklineData={[]}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="Returning Customer Revenue"
            value={formatCOP(current.returningCustomerRevenue)}
            changePercent={changes.returningCustomerRevenue}
            sparklineData={[]}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="Discounts"
            value={formatCOP(current.discounts)}
            changePercent={changes.discounts}
            sparklineData={[]}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="Total Sales"
            value={formatCOP(current.totalSales)}
            changePercent={changes.totalSales}
            sparklineData={dailySales}
            isPinned
          />
          <MetricCard
            icon={<StoreIcon />}
            label="Sale Taxes"
            value={formatCOP(current.saleTaxes)}
            changePercent={changes.saleTaxes}
            sparklineData={[]}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="AOV"
            value={formatCOP(current.aov)}
            changePercent={changes.aov}
            sparklineData={[]}
          />
        </MetricSection>

        {/* Meta Ads */}
        <MetricSection title="Meta Ads" icon={<MetaIcon />}>
          {!metaConnection.isConnected && (
            <div className="col-span-full">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">Meta Ads no conectado</p>
                  <p className="text-xs text-blue-700 mt-0.5">Conecta tu cuenta para ver métricas reales</p>
                </div>
                <Button
                  size="sm"
                  className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
                  onClick={() => setSettingsOpen(true)}
                >
                  Conectar
                </Button>
              </div>
            </div>
          )}
          <MetricCard
            icon={<MetaIcon />}
            label="Facebook Ads"
            value={formatCOP(metaAds.current.spend)}
            changePercent={metaAds.changes.spend}
            sparklineData={dailyMetaSpend}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="ROAS"
            value={metaAds.current.roas.toFixed(2)}
            changePercent={metaAds.changes.roas}
            sparklineData={dailyMetaRoas}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="CPC"
            value={formatCOP(metaAds.current.cpc)}
            changePercent={metaAds.changes.cpc}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="CPM"
            value={formatCOP(metaAds.current.cpm)}
            changePercent={metaAds.changes.cpm}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Meta Purchases"
            value={formatNumber(metaAds.current.purchases)}
            changePercent={metaAds.changes.purchases}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Web Purchases"
            value={formatNumber(metaAds.current.purchases)}
            changePercent={metaAds.changes.purchases}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Web Conversion Value"
            value={formatCOP(metaAds.current.conversionValue)}
            changePercent={metaAds.changes.conversionValue}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="CTR"
            value={formatPercent(metaAds.current.ctr)}
            changePercent={metaAds.changes.ctr}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="CPOC"
            value={formatCOP(metaAds.current.cpa)}
            changePercent={metaAds.changes.cpa}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Revenue Per Link Click"
            value={metaAds.current.clicks > 0 ? formatCOP(metaAds.current.conversionValue / metaAds.current.clicks) : formatCOP(0)}
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Purchases"
            value={formatNumber(metaAds.current.purchases)}
            changePercent={metaAds.changes.purchases}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="CPA"
            value={formatCOP(metaAds.current.cpa)}
            changePercent={metaAds.changes.cpa}
            sparklineData={[]}
          />
        </MetricSection>

        {/* Google Ads */}
        <MetricSection title="Google Ads" icon={<GoogleIcon />}>
          <MetricCard
            icon={<GoogleIcon />}
            label="Google Ads"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<GoogleIcon />}
            label="ROAS"
            value="0.00"
            sparklineData={[]}
          />
          <MetricCard
            icon={<GoogleIcon />}
            label="CPC"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<GoogleIcon />}
            label="Conversions"
            value="0"
            sparklineData={[]}
          />
          <MetricCard
            icon={<GoogleIcon />}
            label="CTR"
            value="0%"
            sparklineData={[]}
          />
          <MetricCard
            icon={<GoogleIcon />}
            label="CPA"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<GoogleIcon />}
            label="CPM"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<GoogleIcon />}
            label="Clicks"
            value="0"
            sparklineData={[]}
          />
          <MetricCard
            icon={<GoogleIcon />}
            label="Impressions"
            value="0"
            sparklineData={[]}
          />
          <MetricCard
            icon={<GoogleIcon />}
            label="All Conversions Value"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<GoogleIcon />}
            label="All ROAS"
            value="0.00"
            sparklineData={[]}
          />
          <MetricCard
            icon={<GoogleIcon />}
            label="All Conversions"
            value="0"
            sparklineData={[]}
          />
        </MetricSection>

        {/* Expenses */}
        <MetricSection title="Expenses" icon={<ExpensesIcon />}>
          <MetricCard
            icon={<ExpensesIcon />}
            label="Payment Gateways"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="COGS"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="Handling Fees"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="Shipping"
            value={formatCOP(current.totalShipping)}
            changePercent={changes.totalShipping}
            sparklineData={[]}
          />
          <MetricCard
            icon={<ExpensesIcon />}
            label="Custom Expenses"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<ExpensesIcon />}
            label="Custom Expense Ad Spend"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<ExpensesIcon />}
            label="Custom Expenses excl. Ad Spend"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<StoreIcon />}
            label="Shipping Price"
            value={formatCOP(current.totalShipping)}
            changePercent={changes.totalShipping}
            sparklineData={[]}
          />
        </MetricSection>
      </div>

      {/* Meta Ads Connection Modal */}
      <MetaAdsConnectionModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSuccess={() => setSettingsOpen(false)}
      />
    </FinanceDashboardLayout>
  );
};

export default FinanceDashboardPage;
