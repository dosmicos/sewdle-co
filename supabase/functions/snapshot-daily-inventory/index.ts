import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SnapshotResult {
  success: boolean;
  total_variants: number;
  snapshots_created: number;
  errors: Array<{ variant_id: string; error: string }>;
  execution_time_ms: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('🔄 Iniciando snapshot diario de inventario...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active product variants with their organization
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select(`
        id,
        stock_quantity,
        sku_variant,
        product:products!inner(
          organization_id,
          name,
          status
        )
      `)
      .eq('product.status', 'active')
      .not('stock_quantity', 'is', null);

    if (variantsError) {
      throw new Error(`Error fetching variants: ${variantsError.message}`);
    }

    if (!variants || variants.length === 0) {
      console.log('⚠️ No hay variantes activas para procesar');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active variants to process',
          total_variants: 0,
          snapshots_created: 0,
          errors: [],
          execution_time_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Procesando ${variants.length} variantes...`);

    // Prepare snapshot records
    const snapshots = variants.map((variant: any) => ({
      product_variant_id: variant.id,
      organization_id: variant.product.organization_id,
      stock_quantity: variant.stock_quantity || 0,
      source: 'daily_snapshot',
      recorded_at: new Date().toISOString(),
    }));

    // Insert snapshots in batch
    const { error: insertError } = await supabase
      .from('product_stock_history')
      .insert(snapshots);

    if (insertError) {
      throw new Error(`Error inserting snapshots: ${insertError.message}`);
    }

    // Log execution in sync_control_logs
    await supabase.from('sync_control_logs').insert({
      sync_type: 'inventory_snapshot',
      sync_mode: 'daily_cron',
      status: 'completed',
      error_message: null,
      execution_details: {
        total_variants: variants.length,
        snapshots_created: snapshots.length,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    });

    const result: SnapshotResult = {
      success: true,
      total_variants: variants.length,
      snapshots_created: snapshots.length,
      errors: [],
      execution_time_ms: Date.now() - startTime,
    };

    console.log(`✅ Snapshot completado: ${result.snapshots_created} registros creados en ${result.execution_time_ms}ms`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error en snapshot diario:', error);

    // Log error in sync_control_logs
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('sync_control_logs').insert({
        sync_type: 'inventory_snapshot',
        sync_mode: 'daily_cron',
        status: 'failed',
        error_message: error.message,
        execution_details: {
          error: error.message,
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        execution_time_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
