import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AuthCheckResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

export async function requireAuthenticatedUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthCheckResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: "Invalid authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseKey = supabaseAnonKey ?? supabaseServiceRoleKey;

  // Allow trusted server-to-server calls that explicitly use service-role token.
  if (supabaseServiceRoleKey && token === supabaseServiceRoleKey) {
    return { ok: true, userId: "service-role" };
  }

  if (!supabaseUrl || !supabaseKey) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: "Server misconfiguration: missing Supabase keys" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: "Invalid or expired user token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }

  return { ok: true, userId: data.user.id };
}
