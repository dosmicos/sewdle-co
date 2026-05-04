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

    // ─── Resolve org from auth token ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    let orgId: string | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: membership } = await supabase
          .from('organization_members')
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

    try {
      const res = await fetch(queriesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ENVIA_API_KEY}`,
          'Content-Type': 'application/json',
          'accept': 'application/json',
        },
      });

      const raw = await res.text();
      console.log(`  → status ${res.status}, preview: ${raw.slice(0, 300)}`);

      let data: any = null;
      try { data = JSON.parse(raw); } catch { data = null; }

      if (res.ok && Array.isArray(data?.data)) {
        const all = data.data as any[];

        // Filter to last 7 days (API returns full month).
        // created_at format: "2026-05-03 12:19:36" — extract date prefix for comparison.
        // Only include "Created" status — exclude Cancelled, In transit, Delivered, etc.
        const recentShipments = all.filter((s: any) => {
          const created = s.created_at || s.createdAt || '';
          // Normalize to YYYY-MM-DD prefix (works for both "2026-05-03 12:19:36" and ISO)
          const createdDate = created.slice(0, 10);
          const statusOk = (s.status || '').toLowerCase() === 'created';
          return createdDate >= cutoffDate && statusOk;
        });

        // Apply carrier filter — carrier name is in `name` field (e.g. "interRapidisimo")
        const filtered = body.carrier
          ? recentShipments.filter((s: any) =>
              (s.name || s.carrier || '').toLowerCase().includes(body.carrier!.toLowerCase()) ||
              body.carrier!.toLowerCase().includes((s.name || s.carrier || '').toLowerCase().replace(/\s/g, ''))
            )
          : recentShipments;

        enviaShipments = filtered;
        enviaOk = true;
        console.log(`✅ Envia Queries API OK — ${all.length} total this month, ${recentShipments.length} with status=created in last 7 days, ${filtered.length} after carrier filter`);
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
    // If Envia API succeeded, use it as primary source and enrich with DB data.
    // If not, fall back to DB only.
    let result: any[] = [];
    let finalSource: string;

    if (enviaOk && enviaShipments.length > 0) {
      const dbByTracking = new Map(dbShipments.map(s => [s.tracking_number, s]));
      result = enviaShipments.map((s: any) => {
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
      finalSource = 'envia_api';
    } else if (enviaOk && enviaShipments.length === 0) {
      // API worked but no shipments today — still merge with DB for any
      // labels created via our app (may differ from Envia portal account)
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
      finalSource = result.length > 0 ? 'database' : 'envia_api';
    } else {
      // API failed — fall back to DB
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

    console.log(`📤 Returning ${result.length} shipments (source: ${finalSource})`);

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        total: result.length,
        source: finalSource,
        data: result,
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
