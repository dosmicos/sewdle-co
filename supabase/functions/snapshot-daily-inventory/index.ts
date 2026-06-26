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

    const recordedAt = new Date().toISOString();

    // Prepare snapshot records. The embedded product can arrive as an object or
    // a single-element array depending on the PostgREST relation shape, so we
    // normalize before reading organization_id.
    const allSnapshots = variants.map((variant: any) => {
      const product = Array.isArray(variant.product) ? variant.product[0] : variant.product;
      return {
        product_variant_id: variant.id,
        organization_id: product?.organization_id ?? null,
        stock_quantity: variant.stock_quantity || 0,
        source: 'daily_snapshot',
        recorded_at: recordedAt,
      };
    });

    // organization_id is NOT NULL in product_stock_history. A single variant
    // whose product has a null organization_id used to abort the entire atomic
    // insert, silently killing the daily snapshot (this happened every night
    // from 2026-04-14 onward). Skip orphan variants and log them instead of
    // dropping all snapshots.
    const snapshots = allSnapshots.filter((s) => s.organization_id);
    const skippedNullOrg = allSnapshots
      .filter((s) => !s.organization_id)
      .map((s) => s.product_variant_id);

    if (skippedNullOrg.length > 0) {
      console.warn(`⚠️ Saltando ${skippedNullOrg.length} variantes sin organization_id (productos huérfanos)`);
    }

    // Insert in chunks so one bad row (or a large catalog) can't abort the
    // whole snapshot. Each chunk is independent; we accumulate failures.
    const CHUNK_SIZE = 500;
    let snapshotsCreated = 0;
    const insertErrors: Array<{ chunk: number; error: string }> = [];

    for (let i = 0; i < snapshots.length; i += CHUNK_SIZE) {
      const batch = snapshots.slice(i, i + CHUNK_SIZE);
      const { error: insertError } = await supabase
        .from('product_stock_history')
        .insert(batch);

      if (insertError) {
        console.error(`❌ Error en chunk ${i / CHUNK_SIZE}: ${insertError.message}`);
        insertErrors.push({ chunk: i / CHUNK_SIZE, error: insertError.message });
      } else {
        snapshotsCreated += batch.length;
      }
    }

    // If every chunk failed there is a real systemic problem — surface it.
    if (snapshots.length > 0 && snapshotsCreated === 0) {
      throw new Error(`Error inserting snapshots: all chunks failed. First: ${insertErrors[0]?.error}`);
    }

    const status = insertErrors.length > 0 ? 'completed_with_errors' : 'completed';

    // Log execution in sync_control_logs
    await supabase.from('sync_control_logs').insert({
      sync_type: 'inventory_snapshot',
      sync_mode: 'daily_cron',
      status,
      error_message: insertErrors.length > 0 ? `${insertErrors.length} chunk(s) failed` : null,
      execution_details: {
        total_variants: variants.length,
        snapshots_created: snapshotsCreated,
        skipped_null_org: skippedNullOrg.length,
        skipped_variant_ids: skippedNullOrg.slice(0, 50),
        chunk_errors: insertErrors,
        execution_time_ms: Date.now() - startTime,
        timestamp: recordedAt,
      },
    });

    const result: SnapshotResult & { skipped_null_org: number } = {
      success: true,
      total_variants: variants.length,
      snapshots_created: snapshotsCreated,
      skipped_null_org: skippedNullOrg.length,
      errors: insertErrors.map((e) => ({ variant_id: `chunk_${e.chunk}`, error: e.error })),
      execution_time_ms: Date.now() - startTime,
    };

    console.log(`✅ Snapshot completado: ${result.snapshots_created} registros creados (${skippedNullOrg.length} saltados) en ${result.execution_time_ms}ms`);

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
