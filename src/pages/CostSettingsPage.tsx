import React, { useEffect, useRef } from 'react';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import { CostOfGoodsSection } from '@/components/finance-dashboard/cost-settings/CostOfGoodsSection';
import { ShippingSection } from '@/components/finance-dashboard/cost-settings/ShippingSection';
import { GatewayCostsSection } from '@/components/finance-dashboard/cost-settings/GatewayCostsSection';
import { CustomExpensesSection } from '@/components/finance-dashboard/cost-settings/CustomExpensesSection';
import { useFinanceSettings } from '@/hooks/useFinanceSettings';
import { useProductCosts } from '@/hooks/useProductCosts';
import { useGatewayCosts } from '@/hooks/useGatewayCosts';
import { useFinanceExpenses } from '@/hooks/useFinanceExpenses';
import { toast } from 'sonner';
import type { CostMode, ShippingMode, GatewayMode } from '@/hooks/useFinanceSettings';

const CostSettingsPage: React.FC = () => {
  const { settings, updateSettings } = useFinanceSettings();
  const {
    products,
    isLoading: productsLoading,
    isSyncing,
    syncFromShopify,
    updateProductCost,
  } = useProductCosts();
  const {
    gateways,
    detectedGateways,
    isLoading: gatewaysLoading,
    isDetecting,
    upsertGateway,
  } = useGatewayCosts();
  const {
    expenses,
    isLoading: expensesLoading,
    addExpense,
    updateExpense,
    deleteExpense,
  } = useFinanceExpenses();

  // Auto-sync products from Shopify on first visit when no products loaded
  const autoSyncDone = useRef(false);
  useEffect(() => {
    if (
      !autoSyncDone.current &&
      !productsLoading &&
      !isSyncing &&
      products.length === 0 &&
      settings?.cogs_mode === 'per_product'
    ) {
      autoSyncDone.current = true;
      syncFromShopify()
        .then((result) => {
          if (result?.costs_synced > 0) {
            toast.success(`Synced ${result.costs_synced} product costs from Shopify`);
          }
        })
        .catch(() => {
          // Silent — user can manually retry
        });
    }
  }, [productsLoading, products.length, settings?.cogs_mode]);

  const handleModeChange = async (
    key: 'cogs_mode' | 'shipping_mode' | 'gateway_mode',
    value: CostMode | ShippingMode | GatewayMode
  ) => {
    try {
      await updateSettings({ [key]: value });
      toast.success('Mode updated');
    } catch {
      toast.error('Failed to update mode');
    }
  };

  const handlePercentChange = async (key: string, value: number) => {
    try {
      await updateSettings({ [key]: value });
    } catch {
      toast.error('Failed to update setting');
    }
  };

  const handleSyncShopify = async () => {
    try {
      const result = await syncFromShopify();
      toast.success(`Synced ${result?.costs_synced || 0} product costs from Shopify`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sync from Shopify');
    }
  };

  const handleUpdateProductCost = async (
    id: string,
    updates: { product_cost?: number; handling_fee?: number }
  ) => {
    try {
      await updateProductCost({ id, updates });
      toast.success('Product cost updated');
    } catch {
      toast.error('Failed to update product cost');
    }
  };

  const handleUpsertGateway = async (data: {
    gateway_name: string;
    percent_fee?: number;
    flat_fee?: number;
    is_active?: boolean;
  }) => {
    try {
      await upsertGateway(data);
    } catch {
      toast.error('Failed to update gateway');
    }
  };

  const handleAddExpense = async (input: Parameters<typeof addExpense>[0]) => {
    try {
      await addExpense(input);
      toast.success('Expense added');
    } catch {
      toast.error('Failed to add expense');
    }
  };

  const handleUpdateExpense = async (data: Parameters<typeof updateExpense>[0]) => {
    try {
      await updateExpense(data);
      toast.success('Expense updated');
    } catch {
      toast.error('Failed to update expense');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteExpense(id);
      toast.success('Expense deleted');
    } catch {
      toast.error('Failed to delete expense');
    }
  };

  return (
    <FinanceDashboardLayout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cost Settings</h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure how costs are calculated for your Contribution Margin.
              Toggle between flat percentages and detailed per-item tracking.
            </p>
          </div>

          {/* COGS Section */}
          <CostOfGoodsSection
            mode={settings?.cogs_mode || 'per_product'}
            cogsPercent={settings?.cogs_percent || 20}
            products={products}
            isLoading={productsLoading}
            isSyncing={isSyncing}
            onModeChange={(mode) => handleModeChange('cogs_mode', mode)}
            onPercentChange={(v) => handlePercentChange('cogs_percent', v)}
            onSyncFromShopify={handleSyncShopify}
            onUpdateProductCost={handleUpdateProductCost}
          />

          {/* Shipping Section */}
          <ShippingSection
            mode={settings?.shipping_mode || 'per_order_cost'}
            shippingPercent={settings?.shipping_cost_percent || 10}
            shippingCostPerOrder={settings?.shipping_cost_per_order || 0}
            onModeChange={(mode) => handleModeChange('shipping_mode', mode)}
            onPercentChange={(v) => handlePercentChange('shipping_cost_percent', v)}
            onCostPerOrderChange={(v) => handlePercentChange('shipping_cost_per_order', v)}
          />

          {/* Gateway Costs Section */}
          <GatewayCostsSection
            mode={settings?.gateway_mode || 'percent'}
            gatewayPercent={settings?.payment_gateway_percent || 3.5}
            gateways={gateways}
            detectedGateways={detectedGateways}
            isLoading={gatewaysLoading || isDetecting}
            onModeChange={(mode) => handleModeChange('gateway_mode', mode)}
            onPercentChange={(v) => handlePercentChange('payment_gateway_percent', v)}
            onUpsertGateway={handleUpsertGateway}
          />

          {/* Custom Expenses Section */}
          <CustomExpensesSection
            expenses={expenses}
            isLoading={expensesLoading}
            onAdd={handleAddExpense}
            onUpdate={handleUpdateExpense}
            onDelete={handleDeleteExpense}
          />
        </div>
      </div>
    </FinanceDashboardLayout>
  );
};

export default CostSettingsPage;
