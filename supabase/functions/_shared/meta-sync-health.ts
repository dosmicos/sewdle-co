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

// Transient throttling. These recover on their own — the previous successful
// sync's data is still valid, so they must NOT mark the account as error
// (which would surface the "Meta spend necesita validación" alarm) nor as
// reconnect_required.
const RATE_LIMIT_CODES = new Set([
  4,   // Application request limit reached (app-level hourly budget)
  17,  // User request limit reached (per ad account)
  32,  // Page request limit reached
  613, // Calls to this API have exceeded the rate limit
  80000, // Business Use Case: ads insights throttle
  80001,
  80002,
  80003,
  80004,
  80014,
]);
const RATE_LIMIT_SUBCODES = new Set([
  1504022, // Ad insights rate limit (the subcode in the user-reported error)
  1504039,
  2446079,
]);

export function isMetaRateLimited(error: MetaApiError | null | undefined): boolean {
  if (!error) return false;
  const code = toNumber(error.code);
  const subcode = toNumber(error.error_subcode ?? error.subcode);
  if (code !== null && RATE_LIMIT_CODES.has(code)) return true;
  if (subcode !== null && RATE_LIMIT_SUBCODES.has(subcode)) return true;
  return false;
}

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
): Promise<{ needsReconnect: boolean; rateLimited: boolean; message: string }> {
  const now = new Date().toISOString();
  const needsReconnect = isMetaReconnectRequired(metaError);
  const rateLimited = !needsReconnect && isMetaRateLimited(metaError);
  const message = compactMetaError(metaError, fallback);

  // Classification:
  //  - reconnect_required → invalid/expired token; account disabled, UI shows Reconectar.
  //  - rate_limited       → transient throttle; account stays active, NO error alarm.
  //                         The last successful sync's data is still valid and the next
  //                         hourly cron tick will retry. Only the staleness check
  //                         (lastSyncAt age) should eventually warn if it persists.
  //  - error              → genuine failure worth surfacing now.
  const status = needsReconnect
    ? "reconnect_required"
    : rateLimited
      ? "rate_limited"
      : "error";

  const update: Record<string, unknown> = {
    last_sync_status: status,
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

  return { needsReconnect, rateLimited, message };
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
