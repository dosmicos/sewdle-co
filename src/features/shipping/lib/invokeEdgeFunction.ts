import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';

export type InvokeEdgeFunctionOptions = {
  /** Abort from caller (e.g. when user switches order) */
  signal?: AbortSignal;
  /** Per-request timeout. Defaults to 10s. */
  timeoutMs?: number;
  method?: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
};

/**
 * Invoke a Supabase Edge Function with support for AbortController + timeout.
 * We intentionally avoid `supabase.functions.invoke` because it doesn't expose abort signals.
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body?: unknown,
  options?: InvokeEdgeFunctionOptions
): Promise<T> {
  const supabaseUrl = SUPABASE_URL;
  const supabaseKey = SUPABASE_PUBLISHABLE_KEY;

  const timeoutMs = options?.timeoutMs ?? 10_000;
  const controller = new AbortController();

  const abortHandler = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', abortHandler, { once: true });
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: options?.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken ?? supabaseKey}`,
        ...(options?.headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      const msg =
        (parsed && typeof parsed === 'object' && (parsed.error || parsed.message)) ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return parsed as T;
  } finally {
    clearTimeout(timeoutId);
    if (options?.signal) {
      options.signal.removeEventListener('abort', abortHandler);
    }
  }
}
