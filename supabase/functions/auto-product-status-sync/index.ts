// Auto product status sync — corre diario, activa productos con stock + fotos
// que estén en DRAFT, y desactiva productos ACTIVE sin inventario para que el
// storefront no muestre "AGOTADO". Audit trail en product_status_audit.
//
// Triggered by: scheduled routine (Anthropic) — POST con service_role key.
//
// Env vars:
//   SHOPIFY_STORE_DOMAIN, SHOPIFY_ACCESS_TOKEN  (Admin API auth)
//   AUTO_PRODUCT_STATUS_DRY_RUN                 ('true' | 'false', default 'true')
//   AUTO_PRODUCT_STATUS_MAX_CHANGES             (default '50')
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID        (resumen diario)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SHOPIFY_API_VERSION = '2024-10';
const RATE_LIMIT_MS = 1100;

interface ShopifyProduct {
  id: string;
  legacyResourceId: string;
  title: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  totalInventory: number;
  tags: string[];
  imagesCount: number;
}

interface SyncDecision {
  product: ShopifyProduct;
  action: 'activate' | 'deactivate' | 'skip';
  reason: string;
}

interface SyncSummary {
  dry_run: boolean;
  scanned: number;
  to_activate: number;
  to_deactivate: number;
  applied_activations: number;
  applied_deactivations: number;
  skipped_for_cap: number;
  errors: number;
  details: Array<{ id: string; title: string; action: string; reason: string; error?: string }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchAllProducts(domain: string, token: string): Promise<ShopifyProduct[]> {
  const url = `https://${domain}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const products: ShopifyProduct[] = [];
  let cursor: string | null = null;

  while (true) {
    const query = `
      query($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              legacyResourceId
              title
              status
              totalInventory
              tags
              images(first: 1) { edges { node { id } } }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { first: 100, after: cursor } }),
    });

    if (!resp.ok) {
      throw new Error(`Shopify GraphQL error ${resp.status}: ${await resp.text()}`);
    }

    const json = await resp.json();
    if (json.errors) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    const edges = json.data?.products?.edges ?? [];
    for (const edge of edges) {
      const n = edge.node;
      products.push({
        id: n.id,
        legacyResourceId: n.legacyResourceId,
        title: n.title,
        status: n.status,
        totalInventory: n.totalInventory ?? 0,
        tags: n.tags ?? [],
        imagesCount: (n.images?.edges?.length ?? 0),
      });
    }

    if (!json.data?.products?.pageInfo?.hasNextPage) break;
    cursor = json.data.products.pageInfo.endCursor;
    await sleep(300);
  }

  return products;
}

function classify(product: ShopifyProduct): SyncDecision {
  if (product.tags.map((t) => t.toLowerCase()).includes('no-auto-status')) {
    return { product, action: 'skip', reason: 'tag no-auto-status presente' };
  }

  const hasInventory = (product.totalInventory ?? 0) > 0;
  const hasImages = product.imagesCount > 0;

  if (product.status === 'DRAFT' && hasInventory && hasImages) {
    return { product, action: 'activate', reason: 'inventario reabastecido + tiene imágenes' };
  }

  if (product.status === 'ACTIVE' && !hasInventory) {
    return { product, action: 'deactivate', reason: 'sin inventario en ninguna variante' };
  }

  if (product.status === 'DRAFT' && hasInventory && !hasImages) {
    return { product, action: 'skip', reason: 'tiene inventario pero falta imagen — requiere atención manual' };
  }

  return { product, action: 'skip', reason: 'estado correcto, sin cambios necesarios' };
}

async function updateProductStatus(
  domain: string,
  token: string,
  productGid: string,
  newStatus: 'ACTIVE' | 'DRAFT'
): Promise<{ ok: boolean; error?: string }> {
  const url = `https://${domain}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const mutation = `
    mutation($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id status }
        userErrors { field message }
      }
    }
  `;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: { input: { id: productGid, status: newStatus } },
    }),
  });

  if (!resp.ok) {
    return { ok: false, error: `HTTP ${resp.status}: ${await resp.text()}` };
  }

  const json = await resp.json();
  const userErrors = json.data?.productUpdate?.userErrors ?? [];
  if (userErrors.length > 0) {
    return { ok: false, error: userErrors.map((e: any) => `${e.field}: ${e.message}`).join('; ') };
  }
  return { ok: true };
}

async function sendTelegramSummary(summary: SyncSummary): Promise<void> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  if (!token || !chatId) {
    console.log('⚠️ Telegram no configurado, saltando notificación');
    return;
  }

  const tag = summary.dry_run ? '🟡 DRY-RUN' : '🟢 LIVE';
  const lines = [
    `*Daily Product Status Sync* ${tag}`,
    ``,
    `📊 Escaneados: ${summary.scanned}`,
    `🟢 Activados: ${summary.applied_activations}/${summary.to_activate}`,
    `🔴 Desactivados: ${summary.applied_deactivations}/${summary.to_deactivate}`,
  ];
  if (summary.skipped_for_cap > 0) lines.push(`⚠️ Saltados por cap: ${summary.skipped_for_cap}`);
  if (summary.errors > 0) lines.push(`❌ Errores: ${summary.errors}`);

  if (summary.details.length > 0) {
    lines.push('');
    lines.push('*Cambios:*');
    for (const d of summary.details.slice(0, 15)) {
      const icon = d.action === 'activate' ? '🟢' : d.action === 'deactivate' ? '🔴' : '⚠️';
      lines.push(`${icon} ${d.title.slice(0, 60)} — ${d.reason}`);
    }
    if (summary.details.length > 15) {
      lines.push(`_…y ${summary.details.length - 15} más en audit table_`);
    }
  }

  const text = lines.join('\n');

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    if (!resp.ok) {
      console.error(`Telegram error ${resp.status}:`, await resp.text());
    }
  } catch (e) {
    console.error('Telegram send failed:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rawDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const token = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    if (!rawDomain || !token) {
      throw new Error('SHOPIFY_STORE_DOMAIN o SHOPIFY_ACCESS_TOKEN no configurados');
    }
    const domain = rawDomain.includes('.myshopify.com')
      ? rawDomain.replace('.myshopify.com', '')
      : rawDomain;

    const dryRun = (Deno.env.get('AUTO_PRODUCT_STATUS_DRY_RUN') ?? 'true').toLowerCase() === 'true';
    const maxChanges = Number(Deno.env.get('AUTO_PRODUCT_STATUS_MAX_CHANGES') ?? '50');

    let body: any = {};
    try { body = await req.json(); } catch (_) {}
    const triggeredBy = body.triggered_by ?? 'cron';
    const requestedOrgId: string | undefined = body.organization_id;

    let organizationId: string | null = requestedOrgId ?? null;
    if (!organizationId) {
      const fullDomain = `https://${domain}.myshopify.com`;
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('shopify_store_url', fullDomain)
        .maybeSingle();
      organizationId = org?.id ?? null;
    }

    console.log(`🛒 auto-product-status-sync: dry_run=${dryRun}, max=${maxChanges}, org=${organizationId}`);

    const products = await fetchAllProducts(domain, token);
    console.log(`📦 Escaneados: ${products.length} productos`);

    const decisions = products.map(classify);
    const toActivate = decisions.filter((d) => d.action === 'activate');
    const toDeactivate = decisions.filter((d) => d.action === 'deactivate');

    const summary: SyncSummary = {
      dry_run: dryRun,
      scanned: products.length,
      to_activate: toActivate.length,
      to_deactivate: toDeactivate.length,
      applied_activations: 0,
      applied_deactivations: 0,
      skipped_for_cap: 0,
      errors: 0,
      details: [],
    };

    const changeQueue = [...toActivate, ...toDeactivate];
    const queueAfterCap = changeQueue.slice(0, maxChanges);
    summary.skipped_for_cap = changeQueue.length - queueAfterCap.length;

    for (const decision of queueAfterCap) {
      const { product, action, reason } = decision;
      const newStatus: 'ACTIVE' | 'DRAFT' = action === 'activate' ? 'ACTIVE' : 'DRAFT';
      let appliedAction: 'activated' | 'deactivated' | 'error' = action === 'activate' ? 'activated' : 'deactivated';
      let errorMsg: string | undefined;

      if (!dryRun) {
        const result = await updateProductStatus(domain, token, product.id, newStatus);
        if (!result.ok) {
          appliedAction = 'error';
          errorMsg = result.error;
          summary.errors++;
        } else if (action === 'activate') {
          summary.applied_activations++;
        } else {
          summary.applied_deactivations++;
        }
        await sleep(RATE_LIMIT_MS);
      } else {
        if (action === 'activate') summary.applied_activations++;
        else summary.applied_deactivations++;
      }

      summary.details.push({
        id: product.legacyResourceId,
        title: product.title,
        action,
        reason,
        ...(errorMsg ? { error: errorMsg } : {}),
      });

      if (organizationId) {
        await supabase.from('product_status_audit').insert({
          organization_id: organizationId,
          shopify_product_gid: product.id,
          shopify_product_id: product.legacyResourceId,
          product_title: product.title,
          action: appliedAction,
          reason,
          previous_status: product.status,
          new_status: appliedAction === 'error' ? null : newStatus,
          total_inventory: product.totalInventory,
          has_images: product.imagesCount > 0,
          was_dry_run: dryRun,
          triggered_by: triggeredBy,
          error_message: errorMsg ?? null,
        });
      }
    }

    console.log(
      `✅ Done — activated=${summary.applied_activations}, deactivated=${summary.applied_deactivations}, errors=${summary.errors}, dry_run=${dryRun}`
    );

    await sendTelegramSummary(summary);

    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('❌ auto-product-status-sync error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
