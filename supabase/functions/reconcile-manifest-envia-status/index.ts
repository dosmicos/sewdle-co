// Reconcilia el estado de escaneo de los manifiestos contra el estado real de las
// guías en Envia (Queries API). Para cada guía pendiente:
//   • con movimiento (delivered/shipped/etc.)            → 'verified'
//   • cancelada en Envia                                 → 'canceled'
//   • en "Created" pero su PEDIDO ya se entregó en otra
//     guía (mismo nº de pedido)                          → 'duplicate'
//   • en "Created", sin hermana entregada y +N días sin
//     moverse                                            → 'review' (posible pérdida)
//   • en "Created" reciente                              → se deja pendiente
//
// El nº de pedido sale del campo `sender_name` de Envia ("79178 - Dosmicos sas").
//
// El modo de escritura (apply) SOLO está permitido para service_role (lo invoca
// el cron con la service_role_key del vault). Para cualquier otro llamante es de
// solo lectura: devuelve el reporte sin escribir.
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
  months?: string[];
  apply?: boolean;
}

// Estados que NO deben pasar a verificado (la transportadora no se la llevó).
const CANCELED = new Set(['canceled', 'cancelled', 'cancelado', 'cancelada']);
// Días sin movimiento (en "Created") tras los cuales una guía sin hermana
// entregada se marca para revisar (posible pérdida).
const STALE_DAYS = 4;

interface GuideInfo { status: string; order: string | null; createdAt: string | null; }

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

// Pedido a partir de sender_name ("79178 - Dosmicos sas" → "79178").
function parseOrder(senderName: any): string | null {
  const m = String(senderName ?? '').trim().match(/^(\d{3,})/);
  return m ? m[1] : null;
}

// Trae las guías de un mes desde Envia y llena: tracking→info y el set de pedidos
// que YA tienen al menos una guía con movimiento (no "created", no cancelada).
async function fetchMonth(
  apiKey: string, yyyy: string, mm: string,
  guides: Map<string, GuideInfo>, ordersMoved: Set<string>,
) {
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
      const tracking = String(s.tracking_number ?? '').trim();
      if (!tracking) continue;
      const status = String(s.status ?? '').trim().toLowerCase();
      if (!status) continue;
      const order = parseOrder(s.sender_name);
      const createdAt = s.created_at || null;
      const moved = status !== 'created' && !CANCELED.has(status);
      if (order && moved) ordersMoved.add(order);
      const prev = guides.get(tracking);
      // Conservamos el registro "movido" sobre el "created" si la guía se repite.
      if (prev && prev.status !== 'created') continue;
      guides.set(tracking, { status, order, createdAt });
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
    const role = callerRole(req);

    // Apply (escritura): el cron (service_role) puede sobre todas las orgs; un
    // usuario logueado (botón "Actualizar") puede aplicar SOLO sobre su propia
    // organización. Cualquier otro llamante → solo lectura.
    let doApply = false;
    let orgId: string | null = body.organizationId || null;
    if (body.apply === true) {
      if (role === 'service_role') {
        doApply = true;
      } else if (role === 'authenticated') {
        const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: membership } = await supabase
            .from('organization_users')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
          if (membership?.organization_id) {
            doApply = true;
            orgId = membership.organization_id; // forzamos su propia org
          }
        }
      }
    }

    // ── 1. Items aún sin resolver (ni verificados, ni cancelados, ni dup, ni review)
    const pending: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from('manifest_items')
        .select('id, tracking_number, shipping_manifests!inner(id, manifest_date, organization_id)')
        .not('scan_status', 'in', '("verified","canceled","duplicate","review")')
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

    // ── 2. Meses a consultar ──
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

    // ── 3. Datos de Envia ──
    const guides = new Map<string, GuideInfo>();
    const ordersMoved = new Set<string>();
    for (const ym of months) {
      const [yyyy, mm] = ym.split('-');
      await fetchMonth(ENVIA_API_KEY, yyyy, mm, guides, ordersMoved);
    }

    // ── 4. Clasificar ──
    const toVerify: string[] = [];
    const toCancel: string[] = [];
    const toDuplicate: string[] = [];
    const toReview: string[] = [];
    // Pendientes que se quedan pendientes (created reciente): {id, order} para
    // detectar 2+ del mismo pedido y avisar "posible duplicado" sin cancelar.
    const pendingStay: { id: string; order: string | null }[] = [];
    const affected = new Set<string>();
    const statusSeen: Record<string, number> = {};
    let stillCreated = 0, unknown = 0;
    const now = Date.now();

    for (const it of pending) {
      const mfId = it.shipping_manifests.id;
      const tracking = String(it.tracking_number).trim();
      const info = guides.get(tracking);
      if (!info) { unknown++; pendingStay.push({ id: it.id, order: null }); continue; }
      const st = info.status;
      statusSeen[st] = (statusSeen[st] || 0) + 1;

      if (st === 'created') {
        const hasDeliveredSibling = info.order ? ordersMoved.has(info.order) : false;
        if (hasDeliveredSibling) { toDuplicate.push(it.id); affected.add(mfId); continue; }
        // ¿lleva varios días sin moverse? → revisar (posible pérdida)
        let ageDays = Infinity;
        if (info.createdAt) {
          const t = Date.parse(String(info.createdAt).replace(' ', 'T'));
          if (!Number.isNaN(t)) ageDays = (now - t) / 86400000;
        }
        if (ageDays >= STALE_DAYS) { toReview.push(it.id); affected.add(mfId); }
        else { stillCreated++; pendingStay.push({ id: it.id, order: info.order }); }
      } else if (CANCELED.has(st)) {
        toCancel.push(it.id); affected.add(mfId);
      } else {
        toVerify.push(it.id); affected.add(mfId);
      }
    }

    // Aviso "posible duplicado": pendientes (sin despachar) con 2+ guías del mismo
    // pedido. No se cancela ninguna — el operador decide. dup_order_ref = nº pedido.
    const orderCount = new Map<string, number>();
    for (const p of pendingStay) if (p.order) orderCount.set(p.order, (orderCount.get(p.order) || 0) + 1);
    const dupByOrder = new Map<string, string[]>(); // pedido -> ids a marcar
    const dupClearIds: string[] = [];               // pendientes que YA no son duplicado
    for (const p of pendingStay) {
      if (p.order && (orderCount.get(p.order) || 0) >= 2) {
        if (!dupByOrder.has(p.order)) dupByOrder.set(p.order, []);
        dupByOrder.get(p.order)!.push(p.id);
      } else {
        dupClearIds.push(p.id);
      }
    }
    const dupWarnCount = [...dupByOrder.values()].reduce((a, b) => a + b.length, 0);

    // ── 5. Aplicar (solo service_role) ──
    const applied = { verified: 0, canceled: 0, duplicate: 0, review: 0 };
    if (doApply) {
      const nowIso = new Date().toISOString();
      const bulk = async (ids: string[], patch: Record<string, unknown>, key: keyof typeof applied) => {
        for (let i = 0; i < ids.length; i += 500) {
          const chunk = ids.slice(i, i + 500);
          const { error } = await supabase.from('manifest_items').update(patch).in('id', chunk);
          if (error) throw error;
          applied[key] += chunk.length;
        }
      };
      await bulk(toVerify, { scan_status: 'verified', scanned_at: nowIso, notes: 'Auto-verificada: con movimiento en Envia', dup_order_ref: null }, 'verified');
      await bulk(toCancel, { scan_status: 'canceled', notes: 'Cancelada en Envia', dup_order_ref: null }, 'canceled');
      await bulk(toDuplicate, { scan_status: 'duplicate', notes: 'Duplicada: el pedido ya se entregó en otra guía', dup_order_ref: null }, 'duplicate');
      await bulk(toReview, { scan_status: 'review', notes: 'Sin movimiento — revisar (posible pérdida)', dup_order_ref: null }, 'review');

      // Aviso de posible duplicado (no cambia el conteo, no cambia scan_status).
      for (const [order, ids] of dupByOrder) {
        for (let i = 0; i < ids.length; i += 500) {
          const chunk = ids.slice(i, i + 500);
          const { error } = await supabase.from('manifest_items').update({ dup_order_ref: order }).in('id', chunk);
          if (error) throw error;
        }
      }
      // Limpiar avisos obsoletos en pendientes que ya no son duplicado.
      for (let i = 0; i < dupClearIds.length; i += 500) {
        const chunk = dupClearIds.slice(i, i + 500);
        if (!chunk.length) continue;
        const { error } = await supabase.from('manifest_items').update({ dup_order_ref: null }).in('id', chunk);
        if (error) throw error;
      }

      // Recalcular conteos: total_verified y total_packages (efectivas).
      // Efectivas = no canceladas, ni duplicadas, ni en revisión.
      for (const mfId of affected) {
        const [{ count: verified }, { count: effective }] = await Promise.all([
          supabase.from('manifest_items').select('*', { count: 'exact', head: true }).eq('manifest_id', mfId).eq('scan_status', 'verified'),
          supabase.from('manifest_items').select('*', { count: 'exact', head: true }).eq('manifest_id', mfId).not('scan_status', 'in', '("canceled","duplicate","review")'),
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
        would_verify: toVerify.length,
        would_cancel: toCancel.length,
        would_duplicate: toDuplicate.length,
        would_review: toReview.length,
        dup_warning: dupWarnCount,
        applied,
        still_created_fresh: stillCreated,
        unknown,
        envia_guides_indexed: guides.size,
        orders_with_movement: ordersMoved.size,
        affected_manifests: affected.size,
      },
      status_breakdown: statusSeen,
    });
  } catch (err: any) {
    console.error('reconcile error:', err);
    return json({ success: false, error: err?.message || String(err) }, 500);
  }
});
