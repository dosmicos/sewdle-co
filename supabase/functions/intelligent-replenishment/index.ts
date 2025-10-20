import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

interface ReplenishmentCalculation {
  variant_id: string;
  product_name: string;
  variant_size: string;
  variant_color: string;
  sku_variant: string;
  current_stock: number;
  sales_velocity: number;
  days_of_stock: number;
  open_orders: number;
  projected_demand: number;
  suggested_quantity: number;
  urgency_level: string;
  reason: string;
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

    // Ejecutar función de cálculo de reposición con organization_id
    console.log('📊 Ejecutando cálculo de sugerencias...');
    const { data: calculations, error: calcError } = await supabase
      .rpc('calculate_replenishment_suggestions', { p_organization_id: organization_id });

    if (calcError) {
      console.error('❌ Error en cálculo de reposición:', calcError);
      throw new Error(`Error en función RPC: ${calcError.message || JSON.stringify(calcError)}`);
    }

    const results = calculations as ReplenishmentCalculation[];
    console.log(`✅ Procesadas ${results.length} variantes de productos`);

    // Contar sugerencias por nivel de urgencia
    const urgencyStats = results.reduce((acc: Record<string, number>, calc) => {
      acc[calc.urgency_level] = (acc[calc.urgency_level] || 0) + 1;
      return acc;
    }, {});

    // Obtener sugerencias generadas (que se insertaron en la función)
    const { data: suggestions, error: suggestionsError } = await supabase
      .from('replenishment_suggestions')
      .select('*')
      .eq('calculation_date', new Date().toISOString().split('T')[0]);

    if (suggestionsError) {
      console.error('❌ Error obteniendo sugerencias:', suggestionsError);
      throw suggestionsError;
    }

    console.log(`📝 Generadas ${suggestions.length} sugerencias de reposición`);

    // Log detallado de resultados
    const criticalCount = suggestions.filter(s => s.urgency_level === 'critical').length;
    const highCount = suggestions.filter(s => s.urgency_level === 'high').length;
    const normalCount = suggestions.filter(s => s.urgency_level === 'normal').length;

    console.log(`🚨 Críticas: ${criticalCount}, ⚠️ Altas: ${highCount}, 📋 Normales: ${normalCount}`);

    // Crear resumen para respuesta
    const summary = {
      calculation_date: new Date().toISOString().split('T')[0],
      total_variants_processed: results.length,
      suggestions_generated: suggestions.length,
      urgency_breakdown: {
        critical: criticalCount,
        high: highCount,
        normal: normalCount,
        low: suggestions.filter(s => s.urgency_level === 'low').length
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