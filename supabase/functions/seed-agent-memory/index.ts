import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const MEM0_API = "https://api.mem0.ai/v1/memories/";
const AGENT_ID = "media-buying-agent";

// ─── Memorias semilla del Prophit System + ADN Dosmicos ─────────────

interface SeedMemory {
  content: string;
  category: string;
}

const SEED_MEMORIES: SeedMemory[] = [
  // ══════════════════════════════════════════════════════════════
  // PROPHIT SYSTEM — Jerarquia de metricas (Taylor Holiday / CTC)
  // ══════════════════════════════════════════════════════════════
  {
    content:
      "La jerarquia de metricas del Prophit System es (de mas a menos importante): Cash Flow > Contribution Margin > Business Metrics (MER, Revenue, AOV) > Customer Metrics (New vs Returning, Active File) > Channel Metrics (ROAS por canal). Channel ROAS es la MENOS importante — es proxy, no gobierna decisiones.",
    category: "framework",
  },
  {
    content:
      "Contribution Margin = Net Sales - Product Cost - Shipping Cost - Variable Expenses - Ad Spend. Es la metrica #1 del scoreboard diario. CM - OpEx = Profit. Si CM incremental por dolar de ad spend es positivo, la senal es GASTAR MAS, no menos.",
    category: "framework",
  },
  {
    content:
      "MER (Marketing Efficiency Ratio) = Revenue Total / Ad Spend Total. Es la metrica norte del negocio. AMER (Acquisition MER) = New Customer Revenue / Ad Spend. Mide eficiencia de adquisicion de clientes nuevos. NC-ROAS es lo mismo que AMER.",
    category: "framework",
  },
  {
    content:
      "Four Quarter Accounting: (1) Cost of Delivery (COGS+Shipping+Variables) target 25-35%, (2) CAC/Marketing (solo media spend) target 25-30%, (3) OpEx (costos fijos) target 10-15%, (4) Profit target 15-25%. Escenario ideal: 25/25/25/25.",
    category: "framework",
  },
  {
    content:
      "TRAMPA CRITICA: No mezclar costos fijos en el analisis diario de CM. Los costos fijos como porcentaje del revenue BAJAN a medida que el volumen SUBE. Un costo fijo en la vista diaria crea contra-senal falsa de perdida cuando la solucion real puede ser gastar mas.",
    category: "framework",
  },
  {
    content:
      "TRAMPA CRITICA: Returns de Shopify. Total Sales incluye devoluciones de otros periodos. Usar Returns Accrual = Revenue del periodo x Tasa de retorno historica. NUNCA dejar que returns lagged creen una senal falsa de ineficiencia.",
    category: "framework",
  },
  {
    content:
      "Active Customer File = clientes que compraron en los ultimos 6-8 meses. 80% de los clientes que van a re-comprar lo hacen en los primeros 6-8 meses. Si el archivo se encoge, el revenue futuro de returning customers va a caer. ALERTA MAXIMA si se encoge.",
    category: "framework",
  },
  {
    content:
      "Revenue Layer Cake: Total Revenue = New Customer Revenue + Returning Customer Revenue. Cada uno se modela por separado. Exprimir la base existente sin adquirir nuevos = el negocio muere en 12-18 meses.",
    category: "framework",
  },

  // ══════════════════════════════════════════════════════════════
  // BENCHMARKS GENERICOS — Taylor Holiday (se reemplazaran con
  // datos reales de Dosmicos despues de 10 dias de operacion)
  // ══════════════════════════════════════════════════════════════
  {
    content:
      "Benchmark generico Hook Rate (3s views / impressions): >30% es bueno, 20-30% es aceptable, <20% es malo. ESTOS BENCHMARKS SE DEBEN REEMPLAZAR con datos reales de Dosmicos despues de 10 dias de operacion del agente.",
    category: "benchmark_initial",
  },
  {
    content:
      "Benchmark generico Hold Rate (ThruPlays / 3s views): >25% es bueno, 15-25% aceptable, <15% malo. Se debe calibrar con datos reales de Dosmicos.",
    category: "benchmark_initial",
  },
  {
    content:
      "Benchmark generico CTR link click: >1.5% es bueno, 1.0-1.5% aceptable, <1.0% malo. Se debe calibrar con datos reales.",
    category: "benchmark_initial",
  },
  {
    content:
      "Benchmark generico Frequency: >3.0 en prospecting indica saturacion de audiencia. Considerar refresh creativo. >3.5 con CPA > 2x target = candidato a pausa.",
    category: "benchmark_initial",
  },
  {
    content:
      "Benchmark MER para Dosmicos: target 3-5x. Si baja de 3x, reducir spend. Si sube de 5x, hay headroom para escalar. Resultado mediano de Meta para adquisicion de nuevo cliente: ~1.7x ROAS.",
    category: "benchmark_initial",
  },
  {
    content:
      "Benchmarks de Prophit System por metrica: Contribution Margin % excelente >25%, bueno >20%, atencion >15%, malo <15%. Gross Margin excelente >65%, bueno >58%, atencion >50%, malo <42%. OpEx % excelente <10%, bueno <12%, atencion <15%, malo >20%. Profit % excelente >25%, bueno >20%, atencion >15%, malo <10%.",
    category: "benchmark_initial",
  },
  {
    content:
      "Cost of Delivery: target <35%. Product Cost target <20%, Shipping Cost target <10%. Si shipping es 20-30% del revenue, algo esta mal. Trackear Net Shipping Cost = Shipping Revenue - Shipping Cost. Meta: break-even o positivo.",
    category: "benchmark_initial",
  },

  // ══════════════════════════════════════════════════════════════
  // ADN DOSMICOS — Marca, productos, target, peaks
  // ══════════════════════════════════════════════════════════════
  {
    content:
      "Dosmicos es una marca colombiana de ropa termica infantil que opera en Colombia y USA. Moneda principal: COP (pesos colombianos). Venta 100% digital via dosmicos.co, dosmicos.com, Instagram, TikTok.",
    category: "brand_dna",
  },
  {
    content:
      "Productos principales de Dosmicos: ruanas, sleeping bags, ponchos, chaquetas, buzos termicos, kits y conjuntos para ninos 0-8 anos. Target: mamas 25-45 anos.",
    category: "brand_dna",
  },
  {
    content:
      "Los peaks comerciales de Dosmicos son: Q1 Hot Days (marzo), Q2 Dia de la Madre (mayo) — peak natural para ropa de bebe, Q3 Temporada de Frio / Back to School (julio-agosto), Q4 Black Friday + Navidad (noviembre-diciembre). Estructura de 4 peaks por ano.",
    category: "brand_dna",
  },
  {
    content:
      "Los creativos UGC (mamas reales mostrando productos) historicamente superan a los de estudio para Dosmicos. Para ads: historias > iteracion de hooks. Crear para la audiencia de tu audiencia — contenido que mamas quieran compartir en DMs y stories.",
    category: "brand_dna",
  },
  {
    content:
      "Dosmicos value-to-weight ratio: Media-Buena (ruanas, sleeping bags). Target de shipping cost como % de revenue: <10%. Producto infantil termal = compra estacional con componente emocional fuerte (mama protegiendo a su hijo del frio).",
    category: "brand_dna",
  },

  // ══════════════════════════════════════════════════════════════
  // REGLAS OPERATIVAS — Media buying rules
  // ══════════════════════════════════════════════════════════════
  {
    content:
      "REGLA: Nunca subir budget mas de 20-30% por dia en Meta Ads. Scale gradual. Si un ad tiene CPA < 0.7x target, incrementar budget +20%. Si tiene CPA > 2x target y frequency > 3.5, pausar.",
    category: "rule",
  },
  {
    content:
      "REGLA: Kill rapido. Si un ad gasta 2x del CPA target sin conversion, pausar inmediatamente. No esperar a que 'mejore'. 60% de los dolares de media gastados historicamente nunca fueron rentables — falta de constraint.",
    category: "rule",
  },
  {
    content:
      "REGLA: Portfolio approach para distribucion de budget: 60% en winners probados (champions), 20% en testing de creativos/audiencias nuevos, 20% en scaling de ads con senal positiva temprana.",
    category: "rule",
  },
  {
    content:
      "REGLA: Cuando AMER se degrada mes a mes, probablemente es competencia creciendo, no un problema de ads. SOLUCION: product innovation, stories que importen, peaks. NO SOLUCION: iterar hooks.",
    category: "rule",
  },
  {
    content:
      "REGLA de inventario: Si un SKU tiene <30 dias de inventario y reorder toma >30 dias, SUBIR eficiencia target o PAUSAR ads para ese SKU. Si >90 dias de inventario, LIQUIDAR: funnel especial, descuento agresivo, excluir existing customers.",
    category: "rule",
  },
  {
    content:
      "REGLA de channel: Para marcas sub $10M (como Dosmicos), quedarse en Meta + Google Search basico. No dispersar en muchos canales. Ir muy duro en Meta. Usar 7-day click ROAS de Meta como fuente principal de atribucion.",
    category: "rule",
  },
  {
    content:
      "REGLA de diagnostico de ROAS bajo: CTR alto + Conv baja = problema de landing page, NO del ad. CTR bajo + CPM normal = problema de creative. CPM alto = audiencia saturada. Hook Rate bajo = primeros 3s del video no atrapan. ATC alto + Compras bajas = problema de checkout.",
    category: "rule",
  },

  // ══════════════════════════════════════════════════════════════
  // AUTONOMIA GRADUADA — Reglas del agente
  // ══════════════════════════════════════════════════════════════
  {
    content:
      "Niveles de autonomia del agente: Nivel 1 OBSERVAR (dia 1-10) = solo analiza y reporta, acumula memorias y benchmarks propios. Nivel 2 RECOMENDAR (dia 11-21) = recomendaciones priorizadas con confianza, usuario marca ejecutada/ignorada, se trackea accuracy. Nivel 3 ACTUAR (dia 22+ si accuracy >80%) = ejecuta acciones automaticamente via Meta API.",
    category: "agent_config",
  },
  {
    content:
      "Reglas de autonomia: Si accuracy cae bajo 70% en Nivel 3, volver a Nivel 2 automaticamente. Acciones destructivas (pausar campanas enteras, cambiar budget >30%) SIEMPRE requieren aprobacion humana, incluso en Nivel 3.",
    category: "agent_config",
  },
];

// ─── Helpers ────────────────────────────────────────────────────

async function addMemory(
  content: string,
  userId: string,
  agentId: string,
  metadata: Record<string, string>,
  apiKey: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(MEM0_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content }],
        user_id: userId,
        agent_id: agentId,
        metadata,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Mem0 ${res.status}: ${errText}` };
    }

    const data = await res.json();
    return { ok: true, id: data?.id || data?.results?.[0]?.id || "unknown" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Edge Function ──────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const MEM0_API_KEY = Deno.env.get("MEM0_API_KEY");
    if (!MEM0_API_KEY) {
      throw new Error("MEM0_API_KEY no esta configurada en los secrets");
    }

    // Obtener organizationId del body o usar default
    let orgId: string | undefined;
    try {
      const body = await req.json();
      orgId = body.organizationId;
    } catch {
      // sin body, buscar en la BD
    }

    // Si no se paso orgId, buscar la primera organizacion con ad_accounts
    if (!orgId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: accounts } = await supabase
        .from("ad_accounts")
        .select("organization_id")
        .limit(1)
        .single();

      if (accounts?.organization_id) {
        orgId = accounts.organization_id;
      } else {
        throw new Error(
          "No se encontro organizacion con ad_accounts. Pasa organizationId en el body."
        );
      }
    }

    console.log(
      `[seed-agent-memory] Cargando ${SEED_MEMORIES.length} memorias para org ${orgId}`
    );

    const results: {
      index: number;
      category: string;
      ok: boolean;
      id?: string;
      error?: string;
    }[] = [];

    // Cargar memorias en lotes de 5 para no saturar la API
    const BATCH_SIZE = 5;
    for (let i = 0; i < SEED_MEMORIES.length; i += BATCH_SIZE) {
      const batch = SEED_MEMORIES.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map((mem, batchIdx) =>
          addMemory(
            mem.content,
            orgId!,
            AGENT_ID,
            {
              category: mem.category,
              source: "seed",
              seeded_at: new Date().toISOString(),
            },
            MEM0_API_KEY
          ).then((res) => ({
            index: i + batchIdx,
            category: mem.category,
            ...res,
          }))
        )
      );

      results.push(...batchResults);
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    console.log(
      `[seed-agent-memory] Completado: ${succeeded}/${results.length} memorias cargadas`
    );

    if (failed.length > 0) {
      console.error(
        `[seed-agent-memory] Errores:`,
        failed.map((f) => `#${f.index} (${f.category}): ${f.error}`)
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        organization_id: orgId,
        agent_id: AGENT_ID,
        total: SEED_MEMORIES.length,
        loaded: succeeded,
        failed: failed.length,
        errors: failed.length > 0
          ? failed.map((f) => ({
              index: f.index,
              category: f.category,
              error: f.error,
            }))
          : undefined,
        categories: {
          framework: SEED_MEMORIES.filter((m) => m.category === "framework")
            .length,
          benchmark_initial: SEED_MEMORIES.filter(
            (m) => m.category === "benchmark_initial"
          ).length,
          brand_dna: SEED_MEMORIES.filter((m) => m.category === "brand_dna")
            .length,
          rule: SEED_MEMORIES.filter((m) => m.category === "rule").length,
          agent_config: SEED_MEMORIES.filter(
            (m) => m.category === "agent_config"
          ).length,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("[seed-agent-memory] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
