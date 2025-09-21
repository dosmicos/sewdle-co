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
  revenue_60_days: number;
  orders_count: number;
  status: string;
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
      const variantData: any[] = [];
      
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
          .in('shopify_orders.financial_status', ['paid', 'partially_paid', 'pending'])
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
      const productMap = new Map<string, any>();
      
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

      // Convert to final ranking data
      const rankingData: SalesVelocityData[] = Array.from(productMap.values()).map(product => {
        const salesVelocity = product.sales_60_days / 60; // daily average
        const stockDaysRemaining = salesVelocity > 0 ? product.current_stock / salesVelocity : 9999;
        
        // Determine status based on total product sales
        let status = 'good';
        if (product.sales_60_days === 0) {
          status = 'critical'; // No sales in 60 days
        } else if (product.sales_60_days <= 10) {
          status = 'low'; // Very low sales for entire product
        } else if (product.sales_60_days <= 50) {
          status = 'warning'; // Low sales for entire product
        }

        return {
          product_id: product.product_id,
          product_name: product.product_name,
          variant_count: product.variant_count,
          main_sku: product.variant_count > 1 ? 'Múltiples SKUs' : product.main_sku,
          current_stock: product.current_stock,
          sales_60_days: product.sales_60_days,
          sales_velocity: Number(salesVelocity.toFixed(3)),
          stock_days_remaining: Math.round(stockDaysRemaining),
          revenue_60_days: Number(product.revenue_60_days.toFixed(2)),
          orders_count: product.orders_count,
          status
        };
      });

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