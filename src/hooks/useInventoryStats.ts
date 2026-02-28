import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

// ── Interfaces ──────────────────────────────────────────────

export interface InventorySummary {
  totalActiveProducts: number;
  totalUnitsInStock: number;
  outOfStockProducts: number;
  estimatedInventoryValue: number;
}

export interface CategoryProduct {
  name: string;
  sku: string;
  totalUnits: number;
  inventoryValue: number;
}

export interface CategoryInventory {
  category: string;
  productCount: number;
  totalUnits: number;
  inventoryValue: number;
  products: CategoryProduct[];
}

export interface CategorySales {
  category: string;
  unitsSold: number;
  revenue: number;
  ordersCount: number;
}

export interface CriticalStockProduct {
  productName: string;
  sku: string;
  variantSize: string | null;
  currentStock: number;
  daysOfSupply: number | null;
  avgDailySales: number;
  urgency: string;
}

export interface TopSellingProduct {
  productTitle: string;
  sku: string;
  totalQuantity: number;
  totalRevenue: number;
  ordersCount: number;
}

export interface NoSalesProduct {
  productName: string;
  sku: string;
  currentStock: number;
  basePrice: number | null;
}

export interface SizeDistribution {
  size: string;
  totalUnits: number;
  variantCount: number;
}

export interface InventoryStatsData {
  summary: InventorySummary;
  categoryInventory: CategoryInventory[];
  categorySales: CategorySales[];
  criticalStock: CriticalStockProduct[];
  topSellers: TopSellingProduct[];
  noSalesProducts: NoSalesProduct[];
  sizeDistribution: SizeDistribution[];
}

// ── Helpers ─────────────────────────────────────────────────

function extractCategory(product: { category: string | null; name: string }): string {
  const nameLower = product.name.toLowerCase();

  if (nameLower.includes('ruana') || nameLower.includes('ruanas')) {
    return 'Ruanas';
  }
  if (nameLower.includes('sleeping')) {
    return 'Sleepings';
  }
  if (nameLower.includes('chaqueta') || nameLower.includes('parka') || nameLower.includes('buso')) {
    return 'Chaquetas';
  }
  return 'Otros';
}

function extractCategoryFromLineItem(item: { product_type: string | null; title: string }): string {
  const titleLower = item.title.toLowerCase();

  if (titleLower.includes('ruana') || titleLower.includes('ruanas')) {
    return 'Ruanas';
  }
  if (titleLower.includes('sleeping')) {
    return 'Sleepings';
  }
  if (titleLower.includes('chaqueta') || titleLower.includes('parka') || titleLower.includes('buso')) {
    return 'Chaquetas';
  }
  return 'Otros';
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// ── Procesadores de datos ───────────────────────────────────

interface ProductWithVariants {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  base_price: number | null;
  status: string | null;
  product_variants: Array<{
    id: string;
    stock_quantity: number | null;
    size: string | null;
    color: string | null;
  }>;
}

function computeSummary(products: ProductWithVariants[]): InventorySummary {
  let totalUnits = 0;
  let outOfStock = 0;
  let inventoryValue = 0;

  for (const product of products) {
    const variants = product.product_variants || [];
    let productHasStock = false;

    for (const v of variants) {
      const qty = v.stock_quantity || 0;
      totalUnits += qty;
      if (qty > 0) {
        productHasStock = true;
        inventoryValue += qty * (product.base_price || 0);
      }
    }

    if (!productHasStock && variants.length > 0) {
      outOfStock++;
    }
  }

  return {
    totalActiveProducts: products.length,
    totalUnitsInStock: totalUnits,
    outOfStockProducts: outOfStock,
    estimatedInventoryValue: inventoryValue,
  };
}

function computeCategoryInventory(products: ProductWithVariants[]): CategoryInventory[] {
  const categoryMap = new Map<string, {
    productIds: Set<string>;
    totalUnits: number;
    inventoryValue: number;
    productDetails: Map<string, CategoryProduct>;
  }>();

  for (const product of products) {
    const cat = extractCategory(product);
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { productIds: new Set(), totalUnits: 0, inventoryValue: 0, productDetails: new Map() });
    }
    const entry = categoryMap.get(cat)!;
    entry.productIds.add(product.id);

    // Acumular stock del producto
    let productUnits = 0;
    let productValue = 0;

    for (const v of product.product_variants || []) {
      const qty = v.stock_quantity || 0;
      entry.totalUnits += qty;
      productUnits += qty;
      if (qty > 0) {
        const val = qty * (product.base_price || 0);
        entry.inventoryValue += val;
        productValue += val;
      }
    }

    // Agregar o actualizar detalle del producto
    if (!entry.productDetails.has(product.id)) {
      entry.productDetails.set(product.id, {
        name: product.name,
        sku: product.sku,
        totalUnits: productUnits,
        inventoryValue: productValue,
      });
    } else {
      const existing = entry.productDetails.get(product.id)!;
      existing.totalUnits += productUnits;
      existing.inventoryValue += productValue;
    }
  }

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      productCount: data.productIds.size,
      totalUnits: data.totalUnits,
      inventoryValue: data.inventoryValue,
      products: Array.from(data.productDetails.values()).sort((a, b) => b.totalUnits - a.totalUnits),
    }))
    .sort((a, b) => b.totalUnits - a.totalUnits);
}

interface LineItemRow {
  shopify_order_id: number;
  title: string;
  product_type: string | null;
  quantity: number;
  price: number;
  total_discount: number | null;
}

function computeCategorySales(lineItems: LineItemRow[]): CategorySales[] {
  const categoryMap = new Map<string, { unitsSold: number; revenue: number; orderIds: Set<number> }>();

  for (const item of lineItems) {
    const cat = extractCategoryFromLineItem(item);
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { unitsSold: 0, revenue: 0, orderIds: new Set() });
    }
    const entry = categoryMap.get(cat)!;
    entry.unitsSold += item.quantity;
    entry.revenue += (item.price * item.quantity) - (item.total_discount || 0);
    entry.orderIds.add(item.shopify_order_id);
  }

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      unitsSold: data.unitsSold,
      revenue: data.revenue,
      ordersCount: data.orderIds.size,
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold);
}

function computeSizeDistribution(products: ProductWithVariants[]): SizeDistribution[] {
  const sizeMap = new Map<string, { totalUnits: number; variantCount: number }>();

  for (const product of products) {
    for (const v of product.product_variants || []) {
      const size = v.size || 'Sin talla';
      if (!sizeMap.has(size)) {
        sizeMap.set(size, { totalUnits: 0, variantCount: 0 });
      }
      const entry = sizeMap.get(size)!;
      entry.totalUnits += v.stock_quantity || 0;
      entry.variantCount++;
    }
  }

  return Array.from(sizeMap.entries())
    .map(([size, data]) => ({
      size,
      totalUnits: data.totalUnits,
      variantCount: data.variantCount,
    }))
    .sort((a, b) => b.totalUnits - a.totalUnits);
}

// ── Fetch line items en batches ─────────────────────────────

async function fetchLineItemsInBatches(
  orderIds: number[],
  orgId: string
): Promise<LineItemRow[]> {
  if (orderIds.length === 0) return [];

  const BATCH_SIZE = 200;
  const allItems: LineItemRow[] = [];

  for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
    const batch = orderIds.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('shopify_order_line_items')
      .select('shopify_order_id, title, product_type, quantity, price, total_discount')
      .eq('organization_id', orgId)
      .in('shopify_order_id', batch);

    if (error) {
      console.error('Error fetching line items batch:', error);
      continue;
    }
    if (data) {
      allItems.push(...data);
    }
  }

  return allItems;
}

// ── Hook principal ──────────────────────────────────────────

export const useInventoryStats = () => {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<InventoryStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllStats = useCallback(async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    setError(null);

    try {
      const orgId = currentOrganization.id;
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDateStr = thirtyDaysAgo.toISOString().split('T')[0];
      const endDateStr = now.toISOString().split('T')[0];

      // Parallel queries
      const [productsResult, recentOrdersResult, replenishmentResult, salesAnalyticsResult] = await Promise.all([
        // Query 1: Products con variants
        supabase
          .from('products')
          .select(`
            id,
            name,
            sku,
            category,
            base_price,
            status,
            product_variants (
              id,
              stock_quantity,
              size,
              color
            )
          `)
          .eq('organization_id', orgId)
          .eq('status', 'active'),

        // Query 2: Órdenes pagadas de últimos 30 días
        supabase
          .from('shopify_orders')
          .select('shopify_order_id')
          .eq('organization_id', orgId)
          .gte('created_at_shopify', thirtyDaysAgo.toISOString())
          .in('financial_status', ['paid', 'partially_paid']),

        // Query 3: Stock crítico desde replenishment view
        supabase
          .from('v_replenishment_details')
          .select('product_name, sku, sku_variant, variant_size, current_stock, days_of_supply, avg_daily_sales, urgency')
          .eq('organization_id', orgId)
          .in('urgency', ['critical', 'high'])
          .order('days_of_supply', { ascending: true, nullsFirst: true })
          .limit(20),

        // Query 4: Sales analytics RPC (30 días)
        supabase.rpc('get_product_sales_analytics', {
          start_date: startDateStr,
          end_date: endDateStr,
        }),
      ]);

      // Procesar productos - solo los que tienen categoría "Shopify Import" (productos importados de Shopify)
      const allProducts = (productsResult.data as ProductWithVariants[]) || [];
      if (productsResult.error) {
        console.error('Error fetching products:', productsResult.error);
      }
      const products = allProducts.filter(
        (p) => p.category?.trim().toLowerCase() === 'shopify import'
      );

      // Query 2b: Line items (depende de Query 2)
      const orderIds = (recentOrdersResult.data || []).map((o) => o.shopify_order_id);
      const lineItems = await fetchLineItemsInBatches(orderIds, orgId);

      // Procesar summary
      const summary = computeSummary(products);

      // Procesar inventario por categoría
      const categoryInventory = computeCategoryInventory(products);

      // Procesar ventas por categoría
      const categorySales = computeCategorySales(lineItems);

      // Procesar stock crítico
      const criticalStock: CriticalStockProduct[] = (replenishmentResult.data || []).map((r: any) => ({
        productName: r.product_name || 'Desconocido',
        sku: r.sku_variant || r.sku || '',
        variantSize: r.variant_size,
        currentStock: r.current_stock || 0,
        daysOfSupply: r.days_of_supply,
        avgDailySales: r.avg_daily_sales || 0,
        urgency: r.urgency || 'high',
      }));

      // Procesar top sellers
      const salesData = (salesAnalyticsResult.data || []) as Array<{
        product_title: string;
        sku: string;
        total_quantity: number;
        total_revenue: number;
        orders_count: number;
        variant_title: string;
      }>;

      // Agrupar por producto (el RPC devuelve por variante)
      const productSalesMap = new Map<string, TopSellingProduct>();
      for (const item of salesData) {
        const key = item.product_title;
        if (!productSalesMap.has(key)) {
          productSalesMap.set(key, {
            productTitle: item.product_title,
            sku: item.sku,
            totalQuantity: 0,
            totalRevenue: 0,
            ordersCount: 0,
          });
        }
        const entry = productSalesMap.get(key)!;
        entry.totalQuantity += item.total_quantity;
        entry.totalRevenue += item.total_revenue;
        entry.ordersCount += item.orders_count;
      }

      const topSellers = Array.from(productSalesMap.values())
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10);

      // Productos sin ventas en 30 días
      const soldProductNames = new Set(salesData.map((s) => s.product_title));
      const noSalesProducts: NoSalesProduct[] = products
        .filter((p) => !soldProductNames.has(p.name))
        .map((p) => {
          const totalStock = (p.product_variants || []).reduce(
            (sum, v) => sum + (v.stock_quantity || 0),
            0
          );
          return {
            productName: p.name,
            sku: p.sku,
            currentStock: totalStock,
            basePrice: p.base_price,
          };
        })
        .filter((p) => p.currentStock > 0) // Solo los que tienen stock sin mover
        .sort((a, b) => b.currentStock - a.currentStock);

      // Distribución por talla
      const sizeDistribution = computeSizeDistribution(products);

      setData({
        summary,
        categoryInventory,
        categorySales,
        criticalStock,
        topSellers,
        noSalesProducts,
        sizeDistribution,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      console.error('Error fetching inventory stats:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchAllStats();
  }, [fetchAllStats]);

  return { data, loading, error, refetch: fetchAllStats };
};
