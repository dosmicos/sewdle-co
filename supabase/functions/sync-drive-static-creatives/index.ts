/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { attributeDrivePerson, type DriveIdentityMapRow } from "../_shared/growth-team-scorecard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

type SupabaseAny = any;

type FolderConfig = {
  product_key: string;
  product_name: string;
  drive_folder_id: string;
  drive_folder_name: string | null;
  source_mode: string;
  include_child_folders: boolean;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime?: string;
  owners?: Array<{ emailAddress?: string; displayName?: string }>;
  lastModifyingUser?: { emailAddress?: string; displayName?: string };
  webViewLink?: string;
  trashed?: boolean;
};

function base64Url(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getServiceAccountToken(): Promise<string | null> {
  const clientEmail = Deno.env.get("GOOGLE_DRIVE_CLIENT_EMAIL");
  const privateKey = Deno.env.get("GOOGLE_DRIVE_PRIVATE_KEY");
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.metadata.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64Url(signature)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!tokenRes.ok) throw new Error(`Google service account token failed ${tokenRes.status}: ${await tokenRes.text()}`);
  const token = await tokenRes.json();
  return token.access_token as string;
}

async function getOAuthToken(): Promise<string | null> {
  const refreshToken = Deno.env.get("GOOGLE_DRIVE_REFRESH_TOKEN");
  const clientId = Deno.env.get("GOOGLE_DRIVE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET");
  if (!refreshToken || !clientId || !clientSecret) return null;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google OAuth refresh failed ${tokenRes.status}: ${await tokenRes.text()}`);
  const token = await tokenRes.json();
  return token.access_token as string;
}

async function getDriveAccessToken(): Promise<string> {
  const serviceToken = await getServiceAccountToken();
  if (serviceToken) return serviceToken;
  const oauthToken = await getOAuthToken();
  if (oauthToken) return oauthToken;
  throw new Error("Missing Google Drive credentials. Set GOOGLE_DRIVE_CLIENT_EMAIL/GOOGLE_DRIVE_PRIVATE_KEY or GOOGLE_DRIVE_REFRESH_TOKEN + OAuth client env vars.");
}

async function listDriveImages(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
      fields: "nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,owners(emailAddress,displayName),lastModifyingUser(emailAddress,displayName),webViewLink,trashed)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Drive list failed for folder ${folderId}: ${res.status} ${await res.text()}`);
    const body = await res.json();
    files.push(...(body.files ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

async function loadConfigs(sb: SupabaseAny, organizationId: string) {
  const [foldersRes, mapsRes] = await Promise.all([
    sb.from("growth_static_drive_folders").select("product_key, product_name, drive_folder_id, drive_folder_name, source_mode, include_child_folders").eq("organization_id", organizationId).eq("active", true).order("product_key"),
    sb.from("growth_drive_identity_map").select("person_key, person_label, email, display_name_pattern, priority").eq("organization_id", organizationId).eq("active", true).order("priority"),
  ]);
  if (foldersRes.error) throw foldersRes.error;
  if (mapsRes.error) throw mapsRes.error;
  return { folders: (foldersRes.data ?? []) as FolderConfig[], maps: (mapsRes.data ?? []) as DriveIdentityMapRow[] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const organizationId = body?.organizationId;
    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const since = body?.daysBack ? new Date(Date.now() - Number(body.daysBack) * 24 * 60 * 60 * 1000) : null;
    const sb = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authHeader } } });
    const { folders, maps } = await loadConfigs(sb, organizationId);
    const driveToken = await getDriveAccessToken();

    const summary = {
      totalScanned: 0,
      upserted: 0,
      byProduct: {} as Record<string, number>,
      byPerson: {} as Record<string, number>,
      lastCreatedTime: null as string | null,
      folders: folders.length,
    };

    for (const folder of folders) {
      const files = await listDriveImages(driveToken, folder.drive_folder_id);
      const rows = files
        .filter((file) => !since || new Date(file.createdTime) >= since)
        .map((file) => {
          const owner = file.owners?.[0] ?? {};
          const lastModifier = file.lastModifyingUser ?? {};
          const attribution = attributeDrivePerson({
            owner_email: owner.emailAddress,
            owner_name: owner.displayName,
            last_modifying_user_email: lastModifier.emailAddress,
            last_modifying_user_name: lastModifier.displayName,
          }, maps);

          summary.totalScanned += 1;
          summary.byProduct[folder.product_key] = (summary.byProduct[folder.product_key] ?? 0) + 1;
          summary.byPerson[attribution.personKey] = (summary.byPerson[attribution.personKey] ?? 0) + 1;
          if (!summary.lastCreatedTime || file.createdTime > summary.lastCreatedTime) summary.lastCreatedTime = file.createdTime;

          return {
            organization_id: organizationId,
            drive_file_id: file.id,
            product_key: folder.product_key,
            product_name: folder.product_name,
            source_folder_id: folder.drive_folder_id,
            file_name: file.name,
            mime_type: file.mimeType,
            created_time: file.createdTime,
            modified_time: file.modifiedTime ?? null,
            owner_email: owner.emailAddress ?? null,
            owner_name: owner.displayName ?? null,
            last_modifying_user_email: lastModifier.emailAddress ?? null,
            last_modifying_user_name: lastModifier.displayName ?? null,
            attributed_person_key: attribution.personKey,
            attributed_person_label: attribution.personLabel,
            web_view_link: file.webViewLink ?? null,
            last_seen_at: new Date().toISOString(),
            trashed: Boolean(file.trashed),
            raw_metadata: file,
          };
        });

      if (rows.length > 0) {
        const { error } = await sb
          .from("growth_static_drive_assets")
          .upsert(rows, { onConflict: "organization_id,drive_file_id" });
        if (error) throw error;
        summary.upserted += rows.length;
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[sync-drive-static-creatives] Fatal:", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
