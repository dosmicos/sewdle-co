import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ShopifyOrder {
  id: number;
  created_at: string;
  line_items: Array<{
    product_id: number;
    variant_id: number;
    quantity: number;
    sku: string;
    price: string;
  }>;
}

interface ShopifyProduct {
  id: number;
  variants: Array<{
    id: number;
    sku: string;
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando sincronización de ventas de Shopify...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')!;
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')!;
    
    if (!shopifyDomain || !shopifyToken) {
      throw new Error('Faltan credenciales de Shopify (SHOPIFY_STORE_DOMAIN y SHOPIFY_ACCESS_TOKEN)');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular fecha de hace 30 días para obtener ventas recientes
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFilter = thirtyDaysAgo.toISOString();

    console.log(`📅 Obteniendo órdenes desde: ${dateFilter}`);

    // Obtener órdenes de Shopify de los últimos 30 días
    const ordersUrl = `https://${shopifyDomain}/admin/api/2024-07/orders.json?status=any&created_at_min=${dateFilter}&limit=250`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
    });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      throw new Error(`Error al obtener órdenes de Shopify: ${ordersResponse.status} - ${errorText}`);
    }

    const ordersData = await ordersResponse.json();
    const orders: ShopifyOrder[] = ordersData.orders || [];
    
    console.log(`📦 Obtenidas ${orders.length} órdenes de Shopify`);

    // Obtener mapeo de SKUs de Shopify a variantes locales
    const { data: localVariants, error: variantsError } = await supabase
      .from('product_variants')
      .select('id, sku_variant')
      .not('sku_variant', 'is', null);

    if (variantsError) {
      throw new Error(`Error al obtener variantes locales: ${variantsError.message}`);
    }

    // Crear un mapa de SKU -> variant_id local
    const skuToVariantMap = new Map();
    localVariants.forEach(variant => {
      skuToVariantMap.set(variant.sku_variant, variant.id);
    });

    console.log(`🔗 Mapeo creado para ${skuToVariantMap.size} SKUs locales`);

    // Procesar órdenes y agrupar ventas por variante y fecha
    const salesByVariantAndDate = new Map();

    orders.forEach(order => {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      
      order.line_items.forEach(item => {
        if (!item.sku) return;
        
        const localVariantId = skuToVariantMap.get(item.sku);
        if (!localVariantId) {
          console.log(`⚠️ SKU no encontrado en sistema local: ${item.sku}`);
          return;
        }

        const key = `${localVariantId}_${orderDate}`;
        
        if (!salesByVariantAndDate.has(key)) {
          salesByVariantAndDate.set(key, {
            product_variant_id: localVariantId,
            metric_date: orderDate,
            sales_quantity: 0,
            orders_count: 0,
            total_order_value: 0
          });
        }

        const salesData = salesByVariantAndDate.get(key);
        salesData.sales_quantity += item.quantity;
        salesData.orders_count += 1;
        salesData.total_order_value += parseFloat(item.price) * item.quantity;
        salesData.avg_order_size = salesData.total_order_value / salesData.orders_count;
      });
    });

    console.log(`📊 Procesadas ${salesByVariantAndDate.size} métricas de ventas únicas`);

    // Limpiar métricas existentes de los últimos 30 días
    const { error: deleteError } = await supabase
      .from('sales_metrics')
      .delete()
      .gte('metric_date', thirtyDaysAgo.toISOString().split('T')[0]);

    if (deleteError) {
      console.error('⚠️ Error al limpiar métricas anteriores:', deleteError);
    }

    // Insertar nuevas métricas de ventas
    const salesMetrics = Array.from(salesByVariantAndDate.values());
    
    if (salesMetrics.length > 0) {
      const { error: insertError } = await supabase
        .from('sales_metrics')
        .insert(salesMetrics);

      if (insertError) {
        throw new Error(`Error al insertar métricas de ventas: ${insertError.message}`);
      }

      console.log(`✅ Insertadas ${salesMetrics.length} métricas de ventas`);
    }

    // Generar estadísticas del proceso
    const totalSalesQuantity = salesMetrics.reduce((sum, metric) => sum + metric.sales_quantity, 0);
    const totalOrders = salesMetrics.reduce((sum, metric) => sum + metric.orders_count, 0);
    const uniqueVariants = new Set(salesMetrics.map(m => m.product_variant_id)).size;

    const summary = {
      sync_date: new Date().toISOString(),
      period_days: 30,
      shopify_orders_processed: orders.length,
      unique_variants_with_sales: uniqueVariants,
      total_sales_quantity: totalSalesQuantity,
      total_orders_processed: totalOrders,
      metrics_created: salesMetrics.length,
      status: 'completed'
    };

    console.log('📋 Resumen de sincronización:', JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronización de ventas de Shopify completada exitosamente',
        summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Error en sincronización de ventas de Shopify:', error);
    
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