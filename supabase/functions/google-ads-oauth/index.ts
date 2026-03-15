import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ADS_API = "https://googleads.googleapis.com/v17";

/**
 * Refreshes an access token using a refresh token.
 */
async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, redirectUri, organizationId, refreshToken, selectedAccountId, selectedAccountName } =
      await req.json();

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET");
    const DEVELOPER_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_ADS_CLIENT_ID y GOOGLE_ADS_CLIENT_SECRET no configurados en el servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ─── Action: get_client_id ────────────────────────────────────────
    if (action === "get_client_id") {
      return new Response(
        JSON.stringify({ clientId: GOOGLE_CLIENT_ID }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Action: exchange_token ───────────────────────────────────────
    if (action === "exchange_token") {
      if (!code || !redirectUri || !organizationId) {
        return new Response(
          JSON.stringify({ error: "Faltan campos: code, redirectUri, organizationId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Exchange authorization code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        console.error("Google token exchange error:", tokenData);
        return new Response(
          JSON.stringify({
            error: "Error al intercambiar código por token",
            details: tokenData.error_description || tokenData.error,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.access_token;
      const refToken = tokenData.refresh_token;

      if (!refToken) {
        return new Response(
          JSON.stringify({
            error: "No se recibió refresh_token. Asegúrate de incluir access_type=offline y prompt=consent en la URL de OAuth.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!DEVELOPER_TOKEN) {
        return new Response(
          JSON.stringify({ error: "GOOGLE_ADS_DEVELOPER_TOKEN no configurado en el servidor" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 2: List accessible customer accounts
      const customersRes = await fetch(
        `${GOOGLE_ADS_API}/customers:listAccessibleCustomers`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": DEVELOPER_TOKEN,
          },
        }
      );

      const customersData = await customersRes.json();

      if (customersData.error) {
        console.error("Google Ads list customers error:", customersData.error);
        return new Response(
          JSON.stringify({
            error: "Error al obtener cuentas de Google Ads",
            details: customersData.error.message,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 3: Fetch account names for each accessible customer
      const resourceNames: string[] = customersData.resourceNames || [];
      const accounts: { id: string; name: string }[] = [];

      for (const resourceName of resourceNames) {
        const customerId = resourceName.replace("customers/", "");

        try {
          const queryRes = await fetch(
            `${GOOGLE_ADS_API}/customers/${customerId}/googleAds:searchStream`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "developer-token": DEVELOPER_TOKEN,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                query: `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1`,
              }),
            }
          );

          const queryData = await queryRes.json();

          if (queryData[0]?.results?.[0]?.customer) {
            const cust = queryData[0].results[0].customer;
            accounts.push({
              id: cust.id?.toString() || customerId,
              name: cust.descriptiveName || `Google Ads ${customerId}`,
            });
          } else {
            // Manager account or inaccessible — still show it
            accounts.push({
              id: customerId,
              name: `Google Ads ${customerId}`,
            });
          }
        } catch (e) {
          // If we can't query this account, skip it (might be a manager account)
          console.warn(`Could not query customer ${customerId}:`, e);
          accounts.push({
            id: customerId,
            name: `Google Ads ${customerId}`,
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          refreshToken: refToken,
          accessToken,
          accounts,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Action: save_account ─────────────────────────────────────────
    if (action === "save_account") {
      if (!organizationId || !refreshToken || !selectedAccountId) {
        return new Response(
          JSON.stringify({ error: "Faltan campos: organizationId, refreshToken, selectedAccountId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deactivate any existing google_ads accounts for this org
      await supabase
        .from("ad_accounts")
        .update({ is_active: false })
        .eq("organization_id", organizationId)
        .eq("platform", "google_ads");

      // Insert or upsert the new account
      // Store refresh_token in access_token column (it's the long-lived credential)
      // token_expires_at is null because refresh tokens don't expire
      const { data, error } = await supabase
        .from("ad_accounts")
        .upsert(
          {
            organization_id: organizationId,
            platform: "google_ads",
            account_id: selectedAccountId,
            account_name: selectedAccountName || `Google Ads ${selectedAccountId}`,
            access_token: refreshToken,
            refresh_token: refreshToken,
            token_expires_at: null,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,platform" }
        )
        .select()
        .single();

      if (error) {
        // If upsert fails, try insert
        const { data: insertData, error: insertError } = await supabase
          .from("ad_accounts")
          .insert({
            organization_id: organizationId,
            platform: "google_ads",
            account_id: selectedAccountId,
            account_name: selectedAccountName || `Google Ads ${selectedAccountId}`,
            access_token: refreshToken,
            token_expires_at: null,
            is_active: true,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error saving Google Ads account:", insertError);
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

    return new Response(
      JSON.stringify({ error: `Acción no reconocida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("google-ads-oauth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
