import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canonicalCarrier } from "../_shared/carrier.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ListRequest {
  date?: string;    // YYYY-MM-DD, defaults to today (Colombia UTC-5)
  carrier?: string; // e.g. "coordinadora", "interrapidisimo"
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ENVIA_API_KEY = Deno.env.get('ENVIA_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!ENVIA_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'ENVIA_API_KEY no configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: ListRequest = req.method === 'POST' ? await req.json() : {};

    // Today's date in Colombia time (UTC-5)
    const now = new Date();
    const colombiaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const today = body.date || colombiaNow.toISOString().split('T')[0];

    // Cutoff: include guides from the last 7 days (so yesterday's guides also appear)
    const cutoffDate = (() => {
      const d = new Date(colombiaNow.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    })();

    // Tighter window for guides that already left 'created' (e.g. 'in_transit'):
    // only today/yesterday, so same-day status-flips are recovered while older,
    // already-shipped guides don't reappear in the dialog.
    const recentDate = (() => {
      const d = new Date(colombiaNow.getTime() - 1 * 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    })();

    // Extract MM and YYYY from today's date (for the Envia API endpoint)
    const [yyyy, mm] = today.split('-');

    console.log(`📋 Listing Envia shipments — today: ${today}, cutoff: ${cutoffDate}, carrier: ${body.carrier || 'all'}`);

    // Accent-insensitive normalization for carrier name matching.
    // Without this, "Interrapidísimo" (with accent) vs "interrapidisimo" (without)
    // causes the carrier filter to drop all Interrapidísimo guides from the API
    // result, resulting in an empty enviaShipments array and a DB-only fallback.
    const normalizeCarrier = (s: string) =>
      s.toLowerCase()
       .normalize('NFD')
       .replace(/[̀-ͯ]/g, '') // strip combining diacritics
       .replace(/\s/g, '');

    // ─── Resolve org from auth token ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    let orgId: string | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: membership } = await supabase
          .from('organization_users')  // NOTE: correct table (not organization_members)
          .select('organization_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        orgId = membership?.organization_id || null;
      }
    } catch (e) {
      console.warn('Auth resolution failed:', e);
    }

    // ─── 1. Envia Queries API — GET /guide/{MM}/{YYYY} ────────────────────────
    // Correct base URL: https://queries.envia.com (NOT https://api.envia.com)
    const queriesUrl = `https://queries.envia.com/guide/${mm}/${yyyy}`;
    console.log(`🔍 Calling Envia Queries API: GET ${queriesUrl}`);

    let enviaShipments: any[] = [];
    let enviaOk = false;
    let apiDebugInfo: any = null; // surfaced in response for diagnostics

    try {
      // The Envia Queries API paginates at 300 guides per page via ?page=N and
      // returns NO pagination metadata. We loop until a page comes back with
      // fewer than a full page (the last page). Without this we only fetched the
      // first 300 guides — so on high-volume months (e.g. 1600+/month) most
      // guides never appeared as "available", effectively capping a manifest.
      const PAGE_SIZE = 300;
      const MAX_PAGES = 50; // safety cap (15,000 guides) to avoid an infinite loop
      const all: any[] = [];
      let firstPageOk = false;
      let lastStatus = 0;
      let firstItem: any = null;

      for (let page = 1; page <= MAX_PAGES; page++) {
        const pageUrl = page === 1 ? queriesUrl : `${queriesUrl}?page=${page}`;
        const res = await fetch(pageUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${ENVIA_API_KEY}`,
            'accept': 'application/json',
          },
        });
        lastStatus = res.status;

        const raw = await res.text();
        let data: any = null;
        try { data = JSON.parse(raw); } catch { data = null; }

        if (!res.ok || !Array.isArray(data?.data)) {
          if (page === 1) {
            console.warn(`⚠️ Envia Queries API unexpected response: status=${res.status}, preview: ${raw.slice(0, 300)}`);
          } else {
            console.warn(`⚠️ Envia Queries API page ${page} failed (status=${res.status}); using ${all.length} guides gathered so far`);
          }
          break;
        }

        const pageItems = data.data as any[];
        if (page === 1) {
          firstPageOk = true;
          firstItem = pageItems[0] || null;
        }
        all.push(...pageItems);
        console.log(`  → page ${page}: ${pageItems.length} guides (accumulated ${all.length})`);

        // Last page: a non-full page means there are no more.
        if (pageItems.length < PAGE_SIZE) break;
      }

      apiDebugInfo = {
        status: lastStatus,
        ok: firstPageOk,
        totalFromApi: all.length,
        firstItemKeys: firstItem ? Object.keys(firstItem) : [],
      };

      if (firstPageOk) {
        // Filter to last 7 days (API returns full month).
        // Only include guides with status "created" — guides already picked up,
        // in transit, delivered, or cancelled must not appear in the manifest dialog.
        // Also exclude incoming collection guides (consignee = our own office).
        const recentShipments = all.filter((s: any) => {
          // ── Date range ─────────────────────────────────────────────────────────
          const created = s.created_at || s.createdAt || s.date || '';
          // Normalize to YYYY-MM-DD prefix (works for both "2026-05-03 12:19:36" and ISO)
          const createdDate = created.slice(0, 10);
          if (createdDate < cutoffDate) return false;

          // ── Status: the API only SUPPLEMENTS 'created' portal-only guides ─────
          // Recent 'in_transit' guides are recovered from the local DB (tighter
          // window); the API must not re-introduce older, already-shipped ones.
          const rawStatus = s.status || s.status_id || s.status_label || s.statusLabel || '';
          const status = String(rawStatus).toLowerCase();
          if (status !== 'created') return false;

          // ── Exclude incoming/collection guides (destination = our own office) ──
          // These guides are created in Envia to collect merchandise from suppliers;
          // the consignee is Dosmicos SAS, not a customer.
          // Detected via consignee name OR NIT (901412407 = Dosmicos SAS).
          const consigneeName = (s.consignee_name || s.consignee_company_name || '').toLowerCase();
          const consigneeNit = String(s.consignee_identification_number || '');
          if (consigneeName.includes('dosmicos') || consigneeNit === '901412407') return false;

          return true;
        });

        // Apply carrier filter — carrier name is in `name` field (e.g. "interRapidisimo").
        // Use accent-insensitive comparison so "Interrapidísimo" matches "interrapidisimo".
        const filtered = body.carrier
          ? recentShipments.filter((s: any) => {
              const apiCarrier = normalizeCarrier(s.name || s.carrier || '');
              const filterCarrier = normalizeCarrier(body.carrier!);
              return apiCarrier.includes(filterCarrier) || filterCarrier.includes(apiCarrier);
            })
          : recentShipments;

        enviaShipments = filtered;
        enviaOk = true;
        console.log(`✅ Envia Queries API OK — ${all.length} total this month (paginated), ${recentShipments.length} eligible in last 7 days, ${filtered.length} after carrier filter`);
      } else {
        console.warn(`⚠️ Envia Queries API returned no usable data (status=${lastStatus})`);
      }
    } catch (e) {
      console.warn(`⚠️ Envia Queries API fetch error: ${e}`);
    }

    // ─── 2. Local DB — authoritative base of pending guides ───────────────────
    // shipping_labels.status is kept fresh by envia-tracking-webhook, so the
    // local table is the source of truth. Two windows (Colombia is UTC-5, so
    // 00:00 local == 05:00 UTC; no upper bound needed — no future labels):
    //   • 'created'    → last 7 days (genuinely not picked up yet).
    //   • 'in_transit' → today/yesterday only (same-day status-flips that would
    //     otherwise vanish; older in_transit guides have already shipped).
    let dbShipments: any[] = [];
    if (orgId) {
      const carrierCanon = body.carrier ? canonicalCarrier(body.carrier) : null;
      const cols = 'id, shopify_order_id, order_number, tracking_number, carrier, recipient_name, destination_city, created_at, shipment_id, status';

      let qCreated = supabase
        .from('shipping_labels').select(cols)
        .eq('organization_id', orgId)
        .eq('status', 'created')
        .not('tracking_number', 'is', null)
        .gte('created_at', `${cutoffDate}T05:00:00.000Z`)
        .order('created_at', { ascending: false });
      if (carrierCanon) qCreated = qCreated.ilike('carrier', carrierCanon);

      let qTransit = supabase
        .from('shipping_labels').select(cols)
        .eq('organization_id', orgId)
        .eq('status', 'in_transit')
        .not('tracking_number', 'is', null)
        .gte('created_at', `${recentDate}T05:00:00.000Z`)
        .order('created_at', { ascending: false });
      if (carrierCanon) qTransit = qTransit.ilike('carrier', carrierCanon);

      const [createdRes, transitRes] = await Promise.all([qCreated, qTransit]);
      dbShipments = [...(createdRes.data || []), ...(transitRes.data || [])];
      console.log(`📦 DB: ${(createdRes.data || []).length} created + ${(transitRes.data || []).length} in_transit (recent)`);
    }

    // ─── 3. Merge (union, deduped by tracking) ────────────────────────────────
    // The local DB is the authoritative base for pending guides.
    // shipping_labels.status is now kept up to date by envia-tracking-webhook,
    // so the local table is the source of truth and is ALWAYS included. The
    // Envia Queries API only SUPPLEMENTS it with portal-only guides that have no
    // local row yet. (Previously the API was the sole source and silently
    // dropped any guide it didn't return as 'created' — so labels created
    // earlier in the day vanished from the manifest dialog.) Deduped by tracking.
    const byTracking = new Map<string, any>();

    for (const s of dbShipments) {
      byTracking.set(s.tracking_number, {
        id: s.id,
        shipment_id: s.shipment_id,
        tracking_number: s.tracking_number,
        carrier: s.carrier,
        status: s.status,
        created_at: s.created_at,
        shopify_order_id: s.shopify_order_id,
        order_number: s.order_number,
        recipient_name: s.recipient_name,
        destination_city: s.destination_city,
        source: 'database',
      });
    }

    if (enviaOk) {
      for (const s of enviaShipments) {
        if (byTracking.has(s.tracking_number)) continue; // local row wins (richer metadata)
        byTracking.set(s.tracking_number, {
          id: `envia_${s.tracking_number}`,
          shipment_id: null,
          tracking_number: s.tracking_number,
          carrier: s.name || s.carrier || body.carrier || 'unknown',
          status: s.status || 'created',
          created_at: s.created_at || new Date().toISOString(),
          shopify_order_id: null,
          order_number: null,
          recipient_name: null,
          destination_city: null,
          source: 'envia_api',
        });
      }
    }

    let result: any[] = Array.from(byTracking.values());
    const finalSource: string = enviaOk ? 'envia_api' : 'database';
    console.log(`✅ Candidates: ${dbShipments.length} from DB + ${enviaOk ? enviaShipments.length : 0} from API → ${result.length} merged`);

    // ─── 4. Exclude guides already in ANY manifest (open/closed/picked_up) ────
    // A guide should appear in exactly one manifest. Excluding open manifests too
    // prevents the same guide from being added to two manifests at once.
    if (orgId && result.length > 0) {
      try {
        const { data: closedManifests } = await supabase
          .from('shipping_manifests')
          .select('id')
          .eq('organization_id', orgId)
          .in('status', ['open', 'closed', 'picked_up']);

        if (closedManifests && closedManifests.length > 0) {
          const closedIds = closedManifests.map((m: any) => m.id);
          const { data: manifestedItems } = await supabase
            .from('manifest_items')
            .select('tracking_number')
            .in('manifest_id', closedIds);

          const manifestedSet = new Set(
            (manifestedItems || []).map((i: any) => i.tracking_number)
          );

          const before = result.length;
          result = result.filter(s => !manifestedSet.has(s.tracking_number));
          const removed = before - result.length;
          if (removed > 0) {
            console.log(`🚫 Excluded ${removed} guides already in a manifest`);
          }
        }
      } catch (e) {
        // Non-fatal — better to show extra guides than to crash
        console.warn('⚠️ Could not filter manifested guides:', e);
      }
    }

    console.log(`📤 Returning ${result.length} shipments (source: ${finalSource})`);

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        total: result.length,
        source: finalSource,
        data: result,
        // diagnostic: shows in browser Network tab / console so we can see
        // exactly why the Envia API succeeded or failed without needing log access
        _apiDebug: apiDebugInfo,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('❌ envia-list-shipments error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
