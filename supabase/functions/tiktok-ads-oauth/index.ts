import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      action,
      code,
      organizationId,
      accessToken,
      selectedAdvertiserId,
      selectedAdvertiserName,
    } = await req.json();

    const TIKTOK_ADS_CLIENT_KEY = Deno.env.get("TIKTOK_ADS_CLIENT_KEY");
    const TIKTOK_ADS_CLIENT_SECRET = Deno.env.get("TIKTOK_ADS_CLIENT_SECRET");

    if (!TIKTOK_ADS_CLIENT_KEY || !TIKTOK_ADS_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({
          error:
            "TIKTOK_ADS_CLIENT_KEY y TIKTOK_ADS_CLIENT_SECRET no configurados en el servidor",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ─── Action: get_client_key ───────────────────────────────────────
    if (action === "get_client_key") {
      return new Response(
        JSON.stringify({ clientKey: TIKTOK_ADS_CLIENT_KEY }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Action: exchange_token ───────────────────────────────────────
    if (action === "exchange_token") {
      if (!code || !organizationId) {
        return new Response(
          JSON.stringify({ error: "Faltan campos: code, organizationId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Exchange auth_code for access_token
      const tokenRes = await fetch(`${TIKTOK_API}/oauth2/access_token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: TIKTOK_ADS_CLIENT_KEY,
          secret: TIKTOK_ADS_CLIENT_SECRET,
          auth_code: code,
        }),
      });
      const tokenJson = await tokenRes.json();

      if (tokenJson.code !== 0) {
        console.error("TikTok token exchange error:", tokenJson);
        return new Response(
          JSON.stringify({
            error: "Error al intercambiar código por token",
            details: tokenJson.message || JSON.stringify(tokenJson),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tiktokAccessToken = tokenJson.data.access_token;
      const advertiserIds: string[] = tokenJson.data.advertiser_ids || [];

      if (advertiserIds.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            accessToken: tiktokAccessToken,
            tokenExpiresAt: null,
            accounts: [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 2: Fetch advertiser info for each authorized advertiser
      const infoUrl = `${TIKTOK_API}/advertiser/info/?advertiser_ids=${encodeURIComponent(
        JSON.stringify(advertiserIds)
      )}&fields=${encodeURIComponent(
        JSON.stringify([
          "advertiser_id",
          "name",
          "currency",
          "timezone",
          "status",
          "company",
        ])
      )}`;

      const infoRes = await fetch(infoUrl, {
        headers: { "Access-Token": tiktokAccessToken },
      });
      const infoJson = await infoRes.json();

      if (infoJson.code !== 0) {
        console.error("TikTok advertiser info error:", infoJson);
        return new Response(
          JSON.stringify({
            error: "Error al obtener info de cuentas publicitarias",
            details: infoJson.message || JSON.stringify(infoJson),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accounts = (infoJson.data?.list || []).map((a: any) => ({
        id: a.advertiser_id,
        name: a.name,
        currency: a.currency,
        timezone: a.timezone,
        status: a.status,
        company: a.company,
      }));

      return new Response(
        JSON.stringify({
          success: true,
          accessToken: tiktokAccessToken,
          tokenExpiresAt: null, // TikTok long-lived token (no auto-expiry)
          accounts,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Action: save_account ─────────────────────────────────────────
    if (action === "save_account") {
      if (!organizationId || !accessToken || !selectedAdvertiserId) {
        return new Response(
          JSON.stringify({
            error:
              "Faltan campos: organizationId, accessToken, selectedAdvertiserId",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deactivate any existing tiktok_ads accounts for this org
      await supabase
        .from("ad_accounts")
        .update({ is_active: false })
        .eq("organization_id", organizationId)
        .eq("platform", "tiktok_ads");

      const { data, error } = await supabase
        .from("ad_accounts")
        .upsert(
          {
            organization_id: organizationId,
            platform: "tiktok_ads",
            account_id: selectedAdvertiserId,
            account_name:
              selectedAdvertiserName || `TikTok Ads ${selectedAdvertiserId}`,
            access_token: accessToken,
            token_expires_at: null,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,platform" }
        )
        .select()
        .single();

      if (error) {
        const { data: insertData, error: insertError } = await supabase
          .from("ad_accounts")
          .insert({
            organization_id: organizationId,
            platform: "tiktok_ads",
            account_id: selectedAdvertiserId,
            account_name:
              selectedAdvertiserName || `TikTok Ads ${selectedAdvertiserId}`,
            access_token: accessToken,
            is_active: true,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error saving tiktok_ads account:", insertError);
          return new Response(
            JSON.stringify({
              error: "Error al guardar cuenta",
              details: insertError.message,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, account: insertData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, account: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Acción no reconocida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("tiktok-ads-oauth error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
