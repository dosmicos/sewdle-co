import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

// Function to determine automatic tags based on payment gateway and line items
function determineAutoTags(rawData: unknown): string[] {
  const tags: string[] = [];
  
  const paymentGateways = rawData?.payment_gateway_names || [];
  
  // Payment gateway rules for "Confirmado" tag
  if (paymentGateways.some((gw: string) => gw === 'Addi Payment')) {
    tags.push('Confirmado');
  }
  if (paymentGateways.some((gw: string) => gw.toLowerCase().includes('bold'))) {
    tags.push('Confirmado');
  }
  if (paymentGateways.some((gw: string) => gw.toLowerCase().includes('mercado pago'))) {
    tags.push('Confirmado');
  }
  if (paymentGateways.some((gw: string) => gw.toLowerCase() === 'manual')) {
    tags.push('Confirmado');
  }
  
  // Payment gateway rule for "Contraentrega" tag
  // ONLY apply if order is NOT already paid (prevents re-adding after manual removal)
  const financialStatus = rawData?.financial_status || '';
  if (paymentGateways.some((gw: string) => gw === 'Cash on Delivery (COD)')) {
    if (financialStatus !== 'paid') {
      tags.push('Contraentrega');
    }
  }
  
  // Line items rule for "BORDADO" tag
  const lineItems = rawData?.line_items || [];
  const hasBordado = lineItems.some((item: unknown) => 
    item.title?.toLowerCase().includes('bordado') || 
    item.name?.toLowerCase().includes('bordado')
  );
  
  if (hasBordado) {
    tags.push('BORDADO');
  }
  
  return [...new Set(tags)];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    if (!shopifyAccessToken) {
      return new Response(
        JSON.stringify({ error: 'SHOPIFY_ACCESS_TOKEN no configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Buscando órdenes sin tags que deberían tenerlos...');

    // Obtener la organización con Shopify configurado
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, shopify_store_url')
      .not('shopify_store_url', 'is', null)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: 'No se encontró organización con Shopify configurado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const shopDomain = org.shopify_store_url.replace('https://', '').replace('http://', '');
    console.log(`🏪 Shop domain: ${shopDomain}`);

    // Buscar órdenes con tags NULL o vacíos que tengan raw_data
    const { data: ordersWithoutTags, error: ordersError } = await supabase
      .from('shopify_orders')
      .select('shopify_order_id, order_number, tags, raw_data')
      .eq('organization_id', org.id)
      .or('tags.is.null,tags.eq.')
      .not('raw_data', 'is', null)
      .order('created_at_shopify', { ascending: false })
      .limit(100);

    if (ordersError) {
      console.error('❌ Error buscando órdenes:', ordersError);
      return new Response(
        JSON.stringify({ error: ordersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontradas ${ordersWithoutTags?.length || 0} órdenes sin tags`);

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [] as unknown[]
    };

    for (const order of ordersWithoutTags || []) {
      results.processed++;
      
      try {
        const autoTags = determineAutoTags(order.raw_data);
        
        if (autoTags.length === 0) {
          console.log(`⏭️ Orden ${order.order_number}: No se detectaron tags automáticos`);
          results.skipped++;
          results.details.push({
            order_number: order.order_number,
            status: 'skipped',
            reason: 'No auto-tags detected'
          });
          continue;
        }

        const tagsString = autoTags.join(', ');
        console.log(`🏷️ Orden ${order.order_number}: Aplicando tags [${tagsString}]`);

        // ✅ PRIMERO: Actualizar base de datos local
        const { error: dbError } = await supabase
          .from('shopify_orders')
          .update({ tags: tagsString })
          .eq('shopify_order_id', order.shopify_order_id);

        if (dbError) {
          console.error(`❌ Error actualizando DB para ${order.order_number}:`, dbError);
          results.errors++;
          results.details.push({
            order_number: order.order_number,
            status: 'error',
            reason: `DB error: ${dbError.message}`
          });
          continue;
        }

        console.log(`✅ Tags guardados en DB local para ${order.order_number}`);

        // ✅ DESPUÉS: Enviar a Shopify
        const response = await fetch(
          `https://${shopDomain}/admin/api/2024-01/orders/${order.shopify_order_id}.json`,
          {
            method: 'PUT',
            headers: {
              'X-Shopify-Access-Token': shopifyAccessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              order: { tags: tagsString }
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`⚠️ Error en Shopify para ${order.order_number}:`, response.status, errorText);
          // Los tags ya están en la DB local, así que contamos como éxito parcial
          results.updated++;
          results.details.push({
            order_number: order.order_number,
            status: 'partial',
            tags: tagsString,
            reason: `Saved to DB, Shopify failed: ${response.status}`
          });
        } else {
          console.log(`✅ Tags aplicados en Shopify para ${order.order_number}`);
          results.updated++;
          results.details.push({
            order_number: order.order_number,
            status: 'success',
            tags: tagsString
          });
        }

        // Pequeña pausa para no saturar la API de Shopify
        await new Promise(resolve => setTimeout(resolve, 250));

      } catch (error) {
        console.error(`❌ Error procesando ${order.order_number}:`, error);
        results.errors++;
        results.details.push({
          order_number: order.order_number,
          status: 'error',
          reason: String(error)
        });
      }
    }

    console.log('📊 Resumen de resincronización:');
    console.log(`  - Procesadas: ${results.processed}`);
    console.log(`  - Actualizadas: ${results.updated}`);
    console.log(`  - Omitidas: ${results.skipped}`);
    console.log(`  - Errores: ${results.errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Resincronización completada`,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error en resync-missing-tags:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
