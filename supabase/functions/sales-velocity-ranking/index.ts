import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

interface SalesVelocityData {
  product_id: string;
  product_name: string;
  variant_count: number;
  main_sku: string;
  current_stock: number;
  sales_60_days: number;
  sales_velocity: number;
  stock_days_remaining: number;
  velocity_stock_ratio: number;
  revenue_60_days: number;
  orders_count: number;
  status: string;
  days_with_stock?: number;
}

interface VariantMetrics {
  product_id: string;
  product_name: string;
  sku_variant: string;
  current_stock: number;
  sales_60_days: number;
  revenue_60_days: number;
  orders_count: number;
}

interface ConsolidatedProductMetrics {
  product_id: string;
  product_name: string;
  variant_count: number;
  main_sku: string;
  skus: string[];
  current_stock: number;
  sales_60_days: number;
  revenue_60_days: number;
  orders_count: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando cálculo de ranking de velocidad de ventas...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variables de entorno de Supabase no configuradas');
      throw new Error('Variables de entorno de Supabase no configuradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Cliente de Supabase inicializado');

    // Get organization ID from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    // Get user's organization
    const { data: orgUser, error: orgError } = await supabase
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (orgError || !orgUser) {
      throw new Error('User not associated with any organization');
    }

    const organizationId = orgUser.organization_id;
    console.log(`📊 Procesando ranking para organización: ${organizationId}`);

    // Force manual calculation to ensure product grouping
    console.log('📝 Calculando ranking manualmente con agrupación por producto...');
      
      // Get all product variants with basic info and product ID
      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select(`
          id,
          sku_variant,
          size,
          color,
          stock_quantity,
          product_id,
          products(id, name, status)
        `)
        .eq('products.organization_id', organizationId)
        .not('products.status', 'eq', 'discontinued');

      if (variantsError) {
        throw new Error(`Error obteniendo variantes: ${variantsError.message}`);
      }

      // Calculate sales for each variant and group by product
      const variantData: VariantMetrics[] = [];
      
      for (const variant of variants || []) {
        // Get sales data from Shopify orders
        const { data: salesMetrics, error: metricsError } = await supabase
          .from('shopify_order_line_items')
          .select(`
            quantity,
            price,
            shopify_orders(
              created_at_shopify,
              financial_status,
              organization_id
            )
          `)
          .eq('sku', variant.sku_variant)
          .eq('shopify_orders.organization_id', organizationId)
          .in('shopify_orders.financial_status', ['paid', 'partially_paid'])
          .gte('shopify_orders.created_at_shopify', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString());

        const sales60Days = salesMetrics?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
        const revenue60Days = salesMetrics?.reduce((sum, item) => sum + (item.quantity * item.price || 0), 0) || 0;
        const ordersCount = new Set(salesMetrics?.map(item => item.shopify_orders?.created_at_shopify)).size || 0;
        
        // Use product_id directly or products.id, never variant id as fallback
        const productId = variant.product_id || variant.products?.id;
        if (!productId) {
          console.error(`❌ No se pudo obtener product_id para variante: ${variant.sku_variant}`);
          continue;
        }
        
        variantData.push({
          product_id: productId,
          product_name: variant.products?.name || 'Sin nombre',
          sku_variant: variant.sku_variant,
          current_stock: variant.stock_quantity || 0,
          sales_60_days: sales60Days,
          revenue_60_days: revenue60Days,
          orders_count: ordersCount
        });
      }

      // Group by product and consolidate metrics
      const productMap = new Map<string, ConsolidatedProductMetrics>();
      
      console.log(`🔍 Agrupando ${variantData.length} variantes por producto...`);
      
      variantData.forEach((variant) => {
        // Use only product_id as key to ensure proper grouping
        const productKey = variant.product_id;
        
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            product_id: variant.product_id,
            product_name: variant.product_name,
            variant_count: 0,
            main_sku: variant.sku_variant,
            skus: [],
            current_stock: 0,
            sales_60_days: 0,
            revenue_60_days: 0,
            orders_count: 0
          });
        }
        
        const product = productMap.get(productKey);
        if (!product) {
          return;
        }
        product.variant_count += 1;
        product.skus.push(variant.sku_variant);
        product.current_stock += variant.current_stock;
        product.sales_60_days += variant.sales_60_days;
        product.revenue_60_days += variant.revenue_60_days;
        product.orders_count += variant.orders_count;
      });

      console.log(`✅ Agrupados en ${productMap.size} productos únicos`);
      const uniqueProductIds = Array.from(productMap.keys());
      console.log(`🏷️ Product IDs únicos: ${uniqueProductIds.slice(0, 5).join(', ')}${uniqueProductIds.length > 5 ? '...' : ''}`);

      // Convert to final ranking data - with stock history calculation
      const rankingData: SalesVelocityData[] = [];
      
      for (const product of Array.from(productMap.values())) {
        // Get all variant IDs for this product to check stock history
        const productVariantIds = variantData
          .filter(v => v.product_id === product.product_id)
          .map(v => variants.find(variant => variant.sku_variant === v.sku_variant)?.id)
          .filter(Boolean);

        // Get stock history for all variants of this product (last 60 days)
        let daysWithStock = 0;
        if (productVariantIds.length > 0) {
          const { data: stockHistory } = await supabase
            .from('product_stock_history')
            .select('recorded_at, stock_quantity, product_variant_id')
            .in('product_variant_id', productVariantIds)
            .eq('organization_id', organizationId)
            .gte('recorded_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
            .gt('stock_quantity', 0);

          // Count unique days with stock > 0 across all variants
          if (stockHistory && stockHistory.length > 0) {
            const uniqueDays = new Set(
              stockHistory.map(h => new Date(h.recorded_at).toDateString())
            );
            daysWithStock = uniqueDays.size;
          }
        }

        // Determine effective days for velocity calculation
        let effectiveDays = 60; // Default: full 60-day period
        
        // Only use stock history if we have reliable data (at least 7 days)
        if (daysWithStock >= 7) {
          effectiveDays = daysWithStock;
          console.log(`📊 ${product.product_name}: Usando ${daysWithStock} días con stock del historial`);
        } else if (daysWithStock > 0) {
          // Insufficient stock history, use full period as conservative estimate
          console.log(`⚠️ ${product.product_name}: Historial insuficiente (${daysWithStock} días), usando 60 días por defecto`);
          effectiveDays = 60;
        } else if (product.sales_60_days > 0) {
          // No stock history but has sales - use full period
          console.log(`⚠️ ${product.product_name}: Sin historial pero con ventas, usando 60 días por defecto`);
          effectiveDays = 60;
        }

        // Calculate sales velocity with effective days
        let salesVelocity = effectiveDays > 0 ? product.sales_60_days / effectiveDays : 0;
        
        // Validation: velocity cannot exceed theoretical maximum
        // Max reasonable velocity = all sales happened in shortest possible time (7 days)
        const maxReasonableVelocity = product.sales_60_days / 7;
        if (salesVelocity > maxReasonableVelocity) {
          console.warn(`⚠️ Velocidad sospechosa para ${product.product_name}:`);
          console.warn(`   Velocidad calculada: ${salesVelocity.toFixed(3)} unidades/día`);
          console.warn(`   Ventas totales: ${product.sales_60_days}, Días efectivos: ${effectiveDays}`);
          console.warn(`   Usando velocidad máxima razonable: ${maxReasonableVelocity.toFixed(3)} unidades/día`);
          salesVelocity = maxReasonableVelocity;
        }
        const stockDaysRemaining = salesVelocity > 0 ? product.current_stock / salesVelocity : 9999;
        
        // Calculate velocity/stock ratio (replace 0 with 1 for stock days)
        const stockDaysForRatio = stockDaysRemaining === 0 ? 1 : stockDaysRemaining;
        const velocityStockRatio = salesVelocity / stockDaysForRatio;
        
        // Determine status based on total product sales
        let status = 'good';
        if (product.sales_60_days === 0) {
          status = 'critical'; // No sales in 60 days
        } else if (product.sales_60_days <= 10) {
          status = 'low'; // Very low sales for entire product
        } else if (product.sales_60_days <= 50) {
          status = 'warning'; // Low sales for entire product
        }

        rankingData.push({
          product_id: product.product_id,
          product_name: product.product_name,
          variant_count: product.variant_count,
          main_sku: product.variant_count > 1 ? 'Múltiples SKUs' : product.main_sku,
          current_stock: product.current_stock,
          sales_60_days: product.sales_60_days,
          sales_velocity: Number(salesVelocity.toFixed(3)),
          stock_days_remaining: Math.round(stockDaysRemaining),
          velocity_stock_ratio: Number(velocityStockRatio.toFixed(3)),
          revenue_60_days: Number(product.revenue_60_days.toFixed(2)),
          orders_count: product.orders_count,
          status,
          days_with_stock: daysWithStock || effectiveDays
        });
      }

      // Sort by sales velocity (descending) and then by sales volume
      rankingData.sort((a, b) => {
        if (b.sales_60_days !== a.sales_60_days) {
          return b.sales_60_days - a.sales_60_days;
        }
        return b.sales_velocity - a.sales_velocity;
      });

      console.log(`✅ Ranking calculado: ${rankingData.length} productos consolidados`);
      
      // Generate summary statistics
      const summary = {
        total_products: rankingData.length,
        zero_sales: rankingData.filter(v => v.sales_60_days === 0).length,
        low_sales: rankingData.filter(v => v.sales_60_days > 0 && v.sales_60_days <= 10).length,
        good_sales: rankingData.filter(v => v.sales_60_days > 10).length,
        total_units_sold: rankingData.reduce((sum, v) => sum + v.sales_60_days, 0),
        total_revenue: rankingData.reduce((sum, v) => sum + v.revenue_60_days, 0),
        total_variants: rankingData.reduce((sum, v) => sum + v.variant_count, 0),
        calculation_date: new Date().toISOString().split('T')[0],
        period_days: 60
      };

      return new Response(
        JSON.stringify({
          success: true,
          data: rankingData,
          summary,
          message: 'Ranking de velocidad de ventas calculado exitosamente'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
  } catch (error) {
    console.error('❌ Error en función de ranking de ventas:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
