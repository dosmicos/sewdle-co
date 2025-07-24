
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

interface ShopifyOrder {
  id: number;
  created_at: string;
  financial_status: string;
  fulfillment_status: string;
  line_items: Array<{
    product_id: number;
    variant_id: number;
    quantity: number;
    sku: string;
    price: string;
    name: string;
  }>;
}

interface DiagnosticResult {
  shopify_data: {
    orders_count: number;
    total_units: number;
    unique_products: number;
    orders: ShopifyOrder[];
  };
  local_data: {
    metrics_count: number;
    total_units: number;
    unique_variants: number;
    date_range: string;
  };
  discrepancies: {
    unit_difference: number;
    missing_orders: number;
    duplicate_entries: number;
  };
}

function validateEnvironment() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SHOPIFY_STORE_DOMAIN',
    'SHOPIFY_ACCESS_TOKEN'
  ];
  
  const missing = required.filter(key => !Deno.env.get(key));
  
  if (missing.length > 0) {
    throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}`);
  }
  
  return {
    supabaseUrl: Deno.env.get('SUPABASE_URL')!,
    supabaseServiceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    shopifyDomain: Deno.env.get('SHOPIFY_STORE_DOMAIN')!,
    shopifyToken: Deno.env.get('SHOPIFY_ACCESS_TOKEN')!
  };
}

const formatShopifyDate = (date: Date): string => {
  return date.toISOString();
};

async function fetchShopifyOrdersForDate(
  shopifyDomain: string,
  shopifyToken: string,
  targetDate: string
): Promise<ShopifyOrder[]> {
  const startDate = new Date(targetDate);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);
  
  console.log(`📅 Obteniendo órdenes de Shopify para ${targetDate}`);
  console.log(`🔍 Rango: ${formatShopifyDate(startDate)} a ${formatShopifyDate(endDate)}`);
  
  const ordersUrl = `https://${shopifyDomain}/admin/api/2025-07/orders.json?status=any&created_at_min=${encodeURIComponent(formatShopifyDate(startDate))}&created_at_max=${encodeURIComponent(formatShopifyDate(endDate))}&limit=250&fields=id,created_at,financial_status,fulfillment_status,line_items`;
  
  const response = await fetch(ordersUrl, {
    headers: {
      'X-Shopify-Access-Token': shopifyToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error de Shopify API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const orders = data.orders || [];
  
  console.log(`📦 Órdenes obtenidas de Shopify: ${orders.length}`);
  
  // Filtrar solo órdenes con estados financieros válidos
  const validStatuses = ['pending', 'authorized', 'partially_paid', 'paid', 'partially_refunded'];
  const validOrders = orders.filter(order => validStatuses.includes(order.financial_status));
  
  console.log(`✅ Órdenes válidas (estados financieros): ${validOrders.length}`);
  
  return validOrders;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Iniciando diagnóstico de sincronización Shopify...');
    
    const env = validateEnvironment();
    const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);
    
    // Obtener fecha objetivo del cuerpo de la solicitud
    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || '2025-07-23'; // Por defecto ayer
    
    console.log(`📅 Fecha objetivo: ${targetDate}`);
    
    // 1. Obtener datos de Shopify para la fecha específica
    const shopifyOrders = await fetchShopifyOrdersForDate(
      env.shopifyDomain,
      env.shopifyToken,
      targetDate
    );
    
    // Procesar datos de Shopify
    let totalShopifyUnits = 0;
    const productMap = new Map<string, number>();
    
    shopifyOrders.forEach(order => {
      console.log(`📋 Procesando orden ${order.id} (${order.financial_status})`);
      
      order.line_items.forEach(item => {
        const quantity = item.quantity;
        totalShopifyUnits += quantity;
        
        const key = `${item.sku || item.name}`;
        productMap.set(key, (productMap.get(key) || 0) + quantity);
        
        console.log(`  - ${item.name} (${item.sku}): ${quantity} unidades`);
      });
    });
    
    console.log(`📊 Total unidades Shopify: ${totalShopifyUnits}`);
    console.log(`📊 Productos únicos: ${productMap.size}`);
    
    // 2. Obtener datos locales de sales_metrics
    const { data: localMetrics, error: localError } = await supabase
      .from('sales_metrics')
      .select('*')
      .eq('metric_date', targetDate);
    
    if (localError) {
      throw new Error(`Error obteniendo métricas locales: ${localError.message}`);
    }
    
    const totalLocalUnits = localMetrics?.reduce((sum, metric) => sum + metric.sales_quantity, 0) || 0;
    const uniqueLocalVariants = localMetrics?.length || 0;
    
    console.log(`📊 Total unidades locales: ${totalLocalUnits}`);
    console.log(`📊 Variantes únicas locales: ${uniqueLocalVariants}`);
    
    // 3. Calcular discrepancias
    const unitDifference = totalLocalUnits - totalShopifyUnits;
    
    // 4. Análisis detallado por producto
    const productAnalysis = [];
    for (const [product, shopifyQty] of productMap) {
      const localMetric = localMetrics?.find(m => {
        // Buscar por SKU en product_variants
        return m.product_variant_id; // Aquí necesitaríamos hacer join, pero por ahora solo reportamos
      });
      
      productAnalysis.push({
        product,
        shopify_quantity: shopifyQty,
        local_quantity: localMetric?.sales_quantity || 0,
        difference: (localMetric?.sales_quantity || 0) - shopifyQty
      });
    }
    
    // 5. Generar reporte de diagnóstico
    const diagnosticResult: DiagnosticResult = {
      shopify_data: {
        orders_count: shopifyOrders.length,
        total_units: totalShopifyUnits,
        unique_products: productMap.size,
        orders: shopifyOrders.map(order => ({
          id: order.id,
          created_at: order.created_at,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          line_items: order.line_items.map(item => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            sku: item.sku,
            price: item.price,
            name: item.name
          }))
        }))
      },
      local_data: {
        metrics_count: uniqueLocalVariants,
        total_units: totalLocalUnits,
        unique_variants: uniqueLocalVariants,
        date_range: targetDate
      },
      discrepancies: {
        unit_difference: unitDifference,
        missing_orders: Math.max(0, shopifyOrders.length - (localMetrics?.length || 0)),
        duplicate_entries: Math.max(0, (localMetrics?.length || 0) - shopifyOrders.length)
      }
    };
    
    console.log('📋 Diagnóstico completado:');
    console.log(`  - Shopify: ${totalShopifyUnits} unidades en ${shopifyOrders.length} órdenes`);
    console.log(`  - Local: ${totalLocalUnits} unidades en ${uniqueLocalVariants} métricas`);
    console.log(`  - Diferencia: ${unitDifference} unidades`);
    
    return new Response(
      JSON.stringify({
        success: true,
        diagnostic: diagnosticResult,
        summary: {
          date: targetDate,
          shopify_units: totalShopifyUnits,
          local_units: totalLocalUnits,
          difference: unitDifference,
          accuracy_percentage: totalShopifyUnits > 0 ? 
            Math.round((totalShopifyUnits / Math.max(totalLocalUnits, 1)) * 100) : 0
        },
        product_analysis: productAnalysis,
        recommendations: unitDifference > 0 ? [
          'Hay duplicación de datos en la sincronización',
          'Revisar lógica de procesamiento de line_items',
          'Verificar filtros de estado financiero'
        ] : unitDifference < 0 ? [
          'Faltan datos en la sincronización',
          'Verificar rango de fechas',
          'Revisar filtros de órdenes'
        ] : [
          'Los datos están sincronizados correctamente'
        ]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error de diagnóstico: ${error.message}`,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
