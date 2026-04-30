// Cart recovery (MVP, mensaje 1 a los 30 min de abandono)
// Disparado por pg_cron cada 5 min. Selecciona carts elegibles, envía template
// de WhatsApp, registra el intento. No envia descuento — solo recordatorio.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate } from "../_shared/whatsapp-template.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STEP1_TEMPLATE = Deno.env.get('WHATSAPP_CART_RECOVERY_TEMPLATE_STEP1') || 'cart_recovery_step1_es';
const STEP1_LANGUAGE = Deno.env.get('WHATSAPP_CART_RECOVERY_TEMPLATE_LANG') || 'es_CO';
const MIN_TOTAL_COP = Number(Deno.env.get('CART_RECOVERY_MIN_TOTAL_COP') || '50000');
const MIN_DELAY_MINUTES = 30;
const MAX_DELAY_MINUTES = 90;
const BATCH_LIMIT = 50;

function formatCOP(value: number | null | undefined): string {
  if (!value || isNaN(Number(value))) return 'COP 0';
  return `COP ${Math.round(Number(value)).toLocaleString('es-CO')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const META_WHATSAPP_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');

    if (!META_WHATSAPP_TOKEN) {
      console.error('META_WHATSAPP_TOKEN no configurado');
      return new Response(
        JSON.stringify({ success: false, error: 'META_WHATSAPP_TOKEN no configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const cutoffMin = new Date(Date.now() - MAX_DELAY_MINUTES * 60 * 1000).toISOString();
    const cutoffMax = new Date(Date.now() - MIN_DELAY_MINUTES * 60 * 1000).toISOString();

    const { data: candidates, error: queryError } = await supabase
      .from('shopify_carts')
      .select('id, organization_id, email, phone, customer_first_name, total_price, recovery_url, line_items, shopify_cart_token')
      .is('recovered_at', null)
      .is('last_message_step', null)
      .eq('opted_out', false)
      .not('phone', 'is', null)
      .gte('total_price', MIN_TOTAL_COP)
      .gte('shopify_created_at', cutoffMin)
      .lte('shopify_created_at', cutoffMax)
      .order('shopify_created_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (queryError) {
      console.error('Error consultando carts:', queryError);
      return new Response(
        JSON.stringify({ success: false, error: queryError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!candidates || candidates.length === 0) {
      console.log('🛒 Cart recovery: 0 carritos elegibles');
      return new Response(
        JSON.stringify({ success: true, processed: 0, sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🛒 Cart recovery: ${candidates.length} candidato(s)`);

    // Cache de canales de WhatsApp por org para evitar query repetidos
    const channelCache = new Map<string, { phoneNumberId: string | null }>();

    let sent = 0;
    let skippedRace = 0;
    let errors = 0;

    for (const cart of candidates) {
      try {
        // Race guard: si ya se creó una orden con mismo email/phone en últimos 90 min, saltar
        const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString();
        const orFilters: string[] = [];
        if (cart.email) orFilters.push(`email.eq.${cart.email}`);
        if (cart.phone) orFilters.push(`customer_phone.eq.${cart.phone}`);

        if (orFilters.length > 0) {
          const { data: recentOrders } = await supabase
            .from('shopify_orders')
            .select('id')
            .eq('organization_id', cart.organization_id)
            .gte('created_at_shopify', ninetyMinAgo)
            .or(orFilters.join(','))
            .limit(1);

          if (recentOrders && recentOrders.length > 0) {
            console.log(`⏭️  Cart ${cart.id} saltado: orden reciente detectada`);
            skippedRace++;
            // Marcamos como recovered defensivamente para que no vuelva a entrar al cron
            await supabase
              .from('shopify_carts')
              .update({ recovered_at: new Date().toISOString() })
              .eq('id', cart.id);
            continue;
          }
        }

        // Resolver phone_number_id de la org
        let phoneNumberId: string | null = null;
        if (channelCache.has(cart.organization_id)) {
          phoneNumberId = channelCache.get(cart.organization_id)!.phoneNumberId;
        } else {
          const { data: channel } = await supabase
            .from('messaging_channels')
            .select('meta_phone_number_id')
            .eq('organization_id', cart.organization_id)
            .eq('channel_type', 'whatsapp')
            .eq('is_active', true)
            .maybeSingle();
          phoneNumberId = channel?.meta_phone_number_id || Deno.env.get('META_PHONE_NUMBER_ID') || null;
          channelCache.set(cart.organization_id, { phoneNumberId });
        }

        if (!phoneNumberId) {
          console.error(`❌ Sin meta_phone_number_id para org ${cart.organization_id}, saltando cart ${cart.id}`);
          errors++;
          continue;
        }

        const firstName = (cart.customer_first_name || '').trim() || 'amig@';
        const totalText = formatCOP(Number(cart.total_price));
        const recoveryUrl = cart.recovery_url || '';

        // Header con imagen del primer producto si existe
        const firstImage = Array.isArray(cart.line_items) && cart.line_items[0]?.image
          ? cart.line_items[0].image
          : null;

        const headerParameters = firstImage
          ? [{ type: 'image' as const, image: { link: firstImage } }]
          : undefined;

        const bodyParameters = [
          { type: 'text' as const, text: firstName },
          { type: 'text' as const, text: totalText },
        ];

        // El template tiene URL pattern "https://dosmicos.co/{{1}}", así que solo
        // pasamos el path+query (Meta hace replace y construye la URL final).
        const recoveryUrlSuffix = recoveryUrl.replace(/^https?:\/\/[^/]+\//, '');
        const buttonParameters = recoveryUrlSuffix
          ? [{ type: 'text' as const, text: recoveryUrlSuffix }]
          : undefined;

        const result = await sendWhatsAppTemplate(
          phoneNumberId,
          META_WHATSAPP_TOKEN,
          cart.phone!,
          STEP1_TEMPLATE,
          STEP1_LANGUAGE,
          bodyParameters,
          buttonParameters,
          headerParameters,
          'url'
        );

        const sentAt = new Date().toISOString();

        // Registrar intento (incluso si falló) para auditoria
        await supabase.from('cart_recovery_attempts').insert({
          cart_id: cart.id,
          organization_id: cart.organization_id,
          step: 1,
          template_name: STEP1_TEMPLATE,
          whatsapp_message_id: result.ok ? result.messageId : null,
          sent_at: sentAt,
          error: result.ok ? null : JSON.stringify(result.error).slice(0, 500),
        });

        if (result.ok) {
          await supabase
            .from('shopify_carts')
            .update({
              is_abandoned: true,
              abandoned_at: sentAt,
              last_message_step: 1,
              last_message_sent_at: sentAt,
            })
            .eq('id', cart.id);
          sent++;
        } else {
          // Marcamos abandoned + step para no reintentar y no inundar logs
          await supabase
            .from('shopify_carts')
            .update({
              is_abandoned: true,
              abandoned_at: sentAt,
              last_message_step: 1,
              last_message_sent_at: sentAt,
            })
            .eq('id', cart.id);
          errors++;
        }
      } catch (e: any) {
        console.error(`❌ Error procesando cart ${cart.id}:`, e?.message || e);
        errors++;
      }
    }

    console.log(`🛒 Cart recovery resumen: sent=${sent}, skippedRace=${skippedRace}, errors=${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: candidates.length,
        sent,
        skippedRace,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('Fatal en cart-recovery-send:', e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
