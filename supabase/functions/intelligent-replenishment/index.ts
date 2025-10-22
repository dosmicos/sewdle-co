import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

interface ReplenishmentRecord {
  variant_id: string;
  product_name: string;
  variant_size: string | null;
  variant_color: string | null;
  sku_variant: string;
  current_stock: number;
  pending_production: number;
  sales_30d: number;
  orders_count_30d: number;
  avg_daily_sales: number;
  days_of_supply: number;
  projected_30d_demand: number;
  suggested_quantity: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  data_confidence: 'high' | 'medium' | 'low';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando cálculo de reposición inteligente...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variables de entorno de Supabase no configuradas');
      throw new Error('Variables de entorno de Supabase no configuradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Cliente de Supabase inicializado');

    // Get organization_id from request body
    const { organization_id } = await req.json();
    
    if (!organization_id) {
      throw new Error('organization_id es requerido');
    }
    
    console.log('🏢 Organización:', organization_id);

    // Ejecutar función de cálculo de reposición
    console.log('🔄 Ejecutando refresh_inventory_replenishment...');
    const { data: rpcResult, error: calcError } = await supabase
      .rpc('refresh_inventory_replenishment', { org_id: organization_id });

    if (calcError) {
      console.error('❌ Error en cálculo de reposición:', calcError);
      throw new Error(`Error en función RPC: ${calcError.message || JSON.stringify(calcError)}`);
    }

    const insertedCount = (rpcResult as any)?.inserted || 0;
    console.log(`✅ Procesadas ${insertedCount} variantes de productos`);

    // Obtener registros generados desde la vista
    const { data: records, error: recordsError } = await supabase
      .from('v_replenishment_details')
      .select('*')
      .eq('organization_id', organization_id)
      .gte('calculation_date', new Date().toISOString().split('T')[0]);

    if (recordsError) {
      console.error('❌ Error obteniendo registros:', recordsError);
      throw recordsError;
    }

    console.log(`📝 Obtenidos ${records?.length || 0} registros de reposición`);

    // Log detallado de resultados
    const criticalCount = records?.filter(s => s.urgency === 'critical').length || 0;
    const highCount = records?.filter(s => s.urgency === 'high').length || 0;
    const mediumCount = records?.filter(s => s.urgency === 'medium').length || 0;
    const lowCount = records?.filter(s => s.urgency === 'low').length || 0;

    console.log(`🚨 Críticas: ${criticalCount}, ⚠️ Altas: ${highCount}, 📊 Medias: ${mediumCount}, ✅ Bajas: ${lowCount}`);

    // Crear resumen para respuesta
    const summary = {
      calculation_date: new Date().toISOString().split('T')[0],
      total_variants_processed: insertedCount,
      records_generated: records?.length || 0,
      urgency_breakdown: {
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount
      },
      execution_time: new Date().toISOString(),
      status: 'completed'
    };

    // Log para audit trail
    console.log('📊 Resumen de ejecución:', JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cálculo de reposición inteligente completado exitosamente',
        summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Error en función de reposición inteligente:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});