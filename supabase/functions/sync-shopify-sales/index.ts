
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
  }>;
}

interface SyncChunk {
  start_date: string;
  end_date: string;
  chunk_number: number;
  total_chunks: number;
}

// Helper function to validate environment variables
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

// Helper function to add delay for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to format date for Shopify API
const formatShopifyDate = (date: Date): string => {
  return date.toISOString();
};

// Helper function to create date chunks for segmented sync
function createDateChunks(startDate: Date, endDate: Date, chunkSizeDays: number = 5): SyncChunk[] {
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

// Helper function to fetch orders for a specific date chunk with improved precision
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
  const maxPages = 30;
  
  // Status tracking for debugging
  const statusCounts = new Map<string, number>();
  const fulfillmentStatusCounts = new Map<string, number>();
  
  console.log(`🔄 Chunk ${chunk.chunk_number}/${chunk.total_chunks}: Sincronizando desde ${chunk.start_date} hasta ${chunk.end_date}`);
  
  while (hasNextPage && pageCount < maxPages) {
    pageCount++;
    
    try {
      // Construct URL with improved filtering
      let ordersUrl = `https://${shopifyDomain}/admin/api/2025-07/orders.json?status=any&created_at_min=${encodeURIComponent(chunk.start_date)}&created_at_max=${encodeURIComponent(chunk.end_date)}&limit=50&fields=id,created_at,financial_status,fulfillment_status,line_items`;
      
      if (pageInfo) {
        ordersUrl += `&since_id=${pageInfo}`;
      }
      
      console.log(`📄 Chunk ${chunk.chunk_number}, Página ${pageCount}: Fetching orders...`);
      
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
          const waitTime = Math.min(10000 * Math.pow(2, pageCount % 3), 60000);
          console.log(`⏳ Rate limit hit en chunk ${chunk.chunk_number}, esperando ${waitTime}ms...`);
          await delay(waitTime);
          pageCount--; // Retry same page
          continue;
        }
        
        throw new Error(`Shopify API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const orders = data.orders || [];
      
      console.log(`📦 Chunk ${chunk.chunk_number}, Página ${pageCount}: ${orders.length} órdenes obtenidas`);
      
      if (orders.length === 0) {
        console.log(`✅ No más órdenes en chunk ${chunk.chunk_number}, página ${pageCount}`);
        hasNextPage = false;
        break;
      }
      
      // Track all financial and fulfillment statuses we encounter
      orders.forEach(order => {
        const finStatus = order.financial_status || 'unknown';
        const fulfillStatus = order.fulfillment_status || 'unfulfilled';
        
        statusCounts.set(finStatus, (statusCounts.get(finStatus) || 0) + 1);
        fulfillmentStatusCounts.set(fulfillStatus, (fulfillmentStatusCounts.get(fulfillStatus) || 0) + 1);
      });
      
      // Filter orders AFTER fetching to understand what we're excluding
      const validOrders = orders.filter(order => validStatuses.includes(order.financial_status));
      const excludedCount = orders.length - validOrders.length;
      
      if (excludedCount > 0) {
        console.log(`⚠️ Chunk ${chunk.chunk_number}, Página ${pageCount}: Excluidas ${excludedCount} órdenes por estado financiero`);
      }
      
      allOrders.push(...validOrders);
      
      // Determine if there are more pages
      if (orders.length < 50) {
        console.log(`✅ Última página de chunk ${chunk.chunk_number} alcanzada (${orders.length} < 50 órdenes)`);
        hasNextPage = false;
      } else {
        // Use the last order ID for pagination
        pageInfo = orders[orders.length - 1].id.toString();
        console.log(`➡️ Chunk ${chunk.chunk_number} continuando con orden ID: ${pageInfo}`);
      }
      
      // Rate limiting: wait between requests
      await delay(2000); // Increased delay for stability
      
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
  
  // Log status distribution for this chunk
  console.log(`📊 Chunk ${chunk.chunk_number} - Estados financieros encontrados:`, Object.fromEntries(statusCounts));
  console.log(`📊 Chunk ${chunk.chunk_number} - Estados de fulfillment encontrados:`, Object.fromEntries(fulfillmentStatusCounts));
  console.log(`✅ Chunk ${chunk.chunk_number} completado: ${pageCount} páginas procesadas, ${allOrders.length} órdenes válidas de un total procesado`);
  
  return allOrders;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let logId: string | null = null;

  try {
    console.log('🔄 Iniciando sincronización Shopify CORREGIDA con validación de precisión...');
    
    // Validate environment variables first
    const env = validateEnvironment();
    console.log(`✅ Variables de entorno validadas correctamente`);
    console.log(`🏪 Shopify Store: ${env.shopifyDomain}`);

    // Parse request body to get sync parameters
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'initial'; // 'initial', 'daily', 'monthly'
    const days = body.days || 90; // Default to 90 days for initial sync
    const scheduled = body.scheduled || false;

    console.log(`🔄 Modo: ${mode}, Días: ${days}, Programado: ${scheduled}`);

    const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);

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
          version: '6.2-precision-fix',
          target_days: days,
          precision_tracking: true,
          improved_quantity_handling: true
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

    console.log(`📅 CORREGIDA: Obteniendo órdenes desde: ${startDate.toISOString()} hasta ${endDate.toISOString()} (${days} días - modo ${mode})`);

    // Create date chunks for segmented sync
    const chunkSizeDays = mode === 'initial' ? 5 : (mode === 'monthly' ? 7 : 3);
    const dateChunks = createDateChunks(startDate, endDate, chunkSizeDays);
    
    console.log(`📊 Creados ${dateChunks.length} chunks de ${chunkSizeDays} días cada uno`);

    // CORRECTED FINANCIAL STATUSES - More restrictive to avoid duplicates
    const validStatuses = [
      'paid',              // Only fully paid orders
      'partially_paid',    // Partially paid orders
      'authorized'         // Authorized but not captured
      // Removed: 'pending', 'partially_refunded' to avoid over-counting
    ];
    
    console.log(`💰 Estados financieros CORREGIDOS (más restrictivos): ${validStatuses.join(', ')}`);
    
    let allOrders: ShopifyOrder[] = [];
    const statusSummary = new Map<string, number>();
    const fulfillmentSummary = new Map<string, number>();
    
    // Process each chunk sequentially with error recovery
    for (const chunk of dateChunks) {
      try {
        console.log(`🔄 Procesando chunk ${chunk.chunk_number}/${chunk.total_chunks}: ${chunk.start_date} a ${chunk.end_date}`);
        
        const chunkOrders = await fetchOrdersForChunk(
          env.shopifyDomain,
          env.shopifyToken,
          chunk,
          validStatuses,
          logId,
          supabase
        );
        
        allOrders.push(...chunkOrders);
        
        console.log(`✅ Chunk ${chunk.chunk_number} completado: ${chunkOrders.length} órdenes válidas obtenidas`);
        
        // Longer delay between chunks to respect rate limits
        if (chunk.chunk_number < chunk.total_chunks) {
          console.log(`⏳ Esperando 5 segundos antes del siguiente chunk...`);
          await delay(5000);
        }
        
      } catch (error) {
        console.error(`❌ Error procesando chunk ${chunk.chunk_number}:`, error);
        
        // Continue with other chunks instead of failing completely
        await supabase
          .from('sync_control_logs')
          .update({ 
            error_message: `Error en chunk ${chunk.chunk_number}: ${error.message}. Continuando con otros chunks.`,
            execution_details: {
              currentChunk: chunk.chunk_number,
              totalChunks: chunk.total_chunks,
              status: 'chunk_error_recovered',
              failed_chunk: chunk.chunk_number
            }
          })
          .eq('id', logId);
          
        console.log(`⚠️ Continuando con el siguiente chunk después del error en chunk ${chunk.chunk_number}`);
      }
    }
    
    console.log(`📦 TOTAL CORREGIDO obtenidas ${allOrders.length} órdenes válidas de ${dateChunks.length} chunks`);
    
    // Calculate requested date range for coverage calculation
    const requestedStartDate = new Date(startDate);
    const requestedEndDate = new Date(endDate);
    const requestedDays = Math.ceil((requestedEndDate.getTime() - requestedStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let daysWithOrders = 0;
    let daysWithoutOrders = requestedDays;
    
    if (allOrders.length > 0) {
      // Sort orders by date to verify coverage
      allOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      console.log(`📊 Primera orden: ${allOrders[0]?.created_at}, Última: ${allOrders[allOrders.length-1]?.created_at}`);
      
      // Calculate unique dates with orders
      const uniqueOrderDates = new Set();
      allOrders.forEach(order => {
        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        uniqueOrderDates.add(orderDate);
      });
      
      daysWithOrders = uniqueOrderDates.size;
      daysWithoutOrders = requestedDays - daysWithOrders;
      
      console.log(`📊 Días solicitados: ${requestedDays}, Días con órdenes: ${daysWithOrders}, Días sin órdenes: ${daysWithoutOrders}`);
      
      // Track order statuses for final summary
      allOrders.forEach(order => {
        const finStatus = order.financial_status || 'unknown';
        const fulfillStatus = order.fulfillment_status || 'unfulfilled';
        
        statusSummary.set(finStatus, (statusSummary.get(finStatus) || 0) + 1);
        fulfillmentSummary.set(fulfillStatus, (fulfillmentSummary.get(fulfillStatus) || 0) + 1);
      });
      
      console.log(`📊 RESUMEN FINAL DE ESTADOS FINANCIEROS:`, Object.fromEntries(statusSummary));
      console.log(`📊 RESUMEN FINAL DE ESTADOS DE FULFILLMENT:`, Object.fromEntries(fulfillmentSummary));
    }

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

    // Process orders and group sales by variant and date - FIXED ORDER COUNTING
    const salesByVariantAndDate = new Map();
    let processedItems = 0;
    let skippedItems = 0;
    const dateMetrics = new Map();
    
    // Debugging: Track quantity processing
    let totalQuantityProcessed = 0;
    const quantityByDate = new Map();
    
    // CRITICAL FIX: Track unique orders per variant+date to fix orders_count bug
    const uniqueOrdersPerVariantDate = new Map(); // key: variant_date, value: Set of order IDs

    allOrders.forEach((order, index) => {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      
      // Track dates for verification
      if (!dateMetrics.has(orderDate)) {
        dateMetrics.set(orderDate, 0);
      }
      dateMetrics.set(orderDate, dateMetrics.get(orderDate) + 1);
      
      // Progress logging every 100 orders
      if (index % 100 === 0) {
        console.log(`🔄 Procesando orden ${index + 1}/${allOrders.length}: ${order.id} del ${orderDate} (${order.financial_status})`);
      }
      
      // IMPROVED: Process line items with better precision
      order.line_items.forEach(item => {
        if (!item.sku) {
          console.log(`⚠️ Item sin SKU en orden ${order.id}: ${item.product_id}`);
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
        
        // CRITICAL: Ensure we're using integer quantities, not strings
        const quantity = parseInt(item.quantity.toString(), 10);
        if (isNaN(quantity) || quantity <= 0) {
          console.log(`⚠️ Cantidad inválida en orden ${order.id}, item ${item.sku}: ${item.quantity}`);
          skippedItems++;
          return;
        }
        
        processedItems++;
        totalQuantityProcessed += quantity;
        
        // Track quantity by date for debugging
        if (!quantityByDate.has(orderDate)) {
          quantityByDate.set(orderDate, 0);
        }
        quantityByDate.set(orderDate, quantityByDate.get(orderDate) + quantity);

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
        
        // CRITICAL FIX: Track unique orders for this variant+date combination
        if (!uniqueOrdersPerVariantDate.has(key)) {
          uniqueOrdersPerVariantDate.set(key, new Set());
        }
        
        const salesData = salesByVariantAndDate.get(key);
        salesData.sales_quantity += quantity;
        
        // FIXED: Only increment orders_count if this order hasn't been counted for this variant+date
        const orderSet = uniqueOrdersPerVariantDate.get(key);
        if (!orderSet.has(order.id)) {
          orderSet.add(order.id);
          salesData.orders_count += 1;
        }
        
        // Recalculate average order size based on total revenue / unique orders
        const totalRevenue = parseFloat(item.price) * quantity;
        if (salesData.orders_count > 0) {
          // This is an approximation - we're adding this item's revenue to average
          const currentTotalRevenue = salesData.avg_order_size * (salesData.orders_count - 1);
          salesData.avg_order_size = (currentTotalRevenue + totalRevenue) / salesData.orders_count;
        }
      });
    });

    console.log(`📊 CORRECCIÓN: Procesados ${processedItems} items, omitidos ${skippedItems} items`);
    console.log(`📊 CORRECCIÓN: Cantidad total procesada: ${totalQuantityProcessed} unidades`);
    console.log(`📊 CORRECCIÓN: Generadas ${salesByVariantAndDate.size} métricas de ventas únicas`);
    console.log(`📅 CORRECCIÓN: Fechas únicas procesadas: ${dateMetrics.size} días`);
    
    // Log quantity by date for debugging
    console.log(`📊 CORRECCIÓN: Unidades por fecha:`, Object.fromEntries(quantityByDate));
    
    // Log date coverage
    const sortedDates = Array.from(dateMetrics.keys()).sort();
    if (sortedDates.length > 0) {
      console.log(`📊 CORRECCIÓN: Rango de fechas procesadas: ${sortedDates[0]} a ${sortedDates[sortedDates.length-1]}`);
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
        
        const productsUrl = `https://${env.shopifyDomain}/admin/api/2025-07/products.json?limit=250`;
        
        const productsResponse = await fetch(productsUrl, {
          headers: {
            'X-Shopify-Access-Token': env.shopifyToken,
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
      precision_improvements: {
        stricter_financial_status_filtering: true,
        improved_quantity_parsing: true,
        better_date_handling: true,
        debugging_enabled: true
      },
      financial_status_breakdown: Object.fromEntries(statusSummary),
      fulfillment_status_breakdown: Object.fromEntries(fulfillmentSummary),
      date_range_verified: {
        requested_days: requestedDays,
        actual_days: daysWithOrders,
        coverage_percentage: Math.round((daysWithOrders / requestedDays) * 100),
        oldest_order: sortedDates.length > 0 ? sortedDates[0] : null,
        newest_order: sortedDates.length > 0 ? sortedDates[sortedDates.length-1] : null,
        date_gaps: daysWithoutOrders
      },
      quantity_verification: {
        total_quantity_processed: totalQuantityProcessed,
        quantity_by_date: Object.fromEntries(quantityByDate)
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

    console.log('📋 Resumen de sincronización CORREGIDA COMPLETA:', JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Sincronización CORREGIDA completada - Modo: ${mode} - ${allOrders.length} órdenes procesadas - ${totalQuantityProcessed} unidades totales - ${dateMetrics.size}/${days} días cubiertos (${Math.round((dateMetrics.size / days) * 100)}% cobertura)`,
        summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Error en sincronización corregida:', error);
    
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
        error: `Error de sincronización: ${error.message}`,
        timestamp: new Date().toISOString(),
        troubleshooting: {
          environment_check: 'Verificar que todas las variables de entorno estén configuradas',
          shopify_access: 'Confirmar que el token de Shopify tenga permisos de lectura de órdenes',
          network: 'Verificar conectividad con Shopify API',
          precision_fix: 'Esta versión incluye correcciones de precisión en el procesamiento de cantidades'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
