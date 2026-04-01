// ─── Mem0 Cloud API Helpers ─────────────────────────────────────
// Documentación: https://docs.mem0.ai/api-reference

const MEM0_BASE_URL = "https://api.mem0.ai";

function getHeaders(): Record<string, string> {
  const apiKey = Deno.env.get("MEM0_API_KEY");
  if (!apiKey) throw new Error("MEM0_API_KEY no está configurada");
  return {
    "Content-Type": "application/json",
    Authorization: `Token ${apiKey}`,
  };
}

export interface Mem0Memory {
  id: string;
  memory: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  score?: number;
}

/**
 * Busca memorias relevantes por significado semántico.
 * POST /v2/memories/search/
 */
export async function searchMemories(
  query: string,
  userId: string,
  agentId: string,
  limit = 10
): Promise<Mem0Memory[]> {
  try {
    const res = await fetch(`${MEM0_BASE_URL}/v2/memories/search/`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        query,
        user_id: userId,
        agent_id: agentId,
        limit,
      }),
    });

    if (!res.ok) {
      console.error("Mem0 search error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return (data.results || data) as Mem0Memory[];
  } catch (err) {
    console.error("Mem0 searchMemories error:", err);
    return [];
  }
}

/**
 * Agrega una nueva memoria.
 * POST /v1/memories/
 */
export async function addMemory(
  content: string,
  userId: string,
  agentId: string,
  metadata?: Record<string, unknown>
): Promise<Mem0Memory | null> {
  try {
    const body: Record<string, unknown> = {
      messages: [{ role: "user", content }],
      user_id: userId,
      agent_id: agentId,
    };
    if (metadata) body.metadata = metadata;

    const res = await fetch(`${MEM0_BASE_URL}/v1/memories/`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("Mem0 addMemory error:", res.status, await res.text());
      return null;
    }

    return (await res.json()) as Mem0Memory;
  } catch (err) {
    console.error("Mem0 addMemory error:", err);
    return null;
  }
}

/**
 * Obtiene todas las memorias de un usuario/agente.
 * GET /v1/memories/ con query params
 */
export async function getAllMemories(
  userId: string,
  agentId: string
): Promise<Mem0Memory[]> {
  try {
    const params = new URLSearchParams({
      user_id: userId,
      agent_id: agentId,
    });

    const res = await fetch(`${MEM0_BASE_URL}/v1/memories/?${params}`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      console.error("Mem0 getAllMemories error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return (data.results || data) as Mem0Memory[];
  } catch (err) {
    console.error("Mem0 getAllMemories error:", err);
    return [];
  }
}
