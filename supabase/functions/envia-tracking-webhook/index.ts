import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { sendWhatsAppTemplate } from "../_shared/whatsapp-template.ts";
import { normalizeColombianPhone } from "../_shared/phone-utils.ts";
import { mapShipmentStage, isNotifiable, type ShipmentStage } from "../_shared/shipment-status.ts";

/**
 * Receptor del webhook de Envia.com (push de cambios de estado de envío).
 *
 * Envia hace POST a esta función cada vez que cambia el estado de una guía.
 * Mapeamos el estado → etapa y, en las 3 etapas notificables (recolectado /
 * en_reparto / incidencia), enviamos un WhatsApp al cliente. Idempotente por
 * (shipping_label_id, stage) en `shipment_notifications`.
 *
 * Esta función es pública (verify_jwt = false): la autentica un secreto
 * compartido (ENVIA_WEBHOOK_SECRET) que va en la URL registrada en Envia
 * (?secret=...) o en el header `x-webhook-secret`.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

/** Lee un campo probando varios nombres posibles (el payload exacto de Envia se confirma al capturarlo). */
function pick(obj: Record<string, any> | null | undefined, keys: string[]): any {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // Healthcheck: el botón "Probar" de Envia (y monitores externos) hacen un GET
  // para validar la conexión. Respondemos 200 sin procesar nada.
  if (req.method === 'GET') {
    return json({ ok: true, service: 'envia-tracking-webhook', healthcheck: true });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const META_WHATSAPP_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
  const ENVIA_WEBHOOK_SECRET = Deno.env.get('ENVIA_WEBHOOK_SECRET');
  const LANG = Deno.env.get('WHATSAPP_TRACK_LANG') || 'es_CO';

  // Nombre de plantilla Meta por etapa (deben crearse/aprobarse en Meta).
  const TEMPLATES: Record<ShipmentStage, string | undefined> = {
    recolectado: Deno.env.get('WHATSAPP_TRACK_PICKED_TEMPLATE'),
    en_reparto: Deno.env.get('WHATSAPP_TRACK_OUT_FOR_DELIVERY_TEMPLATE'),
    incidencia: Deno.env.get('WHATSAPP_TRACK_INCIDENT_TEMPLATE'),
    entregado: undefined,
    otro: undefined,
  };

  // === Autenticación por secreto compartido ===
  if (ENVIA_WEBHOOK_SECRET) {
    const url = new URL(req.url);
    const provided = url.searchParams.get('secret') || req.headers.get('x-webhook-secret');
    if (provided !== ENVIA_WEBHOOK_SECRET) {
      console.warn('🚫 envia-tracking-webhook: secreto inválido o ausente');
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }
  } else {
    console.warn('⚠️ ENVIA_WEBHOOK_SECRET no configurado — el webhook acepta cualquier POST');
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Body no es JSON' }, 400);
  }

  // Log del payload crudo (útil para fijar nombres de campos los primeros días).
  console.log('📥 envia-tracking-webhook payload:', JSON.stringify(payload));

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Envia puede anidar los datos en `data` (o `data[0]`), o mandarlos planos.
    const d = payload?.data?.[0] ?? payload?.data ?? payload ?? {};

    const trackingNumber = pick(d, ['tracking_number', 'trackingNumber', 'guide', 'guia', 'guideNumber'])
      ?? pick(payload, ['tracking_number', 'trackingNumber']);
    const rawStatus = pick(d, ['status', 'statusCode', 'state']);
    const statusDescription = pick(d, [
      'status_description', 'statusDescription', 'description', 'event', 'message', 'detail',
    ]);
    const carrier = pick(d, ['carrier_name', 'carrier', 'carrierName']);

    if (!trackingNumber) {
      console.log('ℹ️ Webhook sin tracking_number — se ignora');
      return json({ ok: true, ignored: 'no_tracking_number' });
    }

    // Buscar la guía. UNIQUE(org, shopify_order_id) pero el tracking puede repetirse
    // teóricamente entre orgs; tomamos la más reciente.
    const { data: label, error: labelErr } = await supabase
      .from('shipping_labels')
      .select('id, organization_id, order_number, shopify_order_id, tracking_number, carrier, recipient_phone, recipient_name, status, destination_address, destination_city, destination_department')
      .eq('tracking_number', String(trackingNumber))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (labelErr) {
      console.error('❌ Error consultando shipping_labels:', labelErr.message);
      return json({ ok: false, error: 'db_error' }, 500);
    }
    if (!label) {
      console.log(`ℹ️ No hay guía para tracking ${trackingNumber} — se ignora`);
      return json({ ok: true, ignored: 'label_not_found' });
    }

    const { stage, labelStatus } = mapShipmentStage(rawStatus, statusDescription);
    console.log(`📦 ${label.order_number} (${trackingNumber}) status="${rawStatus}" desc="${statusDescription}" → stage=${stage}, labelStatus=${labelStatus}`);

    // 1) Mantener el status de la guía al día (no notifica). No degradar 'delivered'.
    if (label.status !== 'delivered') {
      await supabase
        .from('shipping_labels')
        .update({ status: labelStatus })
        .eq('id', label.id);
    }

    // 2) ¿Esta etapa notifica?
    if (!isNotifiable(stage)) {
      return json({ ok: true, stage, notified: false, reason: 'stage_not_notifiable' });
    }

    // 3) Dedupe: ¿ya se notificó esta etapa para esta guía?
    const { data: prior } = await supabase
      .from('shipment_notifications')
      .select('id, status')
      .eq('shipping_label_id', label.id)
      .eq('stage', stage)
      .maybeSingle();

    if (prior && prior.status === 'sent') {
      console.log(`↩️ Etapa ${stage} ya notificada para ${label.order_number} — skip`);
      return json({ ok: true, stage, notified: false, reason: 'already_sent' });
    }

    const result = await sendStageNotification(
      supabase, label, stage, String(trackingNumber), carrier,
      META_WHATSAPP_TOKEN, TEMPLATES[stage], LANG, payload,
    );

    return json({ ok: true, stage, notified: result.status === 'sent', notification: result });
  } catch (e: any) {
    console.error('❌ envia-tracking-webhook error:', e?.message || e);
    // 200 para que Envia no reintente en loop por un error nuestro.
    return json({ ok: false, error: e?.message || 'unhandled' }, 200);
  }
});

type NotifStatus = 'sent' | 'failed' | 'skipped_no_phone' | 'skipped_no_template';

async function sendStageNotification(
  supabase: any,
  label: any,
  stage: ShipmentStage,
  trackingNumber: string,
  carrier: string | undefined,
  whatsappToken: string | undefined,
  templateName: string | undefined,
  lang: string,
  rawPayload: unknown,
): Promise<{ status: NotifStatus; error?: string }> {
  const orgId = label.organization_id;
  const orderClean = String(label.order_number || '').replace('#', '').trim();
  const trackingUrl = `https://envia.com/es-CO/tracking?label=${encodeURIComponent(trackingNumber)}`;

  // upsert helper para registrar el resultado (dedupe por shipping_label_id+stage).
  const logResult = async (
    status: NotifStatus,
    extra: { conversation_id?: string | null; external_message_id?: string | null; customer_phone?: string | null } = {},
  ) => {
    await supabase.from('shipment_notifications').upsert({
      organization_id: orgId,
      shipping_label_id: label.id,
      tracking_number: trackingNumber,
      shopify_order_id: label.shopify_order_id,
      order_number: label.order_number,
      stage,
      carrier: carrier || label.carrier || null,
      customer_phone: extra.customer_phone ?? null,
      conversation_id: extra.conversation_id ?? null,
      external_message_id: extra.external_message_id ?? null,
      status,
      raw: rawPayload as any,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    }, { onConflict: 'shipping_label_id,stage' });
  };

  if (!templateName || !whatsappToken) {
    console.warn(`⚠️ Falta plantilla/token para etapa ${stage} — skip (${templateName ? 'sin token' : 'sin plantilla'})`);
    await logResult('skipped_no_template');
    return { status: 'skipped_no_template' };
  }

  // === Resolver teléfono: recipient_phone de la guía, fallback al de la orden ===
  let rawPhone: string | null = label.recipient_phone || null;
  if (!rawPhone && label.shopify_order_id) {
    const { data: order } = await supabase
      .from('shopify_orders')
      .select('shipping_address, customer_phone')
      .eq('shopify_order_id', label.shopify_order_id)
      .eq('organization_id', orgId)
      .maybeSingle();
    rawPhone = order?.shipping_address?.phone || order?.customer_phone || null;
  }

  const phone = rawPhone ? normalizeColombianPhone(rawPhone) : null;
  if (!phone) {
    console.warn(`⚠️ Sin teléfono válido para ${label.order_number} — skip`);
    await logResult('skipped_no_phone', { customer_phone: rawPhone });
    return { status: 'skipped_no_phone' };
  }

  // === Canal de WhatsApp (phone_number_id) ===
  const { data: channel } = await supabase
    .from('messaging_channels')
    .select('id, meta_phone_number_id')
    .eq('organization_id', orgId)
    .eq('channel_type', 'whatsapp')
    .eq('is_active', true)
    .maybeSingle();

  const phoneNumberId = channel?.meta_phone_number_id || Deno.env.get('META_PHONE_NUMBER_ID');
  const channelId = channel?.id;
  if (!phoneNumberId) {
    console.warn('⚠️ Sin canal WhatsApp configurado — skip');
    await logResult('skipped_no_template', { customer_phone: phone });
    return { status: 'skipped_no_template', error: 'no_channel' };
  }

  // === Buscar/crear conversación ===
  let conversationId: string | null = null;
  const { data: existingConv } = await supabase
    .from('messaging_conversations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('external_user_id', phone)
    .eq('channel_type', 'whatsapp')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const insertConv: any = {
      organization_id: orgId,
      external_user_id: phone,
      channel_type: 'whatsapp',
      contact_name: label.recipient_name || 'Cliente',
      ai_managed: true,
      status: 'active',
    };
    if (channelId) insertConv.channel_id = channelId;
    const { data: newConv } = await supabase
      .from('messaging_conversations')
      .insert(insertConv)
      .select('id')
      .single();
    conversationId = newConv?.id || null;
  }

  // === Parámetros + texto legible por etapa ===
  let bodyParams: Array<{ type: 'text'; text: string }>;
  let buttonParams: Array<{ type: 'text'; text: string; subType: 'url' }> | undefined;
  let readable: string;
  if (stage === 'recolectado') {
    // Body: {{1}}=pedido, {{2}}=guía. El enlace va en un botón URL dinámico
    // "Rastrear mi pedido" cuya plantilla define ?label={{1}}; aquí pasamos la guía.
    bodyParams = [
      { type: 'text', text: orderClean },
      { type: 'text', text: trackingNumber },
    ];
    buttonParams = [{ type: 'text', text: trackingNumber, subType: 'url' }];
    readable = `📦 ¡Tu pedido #${orderClean} ya fue recogido por la transportadora! Tu guía es ${trackingNumber}. Sigue tu envío aquí: ${trackingUrl}`;
  } else if (stage === 'en_reparto') {
    bodyParams = [{ type: 'text', text: orderClean }];
    readable = `🚚 ¡Tu pedido #${orderClean} sale hoy a reparto! Mantente pendiente para recibirlo.`;
  } else {
    // incidencia: mostramos la dirección registrada para que el cliente confirme/corrija
    // (el error de dirección es la incidencia más común). {{1}}=pedido, {{2}}=dirección.
    const direccion = [label.destination_address, label.destination_city]
      .filter(Boolean).join(', ') || 'la registrada en tu pedido';
    bodyParams = [
      { type: 'text', text: orderClean },
      { type: 'text', text: direccion },
    ];
    readable = `⚠️ Hubo una novedad con la entrega de tu pedido #${orderClean}. La dirección que tenemos registrada es: ${direccion}. ¿Es correcta? Si hay algún error, respóndenos por aquí con la dirección corregida y reprogramamos tu entrega.`;
  }

  // === Enviar plantilla ===
  const sendResult = await sendWhatsAppTemplate(
    phoneNumberId, whatsappToken, phone, templateName, lang, bodyParams, buttonParams,
  );

  if (!sendResult.ok) {
    console.error(`❌ Envío fallido (${stage}) ${label.order_number}:`, JSON.stringify(sendResult.error));
    await logResult('failed', { conversation_id: conversationId, customer_phone: phone });
    return { status: 'failed', error: JSON.stringify(sendResult.error) };
  }

  // === Guardar mensaje + actualizar conversación ===
  let messageId: string | null = null;
  if (conversationId) {
    const { data: msg } = await supabase
      .from('messaging_messages')
      .insert({
        conversation_id: conversationId,
        external_message_id: sendResult.messageId,
        channel_type: 'whatsapp',
        direction: 'outbound',
        sender_type: 'agent',
        content: readable,
        message_type: 'template',
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    messageId = msg?.id || null;

    await supabase.from('messaging_conversations').update({
      last_message_preview: readable.substring(0, 100),
      last_message_at: new Date().toISOString(),
    }).eq('id', conversationId);
  }

  await logResult('sent', {
    conversation_id: conversationId,
    external_message_id: sendResult.messageId,
    customer_phone: phone,
  });

  console.log(`✅ Notificación ${stage} enviada para ${label.order_number} → ${phone}`);
  return { status: 'sent' };
}
