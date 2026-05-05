import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, redirectUri, organizationId, accessToken, selectedAccountId, selectedAccountName } =
      await req.json();

    const META_APP_ID = Deno.env.get("META_APP_ID");
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET");

    if (!META_APP_ID || !META_APP_SECRET) {
      return new Response(
        JSON.stringify({ error: "META_APP_ID y META_APP_SECRET no configurados en el servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ─── Action: exchange_token ───────────────────────────────────────
    // Receives the OAuth code from the frontend and exchanges it for tokens
    if (action === "exchange_token") {
      if (!code || !redirectUri || !organizationId) {
        return new Response(
          JSON.stringify({ error: "Faltan campos: code, redirectUri, organizationId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Exchange code for short-lived token
      const tokenUrl = `${GRAPH_API}/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_APP_SECRET}&code=${code}`;

      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        console.error("Meta token exchange error:", tokenData.error);
        return new Response(
          JSON.stringify({
            error: "Error al intercambiar código por token",
            details: tokenData.error.message,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const shortLivedToken = tokenData.access_token;

      // Step 2: Exchange short-lived token for long-lived token (60 days)
      const longTokenUrl = `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;

      const longTokenRes = await fetch(longTokenUrl);
      const longTokenData = await longTokenRes.json();

      if (longTokenData.error) {
        console.error("Meta long-lived token error:", longTokenData.error);
        return new Response(
          JSON.stringify({
            error: "Error al obtener token de larga duración",
            details: longTokenData.error.message,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const longLivedToken = longTokenData.access_token;
      const expiresIn = longTokenData.expires_in || 5184000; // default 60 days
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Step 3: Fetch user's ad accounts
      const accountsRes = await fetch(
        `${GRAPH_API}/me/adaccounts?fields=id,name,account_status,currency,timezone_name&access_token=${longLivedToken}`
      );
      const accountsData = await accountsRes.json();

      if (accountsData.error) {
        console.error("Meta ad accounts error:", accountsData.error);
        return new Response(
          JSON.stringify({
            error: "Error al obtener cuentas publicitarias",
            details: accountsData.error.message,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filter only active accounts (account_status = 1)
      const accounts = (accountsData.data || []).map((acc: any) => ({
        id: acc.id.replace("act_", ""),
        fullId: acc.id,
        name: acc.name,
        status: acc.account_status,
        currency: acc.currency,
        timezone: acc.timezone_name,
      }));

      return new Response(
        JSON.stringify({
          success: true,
          accessToken: longLivedToken,
          tokenExpiresAt,
          accounts,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Action: save_account ─────────────────────────────────────────
    // Saves the selected ad account + token to ad_accounts table
    if (action === "save_account") {
      if (!organizationId || !accessToken || !selectedAccountId) {
        return new Response(
          JSON.stringify({ error: "Faltan campos: organizationId, accessToken, selectedAccountId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deactivate any existing meta accounts for this org
      await supabase
        .from("ad_accounts")
        .update({ is_active: false })
        .eq("organization_id", organizationId)
        .eq("platform", "meta");

      // Calculate token expiry (60 days from now if not provided)
      const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

      // Insert the new account
      const { data, error } = await supabase
        .from("ad_accounts")
        .upsert(
          {
            organization_id: organizationId,
            platform: "meta",
            account_id: selectedAccountId,
            account_name: selectedAccountName || `Meta Ads ${selectedAccountId}`,
            access_token: accessToken,
            token_expires_at: tokenExpiresAt,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,platform" }
        )
        .select()
        .single();

      if (error) {
        // If upsert fails due to no unique constraint, try insert
        const { data: insertData, error: insertError } = await supabase
          .from("ad_accounts")
          .insert({
            organization_id: organizationId,
            platform: "meta",
            account_id: selectedAccountId,
            account_name: selectedAccountName || `Meta Ads ${selectedAccountId}`,
            access_token: accessToken,
            token_expires_at: tokenExpiresAt,
            is_active: true,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error saving ad account:", insertError);
          return new Response(
            JSON.stringify({ error: "Error al guardar cuenta", details: insertError.message }),
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

    // ─── Action: get_app_id ───────────────────────────────────────────
    // Returns the Meta App ID for frontend OAuth redirect (safe to expose)
    if (action === "get_app_id") {
      return new Response(
        JSON.stringify({ appId: META_APP_ID }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Acción no reconocida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("meta-ads-oauth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
