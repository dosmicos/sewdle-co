// Reconcilia el estado de escaneo de los manifiestos contra el estado real de las
// guías en Envia (Queries API):
//   • Guías con movimiento (estado != "created", no canceladas)  → 'verified'
//     (se entregaron a la transportadora aunque no se escanearan con la pistola).
//   • Guías canceladas en Envia                                  → 'canceled'
//     (no son paquetes efectivos; no cuentan en el conteo del manifiesto).
//
// El modo de escritura (apply) SOLO está permitido para el rol service_role
// (lo invoca el cron con la service_role_key del vault). Para cualquier otro
// llamante es de solo lectura: devuelve el reporte sin escribir.
//
// Body: { organizationId?: string, months?: string[], apply?: boolean }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface Body {
  organizationId?: string;
  months?: string[]; // "YYYY-MM"
  apply?: boolean;
}

// Estados que NO deben pasar a verificado (la transportadora no se la llevó).
const CANCELED = new Set(['canceled', 'cancelled', 'cancelado', 'cancelada']);

// Rol del JWT que llama (Supabase ya validó la firma con verify_jwt).
function callerRole(req: Request): string {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    let b = token.split('.')[1];
    if (!b) return 'anon';
    b = b.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    return JSON.parse(atob(b)).role || 'anon';
  } catch { return 'anon'; }
}

async function fetchMonthStatuses(apiKey: string, yyyy: string, mm: string, into: Map<string, string>) {
  const base = `https://queries.envia.com/guide/${mm}/${yyyy}`;
  const PAGE_SIZE = 300;
  const MAX_PAGES = 60;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? base : `${base}?page=${page}`;
    const res = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}`, 'accept': 'application/json' } });
    const raw = await res.text();
    let data: any = null;
    try { data = JSON.parse(raw); } catch { data = null; }
    if (!res.ok || !Array.isArray(data?.data)) break;
    for (const s of data.data) {
      const tracking = String(s.tracking_number ?? s.trackingNumber ?? s.guia ?? s.guide ?? s.guideNumber ?? '').trim();
      if (!tracking) continue;
      const status = String(s.status ?? s.status_id ?? s.status_label ?? s.statusLabel ?? '').trim().toLowerCase();
      if (!status) continue;
      const prev = into.get(tracking);
      if (prev && prev !== 'created') continue;
      into.set(tracking, status);
    }
    if (data.data.length < PAGE_SIZE) break;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const ENVIA_API_KEY = Deno.env.get('ENVIA_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!ENVIA_API_KEY) return json({ success: false, error: 'ENVIA_API_KEY no configurada' }, 500);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body: Body = req.method === 'POST' ? await req.json() : {};
    const orgId = body.organizationId || null;
    // Escritura solo para service_role (cron). Cualquier otro → solo lectura.
    const doApply = body.apply === true && callerRole(req) === 'service_role';

    // ── 1. Guías pendientes (no verificadas ni canceladas) — paginado completo ──
    const pending: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from('manifest_items')
        .select('id, tracking_number, scan_status, shipping_manifests!inner(id, manifest_number, manifest_date, carrier, organization_id)')
        .not('scan_status', 'in', '("verified","canceled")')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (orgId) q = q.eq('shipping_manifests.organization_id', orgId);
      const { data: chunk, error: itemsErr } = await q;
      if (itemsErr) throw itemsErr;
      if (!chunk || chunk.length === 0) break;
      pending.push(...chunk);
      if (chunk.length < PAGE) break;
    }
    if (pending.length === 0) {
      return json({ success: true, applied_mode: doApply, totals: { pending: 0 } });
    }

    // ── 2. Meses a consultar ────────────────────────────────────────────────────
    let months: string[];
    if (body.months && body.months.length) {
      months = body.months;
    } else {
      const set = new Set<string>();
      for (const it of pending) {
        const d: string = it.shipping_manifests?.manifest_date || '';
        if (d.length >= 7) {
          set.add(d.slice(0, 7));
          const [y, m] = d.slice(0, 7).split('-').map(Number);
          set.add(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`);
        }
      }
      months = [...set];
    }

    // ── 3. Estados desde Envia ──────────────────────────────────────────────────
    const statusMap = new Map<string, string>();
    for (const ym of months) {
      const [yyyy, mm] = ym.split('-');
      await fetchMonthStatuses(ENVIA_API_KEY, yyyy, mm, statusMap);
    }

    // ── 4. Clasificar ───────────────────────────────────────────────────────────
    const toVerifyIds: string[] = [];
    const toCancelIds: string[] = [];
    const affectedManifests = new Set<string>();
    const statusSeen: Record<string, number> = {};
    let stillCreated = 0, unknown = 0;

    for (const it of pending) {
      const mfId = it.shipping_manifests.id;
      const tracking = String(it.tracking_number).trim();
      const st = statusMap.get(tracking);
      if (st === undefined) { unknown++; continue; }
      if (st === 'created') { stillCreated++; continue; }
      statusSeen[st] = (statusSeen[st] || 0) + 1;
      if (CANCELED.has(st)) { toCancelIds.push(it.id); affectedManifests.add(mfId); }
      else { toVerifyIds.push(it.id); affectedManifests.add(mfId); }
    }

    // ── 5. Aplicar (solo service_role) ──────────────────────────────────────────
    let appliedVerified = 0, appliedCanceled = 0;
    if (doApply) {
      const nowIso = new Date().toISOString();
      for (let i = 0; i < toVerifyIds.length; i += 500) {
        const chunk = toVerifyIds.slice(i, i + 500);
        const { error } = await supabase.from('manifest_items')
          .update({ scan_status: 'verified', scanned_at: nowIso, notes: 'Auto-verificada: con movimiento en Envia' })
          .in('id', chunk);
        if (error) throw error;
        appliedVerified += chunk.length;
      }
      for (let i = 0; i < toCancelIds.length; i += 500) {
        const chunk = toCancelIds.slice(i, i + 500);
        const { error } = await supabase.from('manifest_items')
          .update({ scan_status: 'canceled', notes: 'Cancelada en Envia' })
          .in('id', chunk);
        if (error) throw error;
        appliedCanceled += chunk.length;
      }
      // Recalcular conteos: total_verified y total_packages (efectivas = no canceladas).
      for (const mfId of affectedManifests) {
        const [{ count: verified }, { count: effective }] = await Promise.all([
          supabase.from('manifest_items').select('*', { count: 'exact', head: true }).eq('manifest_id', mfId).eq('scan_status', 'verified'),
          supabase.from('manifest_items').select('*', { count: 'exact', head: true }).eq('manifest_id', mfId).neq('scan_status', 'canceled'),
        ]);
        await supabase.from('shipping_manifests').update({ total_verified: verified ?? 0, total_packages: effective ?? 0 }).eq('id', mfId);
      }
    }

    return json({
      success: true,
      applied_mode: doApply,
      months,
      totals: {
        pending: pending.length,
        would_verify: toVerifyIds.length,
        would_cancel: toCancelIds.length,
        applied_verified: appliedVerified,
        applied_canceled: appliedCanceled,
        still_created: stillCreated,
        unknown,
        envia_guides_indexed: statusMap.size,
        affected_manifests: affectedManifests.size,
      },
      status_breakdown: statusSeen,
    });
  } catch (err: any) {
    console.error('reconcile error:', err);
    return json({ success: false, error: err?.message || String(err) }, 500);
  }
});
