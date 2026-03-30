import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizeColombianPhone } from "../_shared/phone-utils.ts";
import { sendWhatsAppTemplate } from "../_shared/whatsapp-template.ts";

const DEFAULT_TEMPLATE = "hotdays_acceso_anticipado_v2";
const DEFAULT_LANGUAGE = "es_CO";
const DEFAULT_HEADER_IMAGE = "https://cdn.shopify.com/s/files/1/0403/7309/2520/files/Diseno_sin_titulo_2.png?v=1773504829";
const TEST_PHONES = ["573125456340", "573193661150"];

// Extract a phone number from free-text notes
function extractPhoneFromNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const match = note.match(/(?:\+?\s*57\s*)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (!match) return null;
  return match[0].replace(/\D/g, "");
}

interface CampaignRecipient {
  name: string;
  email: string;
  phone: string;
  phoneSource: "contact" | "note";
  shopifyCustomerId: number;
}

async function fetchShopifyHotDaysCustomers(storeDomain: string, accessToken: string): Promise<any[]> {
  let allCustomers: any[] = [];
  let pageUrl: string | null =
    `https://${storeDomain}.myshopify.com/admin/api/2024-01/customers.json?tag=HotDays&limit=250`;

  while (pageUrl) {
    const resp = await fetch(pageUrl, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Shopify API error: ${resp.status} — ${errText}`);
    }

    const data = await resp.json();
    const customers = data.customers || [];
    allCustomers = allCustomers.concat(customers);
    console.log(`  Fetched ${customers.length} customers (total: ${allCustomers.length})`);

    const linkHeader = resp.headers.get("Link") || "";
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    pageUrl = nextMatch ? nextMatch[1] : null;
  }

  return allCustomers;
}

function buildRecipients(allCustomers: any[]): {
  recipients: CampaignRecipient[];
  skippedNoPhone: number;
} {
  const recipients: CampaignRecipient[] = [];
  const seenPhones = new Set<string>();
  let skippedNoPhone = 0;

  for (const customer of allCustomers) {
    const name = [customer.first_name, customer.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || "Cliente";
    const email = customer.email || "";

    let rawPhone = customer.phone || "";
    let phoneSource: "contact" | "note" = "contact";

    if (!rawPhone && customer.note) {
      const notePhone = extractPhoneFromNote(customer.note);
      if (notePhone) {
        rawPhone = notePhone;
        phoneSource = "note";
      }
    }

    if (!rawPhone) {
      skippedNoPhone++;
      continue;
    }

    const normalized = normalizeColombianPhone(rawPhone);
    if (!normalized) {
      skippedNoPhone++;
      continue;
    }

    if (seenPhones.has(normalized)) continue;

    seenPhones.add(normalized);
    recipients.push({ name, email, phone: normalized, phoneSource, shopifyCustomerId: customer.id });
  }

  return { recipients, skippedNoPhone };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      organizationId,
      action = "dry_run", // "test" | "dry_run" | "send" | "send_direct"
      templateName = DEFAULT_TEMPLATE,
      templateLanguage = DEFAULT_LANGUAGE,
      headerImageUrl = DEFAULT_HEADER_IMAGE,
      // Batch params for "send"
      offset = 0,
      batchSize = 0, // 0 = all
      // Direct recipients for "send_direct" — skip Shopify fetch
      directRecipients, // Array<{ name, phone }>
      tag = "HotDays", // Shopify customer tag to filter
      maxSend = 50, // Max recipients per call for send_deduplicated
    } = body;

    if (!organizationId) {
      return json({ error: "organizationId es requerido" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);
    const metaToken = Deno.env.get("META_WHATSAPP_TOKEN") ?? "";

    if (!metaToken) {
      return json({ error: "META_WHATSAPP_TOKEN no configurado" }, 500);
    }

    // ── Get WhatsApp channel ──
    const { data: channel } = await supabase
      .from("messaging_channels")
      .select("id, meta_phone_number_id")
      .eq("organization_id", organizationId)
      .eq("channel_type", "whatsapp")
      .eq("is_active", true)
      .single();

    const phoneNumberId =
      channel?.meta_phone_number_id || Deno.env.get("META_PHONE_NUMBER_ID");

    if (!phoneNumberId) {
      return json({ error: "No se encontró phone_number_id de WhatsApp" }, 500);
    }

    const headerParams = headerImageUrl
      ? [{ type: "image" as const, image: { link: headerImageUrl } }]
      : undefined;

    // ══════════════════════════════════════════════
    //  MODE: DIAGNOSE — check DB for who already received messages (NO SENDING)
    // ══════════════════════════════════════════════
    if (action === "diagnose") {
      // Get all WhatsApp conversations for this org
      const { data: conversations } = await supabase
        .from("messaging_conversations")
        .select("id, external_user_id, contact_name")
        .eq("organization_id", organizationId)
        .eq("channel_type", "whatsapp");

      const convCount = conversations?.length || 0;

      // Find all outbound template messages that look like hotdays campaign
      const alreadySentByMetadata: Array<{ phone: string; name: string; msgId: string; sentAt: string; metadata: any }> = [];
      const alreadySentByContent: Array<{ phone: string; name: string; msgId: string; sentAt: string; content: string }> = [];

      if (conversations && conversations.length > 0) {
        const convMap = new Map(conversations.map((c: any) => [c.id, { phone: c.external_user_id, name: c.contact_name }]));
        const convIds = conversations.map((c: any) => c.id);

        for (let i = 0; i < convIds.length; i += 200) {
          const chunk = convIds.slice(i, i + 200);

          // Check by metadata
          const { data: metaMsgs } = await supabase
            .from("messaging_messages")
            .select("id, conversation_id, sent_at, metadata")
            .in("conversation_id", chunk)
            .eq("direction", "outbound")
            .contains("metadata", { campaign: "hotdays" });

          if (metaMsgs) {
            for (const msg of metaMsgs) {
              const info = convMap.get(msg.conversation_id);
              if (info) alreadySentByMetadata.push({ phone: info.phone, name: info.name, msgId: msg.id, sentAt: msg.sent_at, metadata: msg.metadata });
            }
          }

          // Check by content (backup — older messages might not have metadata)
          const { data: contentMsgs } = await supabase
            .from("messaging_messages")
            .select("id, conversation_id, sent_at, content, metadata")
            .in("conversation_id", chunk)
            .eq("direction", "outbound")
            .eq("message_type", "template")
            .like("content", "%HotDays%");

          if (contentMsgs) {
            for (const msg of contentMsgs) {
              const info = convMap.get(msg.conversation_id);
              if (info) alreadySentByContent.push({ phone: info.phone, name: info.name, msgId: msg.id, sentAt: msg.sent_at, content: msg.content });
            }
          }
        }
      }

      // Unique phones sent by metadata vs content
      const phonesByMetadata = new Set(alreadySentByMetadata.map(m => m.phone));
      const phonesByContent = new Set(alreadySentByContent.map(m => m.phone));
      const allSentPhones = new Set([...phonesByMetadata, ...phonesByContent]);

      // Count duplicates (same phone, multiple messages)
      const phoneMsgCount: Record<string, number> = {};
      for (const m of alreadySentByContent) {
        phoneMsgCount[m.phone] = (phoneMsgCount[m.phone] || 0) + 1;
      }
      const duplicates = Object.entries(phoneMsgCount).filter(([_, count]) => count > 1).map(([phone, count]) => ({ phone, count }));

      // Also check: are there ANY conversations at all for this org?
      const { data: anyConvs, count: anyConvCount } = await supabase
        .from("messaging_conversations")
        .select("id, external_user_id, channel_type, organization_id", { count: "exact" })
        .eq("organization_id", organizationId)
        .limit(5);

      // Check without org filter
      const { data: allConvs, count: allConvCount } = await supabase
        .from("messaging_conversations")
        .select("id, external_user_id, channel_type, organization_id", { count: "exact" })
        .eq("channel_type", "whatsapp")
        .limit(5);

      // Check for hotdays messages directly (no conversation join)
      const { data: directMsgs, count: directMsgCount } = await supabase
        .from("messaging_messages")
        .select("id, conversation_id, content, metadata, sent_at", { count: "exact" })
        .eq("direction", "outbound")
        .eq("message_type", "template")
        .like("content", "%HotDays%")
        .limit(5);

      return json({
        action: "diagnose",
        totalConversations: convCount,
        sentByMetadata: alreadySentByMetadata.length,
        sentByContent: alreadySentByContent.length,
        uniquePhonesByMetadata: phonesByMetadata.size,
        uniquePhonesByContent: phonesByContent.size,
        uniquePhonesTotal: allSentPhones.size,
        duplicates: duplicates.length > 0 ? duplicates : undefined,
        sampleByMetadata: alreadySentByMetadata.slice(0, 5),
        sampleByContent: alreadySentByContent.slice(0, 5),
        debug: {
          convsForOrg: { count: anyConvCount, sample: anyConvs },
          allWhatsappConvs: { count: allConvCount, sample: allConvs },
          directHotdaysMsgs: { count: directMsgCount, sample: directMsgs },
        }
      });
    }

    // ══════════════════════════════════════════════
    //  MODE: FETCH_PAGE — return one page of Shopify customers
    // ══════════════════════════════════════════════
    if (action === "fetch_page") {
      const { data: org } = await supabase
        .from("organizations")
        .select("shopify_credentials, shopify_store_url")
        .eq("id", organizationId)
        .single();

      const creds = org?.shopify_credentials as any;
      const storeDomain = (
        creds?.store_domain || creds?.shopDomain || org?.shopify_store_url || ""
      ).replace(".myshopify.com", "");
      const accessTokenShopify = creds?.access_token || creds?.accessToken;

      if (!storeDomain || !accessTokenShopify) {
        return json({ error: "Credenciales de Shopify no configuradas" }, 500);
      }

      // Use search endpoint for tag filtering (customers.json doesn't support tag filter)
      const pageUrl = body.pageUrl ||
        `https://${storeDomain}.myshopify.com/admin/api/2024-01/customers/search.json?query=${encodeURIComponent(`tag:${tag}`)}&limit=250`;

      const resp = await fetch(pageUrl, {
        headers: {
          "X-Shopify-Access-Token": accessTokenShopify,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return json({ error: `Shopify API error: ${resp.status}`, details: errText }, 500);
      }

      const data = await resp.json();
      const customers = data.customers || [];

      // Extract phones
      const recipients: Array<{ name: string; phone: string; email: string; source: string }> = [];
      let skipped = 0;
      const seenPhones = new Set<string>();

      for (const customer of customers) {
        const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Cliente";
        const email = customer.email || "";

        let rawPhone = customer.phone || "";
        let source = "contact";

        if (!rawPhone && customer.note) {
          const notePhone = extractPhoneFromNote(customer.note);
          if (notePhone) {
            rawPhone = notePhone;
            source = "note";
          }
        }

        if (!rawPhone) { skipped++; continue; }
        const normalized = normalizeColombianPhone(rawPhone);
        if (!normalized) { skipped++; continue; }
        if (seenPhones.has(normalized)) continue;
        seenPhones.add(normalized);
        recipients.push({ name, phone: normalized, email, source });
      }

      // Check Link header for next page
      const linkHeader = resp.headers.get("Link") || "";
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      const nextPageUrl = nextMatch ? nextMatch[1] : null;

      return json({
        action: "fetch_page",
        customersInPage: customers.length,
        recipientsInPage: recipients.length,
        skippedInPage: skipped,
        nextPageUrl,
        recipients,
      });
    }

    // ══════════════════════════════════════════════
    //  MODE: REGISTER_WEBHOOK — register Shopify customer webhook
    // ══════════════════════════════════════════════
    if (action === "register_webhook") {
      const { data: org } = await supabase
        .from("organizations")
        .select("shopify_credentials, shopify_store_url")
        .eq("id", organizationId)
        .single();

      const creds = org?.shopify_credentials as any;
      const storeDomain = (
        creds?.store_domain || creds?.shopDomain || org?.shopify_store_url || ""
      ).replace(".myshopify.com", "");
      const accessTokenShopify = creds?.access_token || creds?.accessToken;

      if (!storeDomain || !accessTokenShopify) {
        return json({ error: "Credenciales de Shopify no configuradas" }, 500);
      }

      const webhookUrl = body.webhookUrl || `${Deno.env.get("SUPABASE_URL")}/functions/v1/shopify-customer-tag-webhook`;
      const topic = body.topic || "customers/update";

      // Check existing webhooks first
      const listResp = await fetch(
        `https://${storeDomain}.myshopify.com/admin/api/2024-01/webhooks.json?topic=${topic}`,
        {
          headers: { "X-Shopify-Access-Token": accessTokenShopify, "Content-Type": "application/json" },
        }
      );
      const existing = await listResp.json();
      const existingWebhooks = existing.webhooks || [];

      // Check if already registered
      const alreadyExists = existingWebhooks.find((w: any) => w.address === webhookUrl);
      if (alreadyExists) {
        return json({ status: "already_exists", webhook: alreadyExists });
      }

      // Register new webhook
      const createResp = await fetch(
        `https://${storeDomain}.myshopify.com/admin/api/2024-01/webhooks.json`,
        {
          method: "POST",
          headers: { "X-Shopify-Access-Token": accessTokenShopify, "Content-Type": "application/json" },
          body: JSON.stringify({
            webhook: {
              topic,
              address: webhookUrl,
              format: "json",
            },
          }),
        }
      );

      const result = await createResp.json();
      if (!createResp.ok) {
        return json({ error: "Failed to register webhook", details: result }, 500);
      }

      return json({ status: "registered", webhook: result.webhook });
    }

    // ══════════════════════════════════════════════
    //  MODE: TEST
    // ══════════════════════════════════════════════
    if (action === "test") {
      const results: Array<{ phone: string; ok: boolean; error?: string }> = [];

      for (const phone of TEST_PHONES) {
        const result = await sendWhatsAppTemplate(
          phoneNumberId, metaToken, phone, templateName, templateLanguage,
          [], undefined, headerParams
        );
        results.push({
          phone,
          ok: result.ok,
          error: result.ok ? undefined : JSON.stringify(result.error),
        });
        await new Promise((r) => setTimeout(r, 500));
      }

      return json({
        action: "test",
        template: templateName,
        results,
        sent: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      });
    }

    // ══════════════════════════════════════════════
    //  MODE: SEND_DIRECT — send to provided phone list (skip Shopify)
    // ══════════════════════════════════════════════
    if (action === "send_direct" && directRecipients?.length > 0) {
      console.log(`🚀 SEND_DIRECT: ${directRecipients.length} recipients`);

      let sent = 0;
      let failed = 0;
      const errors: Array<{ phone: string; name: string; error: string }> = [];
      const sentList: Array<{ name: string; phone: string }> = [];

      for (const recipient of directRecipients) {
        try {
          const result = await sendWhatsAppTemplate(
            phoneNumberId, metaToken, recipient.phone, templateName, templateLanguage,
            [], undefined, headerParams
          );

          if (result.ok) {
            sent++;
            sentList.push({ name: recipient.name, phone: recipient.phone });
            console.log(`  ✅ ${recipient.name} (${recipient.phone})`);

            // Fire-and-forget DB write
            saveMessageToDB(supabase, organizationId, channel?.id, recipient, result.messageId, templateName).catch(
              (e) => console.error(`  ⚠️ DB error ${recipient.phone}:`, e)
            );
          } else {
            failed++;
            const errMsg = JSON.stringify(result.error);
            console.error(`  ❌ ${recipient.name} (${recipient.phone}): ${errMsg}`);
            errors.push({ phone: recipient.phone, name: recipient.name, error: errMsg });
          }
        } catch (err: any) {
          failed++;
          errors.push({ phone: recipient.phone, name: recipient.name, error: err.message });
        }

        // 200ms delay between sends
        await new Promise((r) => setTimeout(r, 200));
      }

      return json({
        action: "send_direct",
        template: templateName,
        totalRecipients: directRecipients.length,
        sent,
        failed,
        sentList,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // ══════════════════════════════════════════════
    //  MODE: SEND_DEDUPLICATED — fetch tag, check DB, send only new
    // ══════════════════════════════════════════════
    if (action === "send_deduplicated") {
      const { data: org } = await supabase
        .from("organizations")
        .select("shopify_credentials, shopify_store_url")
        .eq("id", organizationId)
        .single();

      const creds = org?.shopify_credentials as any;
      const storeDomain = (
        creds?.store_domain || creds?.shopDomain || org?.shopify_store_url || ""
      ).replace(".myshopify.com", "");
      const accessTokenShopify = creds?.access_token || creds?.accessToken;

      if (!storeDomain || !accessTokenShopify) {
        return json({ error: "Credenciales de Shopify no configuradas" }, 500);
      }

      // Fetch ALL pages of customers with this tag
      const allRecipients: Array<{ name: string; phone: string; email: string; source: string }> = [];
      const seenPhones = new Set<string>();
      let skipped = 0;
      let totalCustomers = 0;
      let pageUrl: string | null =
        `https://${storeDomain}.myshopify.com/admin/api/2024-01/customers/search.json?query=${encodeURIComponent(`tag:${tag}`)}&limit=250`;

      while (pageUrl) {
        const resp = await fetch(pageUrl, {
          headers: { "X-Shopify-Access-Token": accessTokenShopify, "Content-Type": "application/json" },
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return json({ error: `Shopify API error: ${resp.status}`, details: errText }, 500);
        }
        const data = await resp.json();
        const customers = data.customers || [];
        totalCustomers += customers.length;

        for (const customer of customers) {
          const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Cliente";
          const email = customer.email || "";
          let rawPhone = customer.phone || "";
          let source = "contact";
          if (!rawPhone && customer.note) {
            const notePhone = extractPhoneFromNote(customer.note);
            if (notePhone) { rawPhone = notePhone; source = "note"; }
          }
          if (!rawPhone) { skipped++; continue; }
          const normalized = normalizeColombianPhone(rawPhone);
          if (!normalized) { skipped++; continue; }
          if (seenPhones.has(normalized)) continue;
          seenPhones.add(normalized);
          allRecipients.push({ name, phone: normalized, email, source });
        }

        const linkHeader = resp.headers.get("Link") || "";
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        pageUrl = nextMatch ? nextMatch[1] : null;
      }

      console.log(`📋 Tag "${tag}": ${totalCustomers} customers, ${allRecipients.length} with phone, ${skipped} skipped`);

      // ── Check DB for already-sent phones (per-phone lookup) ──
      const alreadySentPhones = new Set<string>();

      // Check each recipient's phone individually against the DB
      for (const recipient of allRecipients) {
        const { data: conv } = await supabase
          .from("messaging_conversations")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("external_user_id", recipient.phone)
          .eq("channel_type", "whatsapp")
          .maybeSingle();

        if (conv) {
          const { data: sentMsg } = await supabase
            .from("messaging_messages")
            .select("id")
            .eq("conversation_id", conv.id)
            .eq("direction", "outbound")
            .contains("metadata", { campaign: "hotdays" })
            .limit(1);

          if (sentMsg && sentMsg.length > 0) {
            alreadySentPhones.add(recipient.phone);
          }
        }
      }

      const allNewRecipients = allRecipients.filter((r) => !alreadySentPhones.has(r.phone));
      // Apply maxSend limit
      const newRecipients = allNewRecipients.slice(0, maxSend);
      const remaining = allNewRecipients.length - newRecipients.length;
      console.log(`🔍 Already sent: ${alreadySentPhones.size}, New total: ${allNewRecipients.length}, Sending now: ${newRecipients.length}, Remaining: ${remaining}`);

      // ── Send to new recipients ──
      let sent = 0;
      let failed = 0;
      const errors: Array<{ phone: string; name: string; error: string }> = [];
      const sentList: Array<{ name: string; phone: string }> = [];

      for (const recipient of newRecipients) {
        try {
          const result = await sendWhatsAppTemplate(
            phoneNumberId, metaToken, recipient.phone, templateName, templateLanguage,
            [], undefined, headerParams
          );

          if (result.ok) {
            sent++;
            sentList.push({ name: recipient.name, phone: recipient.phone });
            console.log(`  ✅ ${recipient.name} (${recipient.phone})`);

            saveMessageToDB(supabase, organizationId, channel?.id, recipient, result.messageId, templateName).catch(
              (e) => console.error(`  ⚠️ DB error ${recipient.phone}:`, e)
            );
          } else {
            failed++;
            const errMsg = JSON.stringify(result.error);
            console.error(`  ❌ ${recipient.name} (${recipient.phone}): ${errMsg}`);
            errors.push({ phone: recipient.phone, name: recipient.name, error: errMsg });
          }
        } catch (err: any) {
          failed++;
          errors.push({ phone: recipient.phone, name: recipient.name, error: err.message });
        }

        await new Promise((r) => setTimeout(r, 200));
      }

      return json({
        action: "send_deduplicated",
        tag,
        template: templateName,
        totalCustomers,
        totalWithPhone: allRecipients.length,
        skippedNoPhone: skipped,
        alreadySent: alreadySentPhones.size,
        newToSend: allNewRecipients.length,
        sentThisBatch: newRecipients.length,
        remaining,
        sent,
        failed,
        sentList,
        errors: errors.length > 0 ? errors : undefined,
        done: remaining === 0,
        // When maxSend=0 (dry run), include the full pending list
        ...(maxSend === 0 ? { pendingRecipients: allNewRecipients.map(r => ({ name: r.name, phone: r.phone })) } : {}),
      });
    }

    // ══════════════════════════════════════════════
    //  Fetch Shopify customers with tag "HotDays"
    // ══════════════════════════════════════════════
    const { data: org } = await supabase
      .from("organizations")
      .select("shopify_credentials, shopify_store_url")
      .eq("id", organizationId)
      .single();

    const creds = org?.shopify_credentials as any;
    const storeDomain = (
      creds?.store_domain || creds?.shopDomain || org?.shopify_store_url || ""
    ).replace(".myshopify.com", "");
    const accessToken = creds?.access_token || creds?.accessToken;

    if (!storeDomain || !accessToken) {
      return json({ error: "Credenciales de Shopify no configuradas" }, 500);
    }

    console.log(`📦 Fetching Shopify customers with tag "HotDays" from ${storeDomain}...`);
    const allCustomers = await fetchShopifyHotDaysCustomers(storeDomain, accessToken);
    console.log(`📋 Total customers with HotDays tag: ${allCustomers.length}`);

    const { recipients: allRecipients, skippedNoPhone } = buildRecipients(allCustomers);

    console.log(`📊 Con teléfono válido: ${allRecipients.length}, sin teléfono: ${skippedNoPhone}`);

    // Apply batch slicing
    const start = offset;
    const end = batchSize > 0 ? offset + batchSize : allRecipients.length;
    const recipients = allRecipients.slice(start, end);

    // ══════════════════════════════════════════════
    //  MODE: DRY_RUN
    // ══════════════════════════════════════════════
    if (action === "dry_run") {
      return json({
        action: "dry_run",
        template: templateName,
        totalCustomers: allCustomers.length,
        recipientsWithPhone: allRecipients.length,
        skippedNoPhone,
        fromContact: allRecipients.filter((r) => r.phoneSource === "contact").length,
        fromNotes: allRecipients.filter((r) => r.phoneSource === "note").length,
        batchInfo: batchSize > 0 ? { offset: start, batchSize, batchCount: recipients.length } : "all",
        recipients: recipients.map((r) => ({
          name: r.name,
          email: r.email,
          phone: r.phone,
          source: r.phoneSource,
        })),
      });
    }

    // ══════════════════════════════════════════════
    //  MODE: SEND
    // ══════════════════════════════════════════════
    if (action !== "send") {
      return json({ error: `Acción inválida: "${action}". Use "test", "dry_run", "send" o "send_direct".` }, 400);
    }

    console.log(`\n🚀 SENDING campaign to ${recipients.length} recipients (offset=${start})...`);

    let sent = 0;
    let failed = 0;
    const errors: Array<{ phone: string; name: string; error: string }> = [];
    const sentList: Array<{ name: string; phone: string }> = [];

    for (const recipient of recipients) {
      try {
        const result = await sendWhatsAppTemplate(
          phoneNumberId, metaToken, recipient.phone, templateName, templateLanguage,
          [], undefined, headerParams
        );

        if (result.ok) {
          sent++;
          sentList.push({ name: recipient.name, phone: recipient.phone });
          console.log(`  ✅ ${recipient.name} (${recipient.phone})`);

          // Fire-and-forget DB write
          saveMessageToDB(supabase, organizationId, channel?.id, recipient, result.messageId, templateName).catch(
            (e) => console.error(`  ⚠️ DB error ${recipient.phone}:`, e)
          );
        } else {
          failed++;
          const errMsg = JSON.stringify(result.error);
          console.error(`  ❌ ${recipient.name} (${recipient.phone}): ${errMsg}`);
          errors.push({ phone: recipient.phone, name: recipient.name, error: errMsg });
        }
      } catch (err: any) {
        failed++;
        errors.push({ phone: recipient.phone, name: recipient.name, error: err.message });
      }

      // 200ms delay between sends (Meta allows ~80msg/s for business)
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`\n✅ Campaign batch complete: ${sent} sent, ${failed} failed`);

    return json({
      action: "send",
      template: templateName,
      totalCustomers: allCustomers.length,
      recipientsWithPhone: allRecipients.length,
      skippedNoPhone,
      batch: { offset: start, batchSize: recipients.length, totalRecipients: allRecipients.length },
      sent,
      failed,
      sentList,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("Campaign error:", err);
    return json({ error: err.message || "Error interno" }, 500);
  }
});

// Fire-and-forget helper to save message to DB
async function saveMessageToDB(
  supabase: any,
  organizationId: string,
  channelId: string | null,
  recipient: { name: string; phone: string },
  messageId: string | undefined,
  templateName: string
) {
  let conversationId: string | null = null;

  const { data: existingConv } = await supabase
    .from("messaging_conversations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("external_user_id", recipient.phone)
    .eq("channel_type", "whatsapp")
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const { data: newConv } = await supabase
      .from("messaging_conversations")
      .insert({
        organization_id: organizationId,
        external_user_id: recipient.phone,
        channel_type: "whatsapp",
        channel_id: channelId || null,
        contact_name: recipient.name,
        ai_managed: true,
        status: "active",
      })
      .select("id")
      .single();
    conversationId = newConv?.id || null;
  }

  if (conversationId) {
    await supabase.from("messaging_messages").insert({
      conversation_id: conversationId,
      external_message_id: messageId,
      channel_type: "whatsapp",
      direction: "outbound",
      sender_type: "agent",
      content: "🔥 Campaña HotDays — Acceso anticipado con contraseña HOTMICOS",
      message_type: "template",
      metadata: { template_name: templateName, campaign: "hotdays" },
      sent_at: new Date().toISOString(),
    });

    await supabase
      .from("messaging_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: "🔥 Campaña HotDays — Acceso anticipado",
      })
      .eq("id", conversationId);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
