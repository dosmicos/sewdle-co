export type MetaApiError = {
  message?: string;
  type?: string;
  code?: number | string;
  error_subcode?: number | string;
  subcode?: number | string;
  fbtrace_id?: string;
};

const INVALID_TOKEN_CODES = new Set([190]);
const INVALID_TOKEN_SUBCODES = new Set([
  458, // App not installed / user has not authorized the application
  459, // User checkpointed
  460, // Password changed
  463, // Token expired
  464, // User has not confirmed email
  467, // Invalid access token
  492, // Invalid session
]);

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isMetaReconnectRequired(error: MetaApiError | null | undefined): boolean {
  if (!error) return false;
  const code = toNumber(error.code);
  const subcode = toNumber(error.error_subcode ?? error.subcode);

  // Meta Marketing API code 190 is the canonical invalid/expired OAuth token.
  // The subcodes above are kept for documentation and future tightening, but
  // code 190 alone is already a reconnect-required condition.
  if (code !== null && INVALID_TOKEN_CODES.has(code)) return true;
  if (subcode !== null && INVALID_TOKEN_SUBCODES.has(subcode)) return true;

  return false;
}

export function compactMetaError(
  error: MetaApiError | null | undefined,
  fallback = "Error desconocido de Meta"
): string {
  if (!error) return fallback;
  const parts = [
    error.message || fallback,
    error.type ? `type=${error.type}` : null,
    error.code !== undefined ? `code=${error.code}` : null,
    error.error_subcode !== undefined ? `subcode=${error.error_subcode}` : null,
    error.fbtrace_id ? `fbtrace=${error.fbtrace_id}` : null,
  ].filter(Boolean);

  return parts.join(" | ").slice(0, 1000);
}

export async function recordMetaReconnectRequired(
  supabase: any,
  adAccountId: string,
  message: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ad_accounts")
    .update({
      is_active: false,
      needs_reconnect: true,
      last_sync_status: "reconnect_required",
      last_sync_error: message.slice(0, 1000),
      updated_at: now,
    })
    .eq("id", adAccountId);

  if (error) {
    console.error("[meta-sync-health] Failed to record reconnect state:", error);
  }
}

export async function recordMetaSyncError(
  supabase: any,
  adAccountId: string,
  metaError: MetaApiError | null | undefined,
  fallback = "Error de la API de Meta"
): Promise<{ needsReconnect: boolean; message: string }> {
  const now = new Date().toISOString();
  const needsReconnect = isMetaReconnectRequired(metaError);
  const message = compactMetaError(metaError, fallback);
  const update: Record<string, unknown> = {
    last_sync_status: needsReconnect ? "reconnect_required" : "error",
    last_sync_error: message,
    needs_reconnect: needsReconnect,
    updated_at: now,
  };

  // Important: transient OAuthException/rate-limit/permission errors must not
  // disable the account. Only explicit invalid/expired token cases require a
  // reconnect and can make the UI show Reconectar Meta.
  if (needsReconnect) {
    update.is_active = false;
  }

  const { error } = await supabase
    .from("ad_accounts")
    .update(update)
    .eq("id", adAccountId);

  if (error) {
    console.error("[meta-sync-health] Failed to record sync error:", error);
  }

  return { needsReconnect, message };
}

export async function recordMetaSyncSuccess(
  supabase: any,
  adAccountId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ad_accounts")
    .update({
      is_active: true,
      needs_reconnect: false,
      last_sync_status: "ok",
      last_sync_error: null,
      last_sync_at: now,
      updated_at: now,
    })
    .eq("id", adAccountId);

  if (error) {
    console.error("[meta-sync-health] Failed to record sync success:", error);
  }
}
