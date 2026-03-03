import React from 'react';
import { Pin, DollarSign, BarChart3, ShoppingBag, Globe, CreditCard } from 'lucide-react';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import FinanceDatePicker from '@/components/finance-dashboard/FinanceDatePicker';
import MetricCard from '@/components/finance-dashboard/MetricCard';
import MetricSection from '@/components/finance-dashboard/MetricSection';
import AttributionTable, { type AttributionRow } from '@/components/finance-dashboard/AttributionTable';
import { useFinanceDateRange } from '@/hooks/useFinanceDateRange';
import { useStoreMetrics } from '@/hooks/useStoreMetrics';

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

  const dailySales = current.dailyData.map(d => d.totalSales);
  const dailyOrders = current.dailyData.map(d => d.orders);

  // Placeholder attribution data (will be real when Meta/Google APIs are connected)
  const attributionRows: AttributionRow[] = [
    {
      source: 'Meta',
      icon: <MetaIcon />,
      budget: null,
      spend: 0,
      cv: 0,
      roas: 0,
      clicks: 0,
      impressions: 0,
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

  if (isLoading) {
    return (
      <FinanceDashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </FinanceDashboardLayout>
    );
  }

  return (
    <FinanceDashboardLayout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-lg">🏠</span> Summary
            </h1>
            <FinanceDatePicker dateRange={dateRange} />
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
            value={formatCOP(0)}
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            label="ROAS"
            value="0.00"
            changePercent={0}
            sparklineData={[]}
          />
        </MetricSection>

        {/* Custom Metrics */}
        <MetricSection title="Custom Metrics" icon={<BarChart3 className="h-4 w-4" />}>
          <MetricCard
            label="Net Profit"
            value={formatCOP(current.totalSales)}
            changePercent={changes.totalSales}
            sparklineData={dailySales}
          />
          <MetricCard
            label="ROAS"
            value="0.00"
            changePercent={0}
            sparklineData={[]}
            isPinned
          />
          <MetricCard
            label="MER"
            value="0%"
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            label="Net Margin"
            value={current.totalSales > 0 ? formatPercent((current.totalSales / current.totalSales) * 100) : '0%'}
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Ads"
            value={formatCOP(0)}
            changePercent={0}
            sparklineData={[]}
            isPinned
          />
          <MetricCard
            label="NCPA"
            value={formatCOP(0)}
            changePercent={0}
            sparklineData={[]}
          />
          <MetricCard
            label="NC-ROAS"
            value="0.00"
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
            value="0.00"
            changePercent={0}
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
            value="0.00"
            changePercent={0}
            sparklineData={[]}
          />
        </MetricSection>

        {/* Attribution */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h2 className="text-lg font-semibold text-gray-900">Attribution</h2>
          </div>
          <AttributionTable rows={attributionRows} formatCurrency={formatCOP} />
          <p className="text-sm text-gray-400 italic">
            Conecta Meta Ads y Google Ads en configuración para ver datos reales.
          </p>
        </div>

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
          <MetricCard
            icon={<MetaIcon />}
            label="Facebook Ads"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="ROAS"
            value="0.00"
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="CPC"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="CPM"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Meta Purchases"
            value="0"
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Web Purchases"
            value="0"
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Web Conversion Value"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="CTR"
            value="0%"
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="CPOC"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Revenue Per Link Click"
            value={formatCOP(0)}
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="Purchases"
            value="0"
            sparklineData={[]}
          />
          <MetricCard
            icon={<MetaIcon />}
            label="CPA"
            value={formatCOP(0)}
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
    </FinanceDashboardLayout>
  );
};

export default FinanceDashboardPage;
