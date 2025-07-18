
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

interface ShopifyOrder {
  id: number;
  created_at: string;
  financial_status: string;
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
    inventory_quantity: number;
  }>;
}

interface SyncProgress {
  totalPages: number;
  currentPage: number;
  totalOrders: number;
  processedOrders: number;
  lastOrderId?: string;
}

// Helper function to add delay for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to make paginated Shopify API calls
async function fetchAllShopifyOrders(
  shopifyDomain: string,
  shopifyToken: string,
  dateFilter: string,
  validStatuses: string[],
  logId: string,
  supabase: any
): Promise<ShopifyOrder[]> {
  const allOrders: ShopifyOrder[] = [];
  let hasNextPage = true;
  let pageInfo = '';
  let pageCount = 0;
  const maxPages = 50; // Safety limit to prevent infinite loops
  
  console.log(`🔄 Iniciando paginación de órdenes desde: ${dateFilter}`);
  
  while (hasNextPage && pageCount < maxPages) {
    pageCount++;
    
    // Construct URL with pagination
    let ordersUrl = `https://${shopifyDomain}/admin/api/2025-07/orders.json?status=any&financial_status=${validStatuses.join(',')}&created_at_min=${dateFilter}&limit=250&fields=id,created_at,financial_status,line_items`;
    
    if (pageInfo) {
      ordersUrl += `&since_id=${pageInfo}`;
    }
    
    console.log(`📄 Página ${pageCount}: ${ordersUrl}`);
    
    // Update progress in sync log
    await supabase
      .from('sync_control_logs')
      .update({ 
        execution_details: {
          currentPage: pageCount,
          totalProcessed: allOrders.length,
          status: 'paginating'
        }
      })
      .eq('id', logId);
    
    try {
      const response = await fetch(ordersUrl, {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Error en página ${pageCount}: ${response.status} - ${errorText}`);
        
        // Handle rate limiting
        if (response.status === 429) {
          console.log('⏳ Rate limit hit, esperando 2 segundos...');
          await delay(2000);
          continue; // Retry same page
        }
        
        throw new Error(`Error en página ${pageCount}: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const orders = data.orders || [];
      
      console.log(`📦 Página ${pageCount}: ${orders.length} órdenes obtenidas`);
      
      if (orders.length === 0) {
        hasNextPage = false;
        break;
      }
      
      allOrders.push(...orders);
      
      // Determine if there are more pages
      if (orders.length < 250) {
        hasNextPage = false;
      } else {
        // Use the last order ID for pagination
        pageInfo = orders[orders.length - 1].id.toString();
      }
      
      // Rate limiting: wait 500ms between requests
      await delay(500);
      
    } catch (error) {
      console.error(`❌ Error en paginación página ${pageCount}:`, error);
      
      // Update sync log with error
      await supabase
        .from('sync_control_logs')
        .update({ 
          error_message: `Error en paginación página ${pageCount}: ${error.message}`,
          execution_details: {
            currentPage: pageCount,
            totalProcessed: allOrders.length,
            status: 'error'
          }
        })
        .eq('id', logId);
      
      throw error;
    }
  }
  
  console.log(`✅ Paginación completada: ${pageCount} páginas, ${allOrders.length} órdenes totales`);
  return allOrders;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let logId: string | null = null;

  try {
    // Parse request body to get sync parameters
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'initial'; // 'initial', 'daily', 'monthly'
    const days = body.days || 90; // Default to 90 days for initial sync
    const scheduled = body.scheduled || false;

    console.log(`🔄 Iniciando sincronización Shopify MEJORADA - Modo: ${mode}, Días: ${days}, Programado: ${scheduled}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')!;
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')!;
    
    if (!shopifyDomain || !shopifyToken) {
      throw new Error('Faltan credenciales de Shopify (SHOPIFY_STORE_DOMAIN y SHOPIFY_ACCESS_TOKEN)');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if there's already a sync in progress for this type
    const { data: syncInProgress } = await supabase.rpc('is_sync_in_progress', {
      sync_type_param: mode,
      sync_mode_param: 'sales'
    });

    if (syncInProgress) {
      console.log(`⚠️ Sincronización ya en progreso para modo: ${mode}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Sincronización ya en progreso para modo: ${mode}`,
          mode,
          days
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create sync control log entry
    const { data: logEntry, error: logError } = await supabase
      .from('sync_control_logs')
      .insert({
        sync_type: mode,
        sync_mode: 'sales',
        status: 'running',
        days_processed: days,
        execution_details: {
          pagination_enabled: true,
          rate_limiting: true,
          version: '2.0'
        }
      })
      .select()
      .single();

    if (logError) {
      console.error('❌ Error creando log de sincronización:', logError);
      throw logError;
    }

    logId = logEntry.id;
    console.log(`📝 Log de sincronización creado: ${logId}`);

    // Calculate date filter based on mode
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    const dateFilter = targetDate.toISOString();

    console.log(`📅 Obteniendo órdenes desde: ${dateFilter} (${days} días - modo ${mode})`);
    console.log(`🏪 Shopify Store: ${shopifyDomain}`);

    // Get orders with financial status filter to exclude cancelled/refunded orders
    const validStatuses = ['paid', 'partially_paid'];
    
    // Use the new paginated function to get ALL orders
    const orders = await fetchAllShopifyOrders(
      shopifyDomain,
      shopifyToken,
      dateFilter,
      validStatuses,
      logId,
      supabase
    );
    
    console.log(`📦 TOTAL obtenidas ${orders.length} órdenes válidas con paginación completa`);
    if (orders.length > 0) {
      console.log(`📊 Primera orden: ${orders[0]?.created_at}, Última: ${orders[orders.length-1]?.created_at}`);
    }

    // Update sync log with orders count
    await supabase
      .from('sync_control_logs')
      .update({ 
        orders_processed: orders.length,
        execution_details: {
          pagination_enabled: true,
          rate_limiting: true,
          version: '2.0',
          total_orders_found: orders.length,
          status: 'processing_orders'
        }
      })
      .eq('id', logId);

    // Get mapping from Shopify SKUs to local variants
    const { data: localVariants, error: variantsError } = await supabase
      .from('product_variants')
      .select('id, sku_variant')
      .not('sku_variant', 'is', null);

    if (variantsError) {
      throw new Error(`Error al obtener variantes locales: ${variantsError.message}`);
    }

    // Create SKU -> variant_id local map
    const skuToVariantMap = new Map();
    localVariants.forEach(variant => {
      skuToVariantMap.set(variant.sku_variant, variant.id);
    });

    console.log(`🔗 Mapeo creado para ${skuToVariantMap.size} SKUs locales`);

    // Process orders and group sales by variant and date
    const salesByVariantAndDate = new Map();
    let processedItems = 0;
    let skippedItems = 0;

    orders.forEach((order, index) => {
      // Skip orders with invalid financial status (additional safety check)
      if (!validStatuses.includes(order.financial_status)) {
        console.log(`⚠️ Orden ${order.id} omitida por estado financiero: ${order.financial_status}`);
        return;
      }

      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      
      // Progress logging every 100 orders
      if (index % 100 === 0) {
        console.log(`🔄 Procesando orden ${index + 1}/${orders.length}: ${order.id} del ${orderDate}`);
      }
      
      order.line_items.forEach(item => {
        if (!item.sku) {
          skippedItems++;
          return;
        }
        
        const localVariantId = skuToVariantMap.get(item.sku);
        if (!localVariantId) {
          console.log(`⚠️ SKU no encontrado en sistema local: ${item.sku}`);
          skippedItems++;
          return;
        }
        
        processedItems++;

        const key = `${localVariantId}_${orderDate}`;
        
        if (!salesByVariantAndDate.has(key)) {
          salesByVariantAndDate.set(key, {
            product_variant_id: localVariantId,
            metric_date: orderDate,
            sales_quantity: 0,
            orders_count: 0,
            avg_order_size: 0
          });
        }

        const salesData = salesByVariantAndDate.get(key);
        salesData.sales_quantity += item.quantity;
        salesData.orders_count += 1;
        salesData.avg_order_size = (salesData.avg_order_size * (salesData.orders_count - 1) + parseFloat(item.price) * item.quantity) / salesData.orders_count;
      });
    });

    console.log(`📊 Procesados ${processedItems} items, omitidos ${skippedItems} items`);
    console.log(`📊 Generadas ${salesByVariantAndDate.size} métricas de ventas únicas`);

    // Clean existing metrics for the specific period only (selective cleaning based on mode)
    const deleteStartDate = targetDate.toISOString().split('T')[0];
    const { error: deleteError } = await supabase
      .from('sales_metrics')
      .delete()
      .gte('metric_date', deleteStartDate);

    if (deleteError) {
      console.error('⚠️ Error al limpiar métricas anteriores:', deleteError);
    } else {
      console.log(`🧹 Limpiadas métricas existentes desde ${deleteStartDate}`);
    }

    // Insert new sales metrics
    const salesMetrics = Array.from(salesByVariantAndDate.values());
    let variantsUpdated = 0;
    
    if (salesMetrics.length > 0) {
      const { error: insertError } = await supabase
        .from('sales_metrics')
        .insert(salesMetrics);

      if (insertError) {
        throw new Error(`Error al insertar métricas de ventas: ${insertError.message}`);
      }

      console.log(`✅ Insertadas ${salesMetrics.length} métricas de ventas`);
      
      // Sync current stock from Shopify (only for daily and monthly modes)
      if (mode !== 'initial') {
        console.log('🔄 Sincronizando stock actual desde Shopify...');
        
        const productsUrl = `https://${shopifyDomain}/admin/api/2025-07/products.json?limit=250`;
        
        const productsResponse = await fetch(productsUrl, {
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
        });

        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          const products = productsData.products || [];
          
          // Update stock of local variants with Shopify data
          for (const product of products) {
            for (const variant of product.variants) {
              if (!variant.sku) continue;
              
              const localVariantId = skuToVariantMap.get(variant.sku);
              if (!localVariantId) continue;
              
              const shopifyStock = variant.inventory_quantity || 0;
              
              // Update stock in local database
              const { error: updateError } = await supabase
                .from('product_variants')
                .update({ stock_quantity: shopifyStock })
                .eq('id', localVariantId);
              
              if (updateError) {
                console.error(`⚠️ Error actualizando stock para SKU ${variant.sku}:`, updateError.message);
              } else {
                variantsUpdated++;
              }
            }
          }
          
          console.log(`✅ Sincronización de stock completada - ${variantsUpdated} variantes actualizadas`);
        } else {
          console.log('⚠️ No se pudo obtener información de productos para sincronizar stock');
        }
      }
    }

    // Generate process statistics
    const totalSalesQuantity = salesMetrics.reduce((sum, metric) => sum + metric.sales_quantity, 0);
    const totalOrders = salesMetrics.reduce((sum, metric) => sum + metric.orders_count, 0);
    const uniqueVariants = new Set(salesMetrics.map(m => m.product_variant_id)).size;

    const summary = {
      sync_date: new Date().toISOString(),
      mode,
      period_days: days,
      shopify_orders_processed: orders.length,
      items_processed: processedItems,
      items_skipped: skippedItems,
      unique_variants_with_sales: uniqueVariants,
      total_sales_quantity: totalSalesQuantity,
      total_orders_processed: totalOrders,
      metrics_created: salesMetrics.length,
      variants_updated: variantsUpdated,
      pagination_used: true,
      status: 'completed'
    };

    // Update sync log with completion
    await supabase
      .from('sync_control_logs')
      .update({
        status: 'completed',
        end_time: new Date().toISOString(),
        variants_updated: variantsUpdated,
        metrics_created: salesMetrics.length,
        execution_details: summary
      })
      .eq('id', logId);

    console.log('📋 Resumen de sincronización COMPLETA:', JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronización de ventas Shopify completada con paginación - Modo: ${mode}`,
        summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Error en sincronización de ventas de Shopify:', error);
    
    // Update sync log with error if we have logId
    if (logId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase
        .from('sync_control_logs')
        .update({
          status: 'failed',
          end_time: new Date().toISOString(),
          error_message: error.message
        })
        .eq('id', logId);
    }
    
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
