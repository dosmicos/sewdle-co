// Lee la "relación de recogida" (tirilla / link de recogida) de Coordinadora y
// devuelve la lista exacta de guías que su recolector registró, para cruzarla
// contra lo escaneado en el manifiesto.
//
// El link que envía Coordinadora (https://relacion-envios.coordinadora.com/<token>)
// es una SPA; detrás hay una API pública sin autenticación:
//   GET https://apiv2.coordinadora.com/recogida-app/cm-recogida-relacion-envio-ms/relacion/<token>
// Se consume server-side para evitar fragilidad de CORS y normalizar la respuesta
// en un único punto de integración.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const RELACION_API_BASE =
  "https://apiv2.coordinadora.com/recogida-app/cm-recogida-relacion-envio-ms/relacion";

interface RelacionRequest {
  url?: string;   // link completo pegado por el operador
  token?: string; // o solo el token
}

/**
 * Extrae el token de la relación a partir de un link pegado o un token suelto.
 * El token es el primer segmento del path del link de Coordinadora
 * (relacion-envios.coordinadora.com/<token>).
 */
function extractToken(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;

  let candidate = raw;
  try {
    // Si es una URL válida, tomamos el primer segmento no vacío del path.
    const u = new URL(raw);
    const seg = u.pathname.split("/").filter(Boolean);
    // El token es el primer segmento del path (relacion-envios.coordinadora.com/<token>).
    if (seg.length > 0) candidate = seg[0];
  } catch {
    // No es URL: asumimos que ya es el token (posiblemente con / sueltos).
    candidate = raw.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).pop() || raw;
  }

  // Validación defensiva: tokens alfanuméricos razonables.
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(candidate)) return null;
  return candidate;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body: RelacionRequest = req.method === "POST" ? await req.json() : {};
    const token = extractToken(body.token || body.url || "");

    if (!token) {
      return json(
        { success: false, error: "Link o token de Coordinadora inválido" },
        400,
      );
    }

    const apiUrl = `${RELACION_API_BASE}/${token}`;

    // Timeout defensivo para que un cuelgue de la API no deje la UI esperando.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
      res = await fetch(apiUrl, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 404) {
      return json(
        { success: false, error: "Relación no encontrada o expirada" },
        404,
      );
    }

    const raw = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }

    if (!res.ok || !parsed || parsed.isError || !parsed.data) {
      return json(
        {
          success: false,
          error: "Coordinadora devolvió una respuesta inesperada",
          status: res.status,
          preview: raw.slice(0, 300),
        },
        502,
      );
    }

    const data = parsed.data;
    const guias: string[] = Array.isArray(data.guias)
      ? data.guias
          .map((g: any) => String(g?.guia ?? "").trim())
          .filter((g: string) => g.length > 0)
      : [];

    return json({
      success: true,
      token,
      total_unidades: typeof data.total_unidades === "number"
        ? data.total_unidades
        : guias.length,
      collector_name: (data.nombre_empleado || "").trim() || null,
      client_name: (data.nombre_cliente || "").trim() || null,
      fecha_recogida: data.fecha_recogida || null,
      hora_recogida: data.hora_recogida || null,
      id_recogida: data.id_recogida || null,
      guias,
      raw: data,
    });
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return json(
      {
        success: false,
        error: aborted
          ? "Tiempo de espera agotado consultando Coordinadora"
          : "Error al consultar la relación de Coordinadora: " + (err?.message || String(err)),
      },
      aborted ? 504 : 500,
    );
  }
});
