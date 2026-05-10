import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      const res = await fetch(queriesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ENVIA_API_KEY}`,
          'accept': 'application/json',
        },
      });

      const raw = await res.text();
      console.log(`  → status ${res.status}, preview: ${raw.slice(0, 500)}`);

      let data: any = null;
      try { data = JSON.parse(raw); } catch { data = null; }

      // Capture debug info: include full first item so we can see all field names
      const firstItem = Array.isArray(data?.data) ? data.data[0] : null;
      apiDebugInfo = {
        status: res.status,
        ok: res.ok,
        dataType: data === null ? 'null' : Array.isArray(data?.data) ? 'array' : typeof data?.data,
        totalFromApi: Array.isArray(data?.data) ? data.data.length : 0,
        firstItemKeys: firstItem ? Object.keys(firstItem) : [],
        firstItem: firstItem,  // full first guide so we see exact field names
      };

      if (res.ok && Array.isArray(data?.data)) {
        const all = data.data as any[];

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

          // ── Status: only "created" ─────────────────────────────────────────────
          // Envia API may use different field names across carriers; check all variants.
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
        console.log(`✅ Envia Queries API OK — ${all.length} total this month, ${recentShipments.length} eligible in last 7 days, ${filtered.length} after carrier filter`);
      } else {
        console.warn(`⚠️ Envia Queries API returned unexpected response: status=${res.status}, data type=${typeof data?.data}`);
      }
    } catch (e) {
      console.warn(`⚠️ Envia Queries API fetch error: ${e}`);
    }

    // ─── 2. DB fallback (shipping_labels for today) ───────────────────────────
    let dbShipments: any[] = [];
    if (orgId) {
      let dbQuery = supabase
        .from('shipping_labels')
        .select('id, shopify_order_id, order_number, tracking_number, carrier, recipient_name, destination_city, created_at, shipment_id, status')
        .eq('organization_id', orgId)
        // Only show guides with status 'created' — same rule as the Envia API path.
        .eq('status', 'created')
        .not('tracking_number', 'is', null)
        .gte('created_at', `${cutoffDate}T00:00:00.000Z`)
        .lte('created_at', `${today}T23:59:59.999Z`)
        .order('created_at', { ascending: false });

      if (body.carrier) {
        dbQuery = dbQuery.eq('carrier', body.carrier);
      }

      const { data, error } = await dbQuery;
      if (!error && data) {
        dbShipments = data;
        console.log(`📦 DB: ${dbShipments.length} shipments`);
      }
    }

    // ─── 3. Merge & normalize ────────────────────────────────────────────────
    // Strategy: always merge API + DB.
    //   • API guides: filtered to "created" status, not incoming, last 7 days.
    //   • DB guides not in API: newly created labels that haven't yet been
    //     indexed by Envia (can be minutes behind). These are added as
    //     supplements so they don't disappear from the manifest dialog.
    //   • source = 'envia_api' whenever the API call succeeded (DB supplement
    //     is transparent to the UI). source = 'database' only when API failed.
    let result: any[] = [];
    let finalSource: string;

    if (enviaOk) {
      const apiTrackingSet = new Set(enviaShipments.map((s: any) => s.tracking_number));
      const dbByTracking = new Map(dbShipments.map(s => [s.tracking_number, s]));

      // 1. API guides enriched with DB metadata (order_number, recipient_name, etc.)
      const fromApi = enviaShipments.map((s: any) => {
        const db = dbByTracking.get(s.tracking_number);
        return {
          id: db?.id || `envia_${s.tracking_number}`,
          shipment_id: db?.shipment_id || null,
          tracking_number: s.tracking_number,
          carrier: s.name || s.carrier || body.carrier || 'unknown',
          status: s.status || 'created',
          created_at: s.created_at || new Date().toISOString(),
          shopify_order_id: db?.shopify_order_id || null,
          order_number: db?.order_number || null,
          recipient_name: db?.recipient_name || null,
          destination_city: db?.destination_city || null,
          source: 'envia_api',
        };
      });

      // 2. DB guides NOT yet in the API (just created, not yet indexed by Envia)
      const fromDbOnly = dbShipments
        .filter(s => !apiTrackingSet.has(s.tracking_number))
        .map(s => ({
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
        }));

      result = [...fromApi, ...fromDbOnly];
      // API was reachable and used — show "API Envia" badge even if we
      // supplemented with freshly created DB guides.
      finalSource = 'envia_api';

      console.log(`🔀 Merge: ${fromApi.length} from Envia API + ${fromDbOnly.length} DB-only supplements`);
    } else {
      // API failed — fall back to DB only
      result = dbShipments.map(s => ({
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
      }));
      finalSource = 'database';
    }

    // ─── 4. Exclude guides already processed in closed/picked-up manifests ────
    // Guides in those manifests have already been handed to the carrier.
    // They still appear as 'created' in shipping_labels (we don't update their
    // status on manifest pickup), so without this filter they keep showing up
    // in the manifest creation dialog even after they've shipped.
    if (orgId && result.length > 0) {
      try {
        const { data: closedManifests } = await supabase
          .from('shipping_manifests')
          .select('id')
          .eq('organization_id', orgId)
          .in('status', ['closed', 'picked_up']);

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
            console.log(`🚫 Excluded ${removed} guides already in closed/picked_up manifests`);
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
