import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service_role client — bypasses RLS for all operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the caller is an authenticated user
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { manifest_id } = await req.json();
    if (!manifest_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'manifest_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Resolve user's organization
    const { data: membership } = await supabase
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership?.organization_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Organization not found for this user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Verify manifest belongs to user's organization (security check)
    const { data: manifest } = await supabase
      .from('shipping_manifests')
      .select('id, organization_id')
      .eq('id', manifest_id)
      .eq('organization_id', membership.organization_id)
      .single();

    if (!manifest) {
      return new Response(
        JSON.stringify({ success: false, error: 'Manifest not found or access denied' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Delete manifest items first (ON DELETE CASCADE is set but being explicit)
    const { error: itemsError } = await supabase
      .from('manifest_items')
      .delete()
      .eq('manifest_id', manifest_id);

    if (itemsError) throw itemsError;

    // Delete the manifest itself
    const { error: manifestError } = await supabase
      .from('shipping_manifests')
      .delete()
      .eq('id', manifest_id);

    if (manifestError) throw manifestError;

    console.log(`✅ Manifest ${manifest_id} deleted by user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('❌ delete-manifest error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
