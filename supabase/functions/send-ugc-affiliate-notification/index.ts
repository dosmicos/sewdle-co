import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizeColombianPhone } from "../_shared/phone-utils.ts";
import { sendWhatsAppTemplate } from "../_shared/whatsapp-template.ts";

type NotificationType = 'sale' | 'first_sale' | 'rank_top5' | 'rank_proximity' | 'weekly_challenge';

type Setting = {
  notification_type: NotificationType;
  template_name: string;
  template_language: string;
  is_enabled: boolean;
  sample_message?: string | null;
};

type Creator = {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  instagram_handle?: string | null;
};

type DiscountLink = {
  id: string;
  organization_id: string;
  creator_id: string;
  redirect_token: string;
  total_commission: number | string | null;
  total_paid_out: number | string | null;
  is_active: boolean;
};

type AttributedOrder = {
  id: string;
  organization_id: string;
  discount_link_id: string;
  creator_id: string;
  shopify_order_id: string;
  shopify_order_number: string | null;
  order_total: number | string | null;
  commission_amount: number | string | null;
  order_date: string;
};

const DEFAULT_LANGUAGE = 'es_CO';
const PUBLIC_LINK_BASE = 'https://ads.dosmicos.com/ugc';
const UPLOAD_LINK_BASE = 'https://upload.dosmicos.com/upload';
const RANK_PROXIMITY_MAX_GAP_COP = 50_000;

const TEMPLATE_DEFAULTS: Record<NotificationType, Setting> = {
  sale: {
    notification_type: 'sale',
    template_name: 'dosmicos_club_mamas_sale_v1',
    template_language: DEFAULT_LANGUAGE,
    is_enabled: false,
    sample_message: '💛 Club de Mamás Dosmicos: ¡vendiste con tu link, {{1}}! Acabas de ganar {{2}}. Tu saldo acumulado va en {{3}} y estás en el puesto #{{4}} esta semana. Sube el contenido que usaste o un video corto aquí para que podamos revisarlo para ADS: {{5}}. Tu link de descuento: {{6}}',
  },
  first_sale: {
    notification_type: 'first_sale',
    template_name: 'dosmicos_club_mamas_first_sale_v1',
    template_language: DEFAULT_LANGUAGE,
    is_enabled: false,
    sample_message: '💛 Club de Mamás Dosmicos: {{1}}, ¡lograste tu primera venta con tu link! Ganaste {{2}} y tu saldo va en {{3}}. Si tienes foto/video/testimonio de lo que publicaste, súbelo aquí para que podamos revisarlo para ADS: {{4}}. Tu link de descuento: {{5}}',
  },
  rank_top5: {
    notification_type: 'rank_top5',
    template_name: 'dosmicos_club_mamas_rank_top5_v1',
    template_language: DEFAULT_LANGUAGE,
    is_enabled: false,
    sample_message: '🏆 Club de Mamás Dosmicos: {{1}}, estás en el top 5 esta semana. Vas en el puesto #{{2}} con {{3}} en comisión. Sube tu mejor contenido aquí para que podamos revisarlo para ADS: {{4}}. Sigue compartiendo tu link: {{5}}',
  },
  rank_proximity: {
    notification_type: 'rank_proximity',
    template_name: 'dosmicos_club_mamas_rank_proximity_v1',
    template_language: DEFAULT_LANGUAGE,
    is_enabled: false,
    sample_message: '👀 Club de Mamás Dosmicos: {{1}}, estás en el puesto #{{2}} esta semana. Te faltan aprox. {{3}} para entrar al top 5 y ya llevas {{4}} en comisión. Sube contenido nuevo aquí: {{5}}. Tu link de descuento: {{6}}',
  },
  weekly_challenge: {
    notification_type: 'weekly_challenge',
    template_name: 'dosmicos_club_mamas_weekly_challenge_v1',
    template_language: DEFAULT_LANGUAGE,
    is_enabled: false,
    sample_message: '💛 Reto Club de Mamás Dosmicos de la semana, {{1}}: {{2}}. Idea para crear: {{3}}. Súbelo aquí para que podamos revisarlo para ADS: {{4}}. Y compártelo con tu link de descuento: {{5}}',
  },
};

const log = (step: string, details?: Record<string, unknown>) => {
  console.log(`[UGC-AFFILIATE-NOTIFY] ${step}${details ? ' - ' + JSON.stringify(details) : ''}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'dry_run';
    const dryRun = body.dryRun !== false || action === 'dry_run';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    if (action === 'notify_order') {
      const result = await notifyOrder(supabase, body, dryRun);
      return json(result);
    }

    if (action === 'send_weekly_challenge') {
      const result = await sendWeeklyChallenge(supabase, body, dryRun);
      return json(result);
    }

    if (action === 'test_template') {
      const result = await sendTestTemplate(supabase, body, dryRun);
      return json(result);
    }

    return json({ error: `Unsupported action: ${action}` }, 400);
  } catch (error: any) {
    console.error('[UGC-AFFILIATE-NOTIFY] Error:', error);
    return json({ error: error.message || 'Internal error' }, 500);
  }
});

async function notifyOrder(supabase: any, body: any, dryRun: boolean) {
  const order = await fetchAttributedOrder(supabase, body.attributedOrderId, body.shopifyOrderId);
  if (!order) return { ok: false, reason: 'order_not_found' };

  const [creator, link] = await Promise.all([
    fetchCreator(supabase, order.creator_id),
    fetchDiscountLink(supabase, order.discount_link_id),
  ]);

  if (!creator || !link) return { ok: false, reason: 'creator_or_link_not_found' };

  const totalOrders = await countCreatorOrders(supabase, creator.id);
  const notificationType: NotificationType = totalOrders <= 1 ? 'first_sale' : 'sale';

  const ranking = await computeWeeklyRanking(supabase, order.organization_id, creator.id);
  const creatorLink = buildCreatorLink(link);
  const uploadLink = await getOrCreateUploadLink(supabase, creator);
  const pendingBalance = formatCOP(numberValue(link.total_commission) - numberValue(link.total_paid_out));
  const commission = formatCOP(numberValue(order.commission_amount));

  const primaryParams = notificationType === 'first_sale'
    ? [creator.name, commission, pendingBalance, uploadLink, creatorLink]
    : [creator.name, commission, pendingBalance, String(ranking.creatorRank || '-'), uploadLink, creatorLink];

  const primaryPreview = fillSample(TEMPLATE_DEFAULTS[notificationType].sample_message || '', primaryParams);
  const primary = await maybeSendNotification(supabase, {
    organizationId: order.organization_id,
    creator,
    link,
    type: notificationType,
    params: primaryParams,
    preview: primaryPreview,
    dryRun,
    attributedOrderId: order.id,
    metadata: {
      shopify_order_id: order.shopify_order_id,
      shopify_order_number: order.shopify_order_number,
      order_total: numberValue(order.order_total),
      commission_amount: numberValue(order.commission_amount),
      upload_link: uploadLink,
      creator_link: creatorLink,
    },
  });

  const rankNotification = await maybeSendRankNotification(supabase, {
    organizationId: order.organization_id,
    creator,
    link,
    ranking,
    dryRun,
    attributedOrderId: order.id,
  });

  return {
    ok: true,
    dryRun,
    orderId: order.id,
    notificationType,
    primary,
    rankNotification,
  };
}

async function sendWeeklyChallenge(supabase: any, body: any, dryRun: boolean) {
  const org = await fetchOrganization(supabase, body.organizationId, body.organizationSlug || 'dosmicos-org');
  if (!org) return { ok: false, reason: 'organization_not_found' };

  const setting = await fetchSetting(supabase, org.id, 'weekly_challenge');
  if (!dryRun && !setting.is_enabled) {
    return {
      ok: true,
      dryRun,
      organizationId: org.id,
      status: 'skipped_disabled',
      reason: 'weekly_challenge setting is disabled; no messages or logs created',
      candidates: 0,
      results: [],
    };
  }

  const challengeTitle = body.challengeTitle || '3 historias reales usando Dosmicos';
  const challengePrompt = body.challengePrompt || 'Muestra cómo usas Dosmicos en la vida real: frío, sueño, bebé que se destapa o salida familiar. Súbelo a tu link de upload y compártelo con tu link de descuento.';
  const maxSend = Number(body.maxSend || 200);
  const periodStart = getBogotaWeekStartDate();

  const recipients = await fetchCmdCreatorsWithLinks(supabase, org.id, maxSend);
  const results: any[] = [];

  for (const row of recipients) {
    const creator = row.creator as Creator;
    const link = row.link as DiscountLink;
    const creatorLink = buildCreatorLink(link);
    const uploadLink = await getOrCreateUploadLink(supabase, creator);
    const params = [creator.name, challengeTitle, challengePrompt, uploadLink, creatorLink];
    const preview = fillSample(TEMPLATE_DEFAULTS.weekly_challenge.sample_message || '', params);
    const result = await maybeSendNotification(supabase, {
      organizationId: org.id,
      creator,
      link,
      type: 'weekly_challenge',
      params,
      preview,
      dryRun,
      periodStart,
      metadata: { challengeTitle, challengePrompt, upload_link: uploadLink, creator_link: creatorLink },
    });
    results.push({ creatorId: creator.id, name: creator.name, status: result.status, notificationId: result.notificationId, error: result.error });
  }

  return {
    ok: true,
    dryRun,
    organizationId: org.id,
    candidates: recipients.length,
    results,
  };
}

async function sendTestTemplate(supabase: any, body: any, dryRun: boolean) {
  const org = await fetchOrganization(supabase, body.organizationId, body.organizationSlug || 'dosmicos-org');
  if (!org) return { ok: false, reason: 'organization_not_found' };

  const phone = normalizeColombianPhone(body.phone || '');
  if (!phone) return { ok: false, reason: 'invalid_phone' };

  const type: NotificationType = body.type || 'sale';
  const setting = await fetchSetting(supabase, org.id, type);
  const params = Array.isArray(body.parameters) && body.parameters.length
    ? body.parameters.map(String)
    : sampleParamsFor(type);
  const preview = fillSample((setting.sample_message || TEMPLATE_DEFAULTS[type].sample_message || ''), params);

  if (dryRun || !setting.is_enabled) {
    return { ok: true, dryRun, status: dryRun ? 'dry_run' : 'skipped_disabled', type, phone, templateName: setting.template_name, params, preview };
  }

  const channel = await fetchWhatsAppChannel(supabase, org.id);
  if (!channel?.phoneNumberId) return { ok: false, reason: 'whatsapp_channel_not_configured' };
  const token = Deno.env.get('META_WHATSAPP_TOKEN');
  if (!token) return { ok: false, reason: 'META_WHATSAPP_TOKEN_missing' };

  const result = await sendWhatsAppTemplate(
    channel.phoneNumberId,
    token,
    phone,
    setting.template_name,
    setting.template_language || DEFAULT_LANGUAGE,
    params.map((text: string) => ({ type: 'text' as const, text }))
  );

  return { ok: result.ok, messageId: result.messageId, error: result.error, preview };
}

async function maybeSendRankNotification(supabase: any, args: {
  organizationId: string;
  creator: Creator;
  link: DiscountLink;
  ranking: { creatorRank: number | null; creatorWeekCommission: number; top5Gap: number | null; weekStart: string };
  dryRun: boolean;
  attributedOrderId?: string;
}) {
  const { creatorRank, creatorWeekCommission, top5Gap, weekStart } = args.ranking;
  if (!creatorRank) return { status: 'skipped_no_rank' };

  const creatorLink = buildCreatorLink(args.link);
  const uploadLink = await getOrCreateUploadLink(supabase, args.creator);

  if (creatorRank <= 5) {
    const params = [args.creator.name, String(creatorRank), formatCOP(creatorWeekCommission), uploadLink, creatorLink];
    const preview = fillSample(TEMPLATE_DEFAULTS.rank_top5.sample_message || '', params);
    return maybeSendNotification(supabase, {
      organizationId: args.organizationId,
      creator: args.creator,
      link: args.link,
      type: 'rank_top5',
      params,
      preview,
      dryRun: args.dryRun,
      attributedOrderId: args.attributedOrderId,
      periodStart: weekStart,
      rank: creatorRank,
      metadata: { week_commission: creatorWeekCommission, upload_link: uploadLink, creator_link: creatorLink },
    });
  }

  if (top5Gap !== null && top5Gap > 0 && top5Gap <= RANK_PROXIMITY_MAX_GAP_COP) {
    const params = [args.creator.name, String(creatorRank), formatCOP(top5Gap), formatCOP(creatorWeekCommission), uploadLink, creatorLink];
    const preview = fillSample(TEMPLATE_DEFAULTS.rank_proximity.sample_message || '', params);
    return maybeSendNotification(supabase, {
      organizationId: args.organizationId,
      creator: args.creator,
      link: args.link,
      type: 'rank_proximity',
      params,
      preview,
      dryRun: args.dryRun,
      attributedOrderId: args.attributedOrderId,
      periodStart: weekStart,
      rank: creatorRank,
      metadata: { week_commission: creatorWeekCommission, gap_to_top5: top5Gap, upload_link: uploadLink, creator_link: creatorLink },
    });
  }

  return { status: 'skipped_not_close_to_top5', rank: creatorRank, top5Gap };
}

async function maybeSendNotification(supabase: any, args: {
  organizationId: string;
  creator: Creator;
  link: DiscountLink;
  type: NotificationType;
  params: string[];
  preview: string;
  dryRun: boolean;
  attributedOrderId?: string;
  periodStart?: string;
  rank?: number;
  metadata?: Record<string, unknown>;
}) {
  const setting = await fetchSetting(supabase, args.organizationId, args.type);
  const normalizedPhone = normalizeColombianPhone(args.creator.phone || '');
  const baseLog = {
    organization_id: args.organizationId,
    creator_id: args.creator.id,
    discount_link_id: args.link.id,
    attributed_order_id: args.attributedOrderId || null,
    notification_type: args.type,
    whatsapp_number: normalizedPhone,
    template_name: setting.template_name,
    template_language: setting.template_language || DEFAULT_LANGUAGE,
    template_parameters: args.params,
    message_preview: args.preview,
    period_start: args.periodStart || null,
    rank: args.rank || null,
    metadata: args.metadata || {},
  };

  if (!normalizedPhone) {
    const inserted = await insertNotificationLog(supabase, { ...baseLog, status: 'skipped_no_phone' });
    return { status: 'skipped_no_phone', notificationId: inserted?.id };
  }

  if (args.dryRun) {
    const inserted = await insertNotificationLog(supabase, { ...baseLog, status: 'dry_run' });
    return { status: 'dry_run', notificationId: inserted?.id, preview: args.preview };
  }

  if (!setting.is_enabled) {
    const inserted = await insertNotificationLog(supabase, { ...baseLog, status: 'skipped_disabled' });
    return { status: 'skipped_disabled', notificationId: inserted?.id, templateName: setting.template_name, preview: args.preview };
  }

  const channel = await fetchWhatsAppChannel(supabase, args.organizationId);
  if (!channel?.phoneNumberId) {
    const inserted = await insertNotificationLog(supabase, {
      ...baseLog,
      status: 'failed',
      error: { message: 'No active WhatsApp channel or META_PHONE_NUMBER_ID configured' },
    });
    return { status: 'failed', notificationId: inserted?.id, error: 'whatsapp_channel_not_configured' };
  }

  const token = Deno.env.get('META_WHATSAPP_TOKEN');
  if (!token) {
    const inserted = await insertNotificationLog(supabase, {
      ...baseLog,
      status: 'failed',
      error: { message: 'META_WHATSAPP_TOKEN missing' },
    });
    return { status: 'failed', notificationId: inserted?.id, error: 'META_WHATSAPP_TOKEN_missing' };
  }

  const result = await sendWhatsAppTemplate(
    channel.phoneNumberId,
    token,
    normalizedPhone,
    setting.template_name,
    setting.template_language || DEFAULT_LANGUAGE,
    args.params.map((text) => ({ type: 'text' as const, text }))
  );

  if (!result.ok) {
    const inserted = await insertNotificationLog(supabase, {
      ...baseLog,
      status: 'failed',
      error: result.error || { message: 'template_send_failed' },
    });
    return { status: 'failed', notificationId: inserted?.id, error: result.error };
  }

  const inserted = await insertNotificationLog(supabase, {
    ...baseLog,
    status: 'sent',
    external_message_id: result.messageId,
    sent_at: new Date().toISOString(),
  });

  await saveMessageToDb(supabase, {
    organizationId: args.organizationId,
    channelId: channel.channelId,
    creator: args.creator,
    phone: normalizedPhone,
    messageId: result.messageId,
    content: args.preview,
    templateName: setting.template_name,
    notificationType: args.type,
  });

  return { status: 'sent', notificationId: inserted?.id, messageId: result.messageId };
}

async function insertNotificationLog(supabase: any, row: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('ugc_affiliate_notifications')
    .insert(row)
    .select('id, status')
    .maybeSingle();

  if (error) {
    if (String(error.message || '').toLowerCase().includes('duplicate') || error.code === '23505') {
      log('Duplicate notification skipped', { type: row.notification_type as string, creatorId: row.creator_id as string });
      return { id: null, status: 'skipped_duplicate' };
    }
    console.error('Notification log insert error:', error);
    return null;
  }
  return data;
}

async function saveMessageToDb(supabase: any, args: {
  organizationId: string;
  channelId: string | null;
  creator: Creator;
  phone: string;
  messageId?: string;
  content: string;
  templateName: string;
  notificationType: NotificationType;
}) {
  let conversationId: string | null = null;

  const { data: existingConv } = await supabase
    .from('messaging_conversations')
    .select('id')
    .eq('organization_id', args.organizationId)
    .eq('channel_type', 'whatsapp')
    .eq('external_user_id', args.phone)
    .maybeSingle();

  if (existingConv?.id) {
    conversationId = existingConv.id;
  } else if (args.channelId) {
    const { data: newConv, error } = await supabase
      .from('messaging_conversations')
      .insert({
        organization_id: args.organizationId,
        channel_id: args.channelId,
        channel_type: 'whatsapp',
        external_user_id: args.phone,
        user_name: args.creator.name,
        user_identifier: args.phone,
        status: 'active',
        ai_managed: true,
        last_message_preview: args.content.substring(0, 100),
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (error) console.error('Conversation insert error:', error);
    conversationId = newConv?.id || null;
  }

  if (!conversationId) return;

  await supabase.from('messaging_messages').insert({
    conversation_id: conversationId,
    external_message_id: args.messageId || null,
    channel_type: 'whatsapp',
    direction: 'outbound',
    sender_type: 'agent',
    content: args.content,
    message_type: 'template',
    metadata: {
      template_name: args.templateName,
      notification_type: args.notificationType,
      system: 'ugc_affiliate_dopamine_phase_1',
    },
    sent_at: new Date().toISOString(),
  });

  await supabase
    .from('messaging_conversations')
    .update({
      last_message_preview: args.content.substring(0, 100),
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversationId);
}

async function fetchAttributedOrder(supabase: any, attributedOrderId?: string, shopifyOrderId?: string): Promise<AttributedOrder | null> {
  let query = supabase
    .from('ugc_attributed_orders')
    .select('id, organization_id, discount_link_id, creator_id, shopify_order_id, shopify_order_number, order_total, commission_amount, order_date')
    .limit(1);

  if (attributedOrderId) query = query.eq('id', attributedOrderId);
  else if (shopifyOrderId) query = query.eq('shopify_order_id', String(shopifyOrderId));
  else return null;

  const { data, error } = await query.maybeSingle();
  if (error) console.error('fetchAttributedOrder error:', error);
  return data || null;
}

async function fetchCreator(supabase: any, creatorId: string): Promise<Creator | null> {
  const { data, error } = await supabase
    .from('ugc_creators')
    .select('id, organization_id, name, phone, instagram_handle')
    .eq('id', creatorId)
    .maybeSingle();
  if (error) console.error('fetchCreator error:', error);
  return data || null;
}

async function fetchDiscountLink(supabase: any, linkId: string): Promise<DiscountLink | null> {
  const { data, error } = await supabase
    .from('ugc_discount_links')
    .select('id, organization_id, creator_id, redirect_token, total_commission, total_paid_out, is_active')
    .eq('id', linkId)
    .maybeSingle();
  if (error) console.error('fetchDiscountLink error:', error);
  return data || null;
}

async function fetchOrganization(supabase: any, organizationId?: string, organizationSlug?: string): Promise<{ id: string; slug: string } | null> {
  if (organizationId) {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, slug')
      .eq('id', organizationId)
      .maybeSingle();
    if (error) console.error('fetchOrganization error:', error);
    return data || null;
  }

  const slug = organizationSlug || 'dosmicos-org';
  const { data, error } = await supabase
    .from('organizations')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (error) console.error('fetchOrganization error:', error);
  if (data) return data;

  if (slug === 'dosmicos') {
    const fallback = await supabase
      .from('organizations')
      .select('id, slug')
      .eq('slug', 'dosmicos-org')
      .maybeSingle();
    if (fallback.error) console.error('fetchOrganization fallback error:', fallback.error);
    return fallback.data || null;
  }

  return null;
}

async function fetchSetting(supabase: any, organizationId: string, type: NotificationType): Promise<Setting> {
  const { data, error } = await supabase
    .from('ugc_affiliate_notification_settings')
    .select('notification_type, template_name, template_language, is_enabled, sample_message')
    .eq('organization_id', organizationId)
    .eq('notification_type', type)
    .maybeSingle();

  if (error) console.error('fetchSetting error:', error);
  return data || TEMPLATE_DEFAULTS[type];
}

async function fetchWhatsAppChannel(supabase: any, organizationId: string): Promise<{ channelId: string | null; phoneNumberId: string | null }> {
  const { data } = await supabase
    .from('messaging_channels')
    .select('id, meta_phone_number_id')
    .eq('organization_id', organizationId)
    .eq('channel_type', 'whatsapp')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  return {
    channelId: data?.id || null,
    phoneNumberId: data?.meta_phone_number_id || Deno.env.get('META_PHONE_NUMBER_ID') || null,
  };
}

async function countCreatorOrders(supabase: any, creatorId: string): Promise<number> {
  const { count, error } = await supabase
    .from('ugc_attributed_orders')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId);
  if (error) console.error('countCreatorOrders error:', error);
  return count || 0;
}

async function computeWeeklyRanking(supabase: any, organizationId: string, creatorId: string): Promise<{
  creatorRank: number | null;
  creatorWeekCommission: number;
  top5Gap: number | null;
  weekStart: string;
}> {
  const weekStart = getBogotaWeekStartDate();
  const weekStartIso = `${weekStart}T05:00:00.000Z`;

  const { data: links } = await supabase
    .from('ugc_discount_links')
    .select('creator_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  const activeCreatorIds = new Set<string>((links || []).map((l: any) => String(l.creator_id)));

  const { data: orders } = await supabase
    .from('ugc_attributed_orders')
    .select('creator_id, commission_amount')
    .eq('organization_id', organizationId)
    .gte('order_date', weekStartIso);

  const commissionByCreator = new Map<string, number>();
  for (const id of activeCreatorIds) commissionByCreator.set(id, 0);
  for (const order of orders || []) {
    if (!activeCreatorIds.has(order.creator_id)) continue;
    commissionByCreator.set(order.creator_id, (commissionByCreator.get(order.creator_id) || 0) + numberValue(order.commission_amount));
  }

  const ranked = Array.from(commissionByCreator.entries())
    .map(([id, commission]) => ({ id, commission }))
    .sort((a, b) => b.commission - a.commission);

  const index = ranked.findIndex((r) => r.id === creatorId);
  const creatorWeekCommission = index >= 0 ? ranked[index].commission : 0;
  const creatorRank = index >= 0 ? index + 1 : null;
  const top5Commission = ranked[4]?.commission ?? null;
  const top5Gap = top5Commission === null ? null : Math.max(0, top5Commission - creatorWeekCommission + 1);

  return { creatorRank, creatorWeekCommission, top5Gap, weekStart };
}

async function fetchCmdCreatorsWithLinks(supabase: any, organizationId: string, maxSend: number): Promise<Array<{ creator: Creator; link: DiscountLink }>> {
  const { data: cmdTag } = await supabase
    .from('ugc_creator_tags')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', 'CMD')
    .limit(1)
    .maybeSingle();

  let creatorIds: string[] | null = null;
  if (cmdTag?.id) {
    const { data: assignments } = await supabase
      .from('ugc_creator_tag_assignments')
      .select('creator_id')
      .eq('tag_id', cmdTag.id)
      .limit(1000);
    creatorIds = (assignments || []).map((a: any) => a.creator_id);
  }

  let creatorQuery = supabase
    .from('ugc_creators')
    .select('id, organization_id, name, phone, instagram_handle')
    .eq('organization_id', organizationId)
    .not('phone', 'is', null)
    .limit(1000);

  if (creatorIds && creatorIds.length > 0) creatorQuery = creatorQuery.in('id', creatorIds);

  const { data: creators, error: creatorError } = await creatorQuery;
  if (creatorError) {
    console.error('fetchCmdCreatorsWithLinks creators error:', creatorError);
    return [];
  }

  const ids = (creators || []).map((c: Creator) => c.id);
  if (ids.length === 0) return [];

  const { data: links, error: linkError } = await supabase
    .from('ugc_discount_links')
    .select('id, organization_id, creator_id, redirect_token, total_commission, total_paid_out, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .in('creator_id', ids)
    .limit(1000);

  if (linkError) {
    console.error('fetchCmdCreatorsWithLinks links error:', linkError);
    return [];
  }

  const linkByCreator = new Map<string, DiscountLink>((links || []).map((l: DiscountLink) => [l.creator_id, l]));
  const rows: Array<{ creator: Creator; link: DiscountLink }> = [];
  for (const creator of creators || []) {
    const link = linkByCreator.get(creator.id);
    if (!link) continue;
    rows.push({ creator, link });
    if (rows.length >= maxSend) break;
  }
  return rows;
}

async function getOrCreateUploadLink(supabase: any, creator: Creator): Promise<string> {
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from('ugc_upload_tokens')
    .select('id, token')
    .eq('creator_id', creator.id)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) console.error('getOrCreateUploadLink existing error:', existingError);
  if (existing?.token) return buildUploadLink(existing.token);

  await supabase
    .from('ugc_upload_tokens')
    .update({ is_active: false })
    .eq('creator_id', creator.id)
    .eq('is_active', true);

  const token = crypto.randomUUID().replaceAll('-', '').slice(0, 24);
  const { data: created, error: createError } = await supabase
    .from('ugc_upload_tokens')
    .insert({
      organization_id: creator.organization_id,
      creator_id: creator.id,
      token,
      is_active: true,
      expires_at: null,
      max_uploads: null,
    })
    .select('token')
    .single();

  if (createError) {
    console.error('getOrCreateUploadLink create error:', createError);
    return `${UPLOAD_LINK_BASE}/pendiente`;
  }

  return buildUploadLink(created?.token || token);
}

function buildUploadLink(token: string): string {
  return `${UPLOAD_LINK_BASE}/${token}`;
}

function buildCreatorLink(link: DiscountLink): string {
  return `${PUBLIC_LINK_BASE}/${link.redirect_token}`;
}

function numberValue(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value || 0)));
}

function fillSample(template: string, params: string[]): string {
  return params.reduce((text, param, index) => text.replaceAll(`{{${index + 1}}}`, param), template);
}

function sampleParamsFor(type: NotificationType): string[] {
  switch (type) {
    case 'first_sale': return ['Ana', '$7.200', '$7.200', 'https://upload.dosmicos.com/upload/demo', 'https://ads.dosmicos.com/ugc/demo'];
    case 'sale': return ['Ana', '$7.200', '$56.000', '3', 'https://upload.dosmicos.com/upload/demo', 'https://ads.dosmicos.com/ugc/demo'];
    case 'rank_top5': return ['Ana', '3', '$56.000', 'https://upload.dosmicos.com/upload/demo', 'https://ads.dosmicos.com/ugc/demo'];
    case 'rank_proximity': return ['Ana', '6', '$8.000', '$40.000', 'https://upload.dosmicos.com/upload/demo', 'https://ads.dosmicos.com/ugc/demo'];
    case 'weekly_challenge': return ['Ana', '3 historias reales usando Dosmicos', 'Muestra cómo usas Dosmicos en la vida real, súbelo y cierra con tu link.', 'https://upload.dosmicos.com/upload/demo', 'https://ads.dosmicos.com/ugc/demo'];
  }
}

function getBogotaWeekStartDate(): string {
  const bogotaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const day = bogotaNow.getDay(); // Sunday 0, Monday 1
  const diff = day === 0 ? -6 : 1 - day;
  bogotaNow.setDate(bogotaNow.getDate() + diff);
  bogotaNow.setHours(0, 0, 0, 0);
  return `${bogotaNow.getFullYear()}-${String(bogotaNow.getMonth() + 1).padStart(2, '0')}-${String(bogotaNow.getDate()).padStart(2, '0')}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
