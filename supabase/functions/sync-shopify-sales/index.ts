
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

interface SyncChunk {
  start_date: string;
  end_date: string;
  chunk_number: number;
  total_chunks: number;
}

// Helper function to add delay for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to format date for Shopify API
const formatShopifyDate = (date: Date): string => {
  return date.toISOString();
};

// Helper function to create date chunks for segmented sync
function createDateChunks(startDate: Date, endDate: Date, chunkSizeDays: number = 7): SyncChunk[] {
  const chunks: SyncChunk[] = [];
  let currentStart = new Date(startDate);
  let chunkNumber = 1;
  
  while (currentStart < endDate) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + chunkSizeDays);
    
    // Don't exceed the end date
    if (currentEnd > endDate) {
      currentEnd.setTime(endDate.getTime());
    }
    
    chunks.push({
      start_date: formatShopifyDate(currentStart),
      end_date: formatShopifyDate(currentEnd),
      chunk_number: chunkNumber,
      total_chunks: 0 // Will be set after all chunks are created
    });
    
    // Move to next chunk
    currentStart = new Date(currentEnd);
    currentStart.setSeconds(currentStart.getSeconds() + 1); // Avoid overlap
    chunkNumber++;
  }
  
  // Set total chunks for all
  chunks.forEach(chunk => chunk.total_chunks = chunks.length);
  return chunks;
}

// Helper function to fetch orders for a specific date chunk with robust pagination
async function fetchOrdersForChunk(
  shopifyDomain: string,
  shopifyToken: string,
  chunk: SyncChunk,
  validStatuses: string[],
  logId: string,
  supabase: any
): Promise<ShopifyOrder[]> {
  const allOrders: ShopifyOrder[] = [];
  let hasNextPage = true;
  let pageInfo = '';
  let pageCount = 0;
  const maxPages = 50; // Reduced for smaller chunks
  
  console.log(`🔄 Chunk ${chunk.chunk_number}/${chunk.total_chunks}: Sincronizando desde ${chunk.start_date} hasta ${chunk.end_date}`);
  
  while (hasNextPage && pageCount < maxPages) {
    pageCount++;
    
    // Construct URL with temporal pagination
    let ordersUrl = `https://${shopifyDomain}/admin/api/2025-07/orders.json?status=any&financial_status=${validStatuses.join(',')}&created_at_min=${encodeURIComponent(chunk.start_date)}&created_at_max=${encodeURIComponent(chunk.end_date)}&limit=50&fields=id,created_at,financial_status,line_items`;
    
    if (pageInfo) {
      ordersUrl += `&since_id=${pageInfo}`;
    }
    
    console.log(`📄 Chunk ${chunk.chunk_number}, Página ${pageCount}: Procesando desde orden ID ${pageInfo || 'inicio'}`);
    
    // Update progress in sync log
    await supabase
      .from('sync_control_logs')
      .update({ 
        execution_details: {
          currentChunk: chunk.chunk_number,
          totalChunks: chunk.total_chunks,
          currentPage: pageCount,
          totalProcessed: allOrders.length,
          status: 'processing_chunk',
          lastOrderId: pageInfo,
          currentDateRange: {
            from: chunk.start_date,
            to: chunk.end_date
          }
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
        console.error(`❌ Error en chunk ${chunk.chunk_number}, página ${pageCount}: ${response.status} - ${errorText}`);
        
        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const waitTime = Math.min(5000 * Math.pow(2, pageCount % 4), 30000);
          console.log(`⏳ Rate limit hit en chunk ${chunk.chunk_number}, esperando ${waitTime}ms...`);
          await delay(waitTime);
          pageCount--; // Retry same page
          continue;
        }
        
        throw new Error(`Error en chunk ${chunk.chunk_number}, página ${pageCount}: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const orders = data.orders || [];
      
      console.log(`📦 Chunk ${chunk.chunk_number}, Página ${pageCount}: ${orders.length} órdenes obtenidas`);
      
      if (orders.length === 0) {
        console.log(`✅ No más órdenes en chunk ${chunk.chunk_number}, página ${pageCount}`);
        hasNextPage = false;
        break;
      }
      
      // All orders should be within our date range since we're using created_at_min/max
      allOrders.push(...orders);
      
      // Determine if there are more pages
      if (orders.length < 50) {
        console.log(`✅ Última página de chunk ${chunk.chunk_number} alcanzada (${orders.length} < 50 órdenes)`);
        hasNextPage = false;
      } else {
        // Use the last order ID for pagination
        pageInfo = orders[orders.length - 1].id.toString();
        console.log(`➡️ Chunk ${chunk.chunk_number} continuando con orden ID: ${pageInfo}`);
      }
      
      // Rate limiting: wait between requests (longer for historical data)
      await delay(1000);
      
    } catch (error) {
      console.error(`❌ Error en chunk ${chunk.chunk_number}, página ${pageCount}:`, error);
      
      // Update sync log with error
      await supabase
        .from('sync_control_logs')
        .update({ 
          error_message: `Error en chunk ${chunk.chunk_number}, página ${pageCount}: ${error.message}`,
          execution_details: {
            currentChunk: chunk.chunk_number,
            totalChunks: chunk.total_chunks,
            currentPage: pageCount,
            totalProcessed: allOrders.length,
            status: 'error',
            lastOrderId: pageInfo,
            currentDateRange: {
              from: chunk.start_date,
              to: chunk.end_date
            }
          }
        })
        .eq('id', logId);
      
      throw error;
    }
  }
  
  console.log(`✅ Chunk ${chunk.chunk_number} completado: ${pageCount} páginas procesadas, ${allOrders.length} órdenes en el rango`);
  
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

    console.log(`🔄 Iniciando sincronización Shopify SEGMENTADA - Modo: ${mode}, Días: ${days}, Programado: ${scheduled}`);

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
          segmented_sync: true,
          rate_limiting: true,
          version: '4.0-segmented',
          target_days: days
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

    // Calculate date range for sync
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0); // Start from beginning of day
    
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999); // End at end of current day

    console.log(`📅 SEGMENTADO: Obteniendo órdenes desde: ${startDate.toISOString()} hasta ${endDate.toISOString()} (${days} días - modo ${mode})`);
    console.log(`🏪 Shopify Store: ${shopifyDomain}`);

    // Create date chunks for segmented sync
    const chunkSizeDays = mode === 'initial' ? 7 : (mode === 'monthly' ? 10 : 3); // Smaller chunks for initial sync
    const dateChunks = createDateChunks(startDate, endDate, chunkSizeDays);
    
    console.log(`📊 Creados ${dateChunks.length} chunks de ${chunkSizeDays} días cada uno`);

    // Get orders with financial status filter to exclude cancelled/refunded orders
    const validStatuses = ['paid', 'partially_paid'];
    
    let allOrders: ShopifyOrder[] = [];
    
    // Process each chunk sequentially
    for (const chunk of dateChunks) {
      try {
        console.log(`🔄 Procesando chunk ${chunk.chunk_number}/${chunk.total_chunks}: ${chunk.start_date} a ${chunk.end_date}`);
        
        const chunkOrders = await fetchOrdersForChunk(
          shopifyDomain,
          shopifyToken,
          chunk,
          validStatuses,
          logId,
          supabase
        );
        
        allOrders.push(...chunkOrders);
        
        console.log(`✅ Chunk ${chunk.chunk_number} completado: ${chunkOrders.length} órdenes obtenidas`);
        
        // Longer delay between chunks to respect rate limits
        if (chunk.chunk_number < chunk.total_chunks) {
          console.log(`⏳ Esperando 3 segundos antes del siguiente chunk...`);
          await delay(3000);
        }
        
      } catch (error) {
        console.error(`❌ Error procesando chunk ${chunk.chunk_number}:`, error);
        throw new Error(`Error en chunk ${chunk.chunk_number}: ${error.message}`);
      }
    }
    
    console.log(`📦 TOTAL SEGMENTADO obtenidas ${allOrders.length} órdenes válidas de ${dateChunks.length} chunks`);
    
    if (allOrders.length > 0) {
      // Sort orders by date to verify coverage
      allOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      console.log(`📊 Primera orden: ${allOrders[0]?.created_at}, Última: ${allOrders[allOrders.length-1]?.created_at}`);
      
      // Calculate actual days covered
      const firstOrderDate = new Date(allOrders[0]?.created_at);
      const lastOrderDate = new Date(allOrders[allOrders.length-1]?.created_at);
      const daysCovered = Math.ceil((lastOrderDate.getTime() - firstOrderDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      console.log(`📊 Días realmente cubiertos: ${daysCovered} días de ${days} solicitados`);
    }

    // Update sync log with orders count
    await supabase
      .from('sync_control_logs')
      .update({ 
        orders_processed: allOrders.length,
        execution_details: {
          segmented_sync: true,
          rate_limiting: true,
          version: '4.0-segmented',
          target_days: days,
          chunks_processed: dateChunks.length,
          total_orders_found: allOrders.length,
          status: 'processing_orders',
          date_range: {
            from: startDate.toISOString(),
            to: endDate.toISOString()
          }
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
    const dateMetrics = new Map(); // Track sales by date

    allOrders.forEach((order, index) => {
      // Skip orders with invalid financial status (additional safety check)
      if (!validStatuses.includes(order.financial_status)) {
        console.log(`⚠️ Orden ${order.id} omitida por estado financiero: ${order.financial_status}`);
        return;
      }

      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      
      // Track dates for verification
      if (!dateMetrics.has(orderDate)) {
        dateMetrics.set(orderDate, 0);
      }
      dateMetrics.set(orderDate, dateMetrics.get(orderDate) + 1);
      
      // Progress logging every 100 orders
      if (index % 100 === 0) {
        console.log(`🔄 Procesando orden ${index + 1}/${allOrders.length}: ${order.id} del ${orderDate}`);
      }
      
      order.line_items.forEach(item => {
        if (!item.sku) {
          skippedItems++;
          return;
        }
        
        const localVariantId = skuToVariantMap.get(item.sku);
        if (!localVariantId) {
          // Only log first few SKU misses to avoid spam
          if (skippedItems < 10) {
            console.log(`⚠️ SKU no encontrado en sistema local: ${item.sku}`);
          }
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
    console.log(`📅 Fechas únicas procesadas: ${dateMetrics.size} días`);
    
    // Log date coverage
    const sortedDates = Array.from(dateMetrics.keys()).sort();
    if (sortedDates.length > 0) {
      console.log(`📊 Rango de fechas procesadas: ${sortedDates[0]} a ${sortedDates[sortedDates.length-1]}`);
    }

    // Clean existing metrics for the specific period only
    const deleteStartDate = startDate.toISOString().split('T')[0];
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
      // Insert in batches to avoid large queries
      const batchSize = 500;
      for (let i = 0; i < salesMetrics.length; i += batchSize) {
        const batch = salesMetrics.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('sales_metrics')
          .insert(batch);

        if (insertError) {
          throw new Error(`Error al insertar métricas de ventas (lote ${i/batchSize + 1}): ${insertError.message}`);
        }
        
        console.log(`✅ Insertado lote ${i/batchSize + 1}/${Math.ceil(salesMetrics.length/batchSize)}: ${batch.length} métricas`);
      }

      console.log(`✅ Insertadas ${salesMetrics.length} métricas de ventas en total`);
      
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
      actual_days_covered: dateMetrics.size,
      chunks_processed: dateChunks.length,
      shopify_orders_processed: allOrders.length,
      items_processed: processedItems,
      items_skipped: skippedItems,
      unique_variants_with_sales: uniqueVariants,
      total_sales_quantity: totalSalesQuantity,
      total_orders_processed: totalOrders,
      metrics_created: salesMetrics.length,
      variants_updated: variantsUpdated,
      segmented_sync: true,
      date_range_verified: {
        requested_days: days,
        actual_days: dateMetrics.size,
        coverage_percentage: Math.round((dateMetrics.size / days) * 100),
        oldest_order: sortedDates.length > 0 ? sortedDates[0] : null,
        newest_order: sortedDates.length > 0 ? sortedDates[sortedDates.length-1] : null,
        date_gaps: days - dateMetrics.size
      },
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

    console.log('📋 Resumen de sincronización SEGMENTADA COMPLETA:', JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronización de ventas Shopify SEGMENTADA completada - Modo: ${mode} - ${dateMetrics.size}/${days} días procesados (${Math.round((dateMetrics.size / days) * 100)}% cobertura)`,
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
