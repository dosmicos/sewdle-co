/**
 * fetch a la Graph API de Meta con reintento automático para errores transitorios.
 *
 * Meta documenta los códigos 1 ("API Unknown") y 2 ("API Service") como errores
 * temporales de su plataforma que deben reintentarse, igual que cualquier HTTP 5xx.
 * Backoff: 1.5s, 3s (total ~4.5s extra en el peor caso) — cabe dentro de los
 * timeouts de los clientes (30-45s).
 */
const RETRYABLE_META_CODES = new Set([1, 2]);
const MAX_ATTEMPTS = 3;

export async function fetchGraphWithRetry(
  url: string,
  init: RequestInit
): Promise<{ response: Response; data: any }> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, init);
    const data = await response.json().catch(() => null);

    const retryable =
      response.status >= 500 || RETRYABLE_META_CODES.has(data?.error?.code);

    if (response.ok || !retryable || attempt >= MAX_ATTEMPTS) {
      return { response, data };
    }

    console.warn(
      `Graph API transient error (attempt ${attempt}/${MAX_ATTEMPTS}, status ${response.status}, code ${data?.error?.code}, fbtrace ${data?.error?.fbtrace_id}) — retrying`
    );
    await new Promise(resolve => setTimeout(resolve, attempt * 1500));
  }
}
