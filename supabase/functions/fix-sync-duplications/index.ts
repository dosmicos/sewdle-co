import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, date, specificSku } = await req.json()

    console.log(`🔧 Iniciando ${action} para fecha: ${date}${specificSku ? `, SKU: ${specificSku}` : ''}`)

    if (action === 'investigate') {
      // Investigar duplicaciones en sales_metrics
      const { data: metrics, error: metricsError } = await supabaseClient
        .from('sales_metrics')
        .select(`
          *,
          product_variants (
            sku_variant,
            products (name)
          )
        `)
        .eq('metric_date', date)
        .order('created_at', { ascending: false })

      if (metricsError) throw metricsError

      // Agrupar por variant_id para detectar duplicaciones
      const grouped = metrics.reduce((acc: any, metric: any) => {
        const key = metric.product_variant_id
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push(metric)
        return acc
      }, {})

      const duplications = Object.entries(grouped)
        .filter(([_, metrics]: any) => metrics.length > 1)
        .map(([variantId, metrics]: any) => ({
          variant_id: variantId,
          sku_variant: metrics[0].product_variants?.sku_variant,
          product_name: metrics[0].product_variants?.products?.name,
          duplicate_count: metrics.length,
          total_sales: metrics.reduce((sum: number, m: any) => sum + m.sales_quantity, 0),
          total_orders: metrics.reduce((sum: number, m: any) => sum + m.orders_count, 0),
          entries: metrics.map((m: any) => ({
            id: m.id,
            sales_quantity: m.sales_quantity,
            orders_count: m.orders_count,
            created_at: m.created_at
          }))
        }))

      console.log(`📊 Encontradas ${duplications.length} duplicaciones`)

      return new Response(JSON.stringify({
        success: true,
        date,
        total_metrics: metrics.length,
        duplications,
        investigation_summary: {
          total_duplicated_variants: duplications.length,
          total_duplicate_entries: duplications.reduce((sum, d) => sum + d.duplicate_count, 0),
          affected_sales: duplications.reduce((sum, d) => sum + d.total_sales, 0)
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'clean') {
      let deletedCount = 0
      let cleanedVariants: string[] = []

      // Obtener duplicaciones
      const { data: metrics, error: metricsError } = await supabaseClient
        .from('sales_metrics')
        .select('*')
        .eq('metric_date', date)
        .order('created_at', { ascending: false })

      if (metricsError) throw metricsError

      // Agrupar por variant_id
      const grouped = metrics.reduce((acc: any, metric: any) => {
        const key = metric.product_variant_id
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push(metric)
        return acc
      }, {})

      // Limpiar duplicaciones (mantener solo el más reciente)
      for (const [variantId, duplicates] of Object.entries(grouped) as [string, any][]) {
        if (duplicates.length > 1) {
          // Si hay SKU específico, solo limpiar ese
          if (specificSku) {
            const variant = await supabaseClient
              .from('product_variants')
              .select('sku_variant')
              .eq('id', variantId)
              .single()
            
            if (variant.data?.sku_variant !== specificSku) {
              continue
            }
          }

          // Mantener el más reciente, borrar el resto
          const [keep, ...toDelete] = duplicates.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )

          for (const entry of toDelete) {
            const { error: deleteError } = await supabaseClient
              .from('sales_metrics')
              .delete()
              .eq('id', entry.id)

            if (!deleteError) {
              deletedCount++
            }
          }

          cleanedVariants.push(variantId)
          console.log(`🧹 Limpiadas ${toDelete.length} entradas duplicadas para variante ${variantId}`)
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Limpieza completada para ${date}`,
        deleted_entries: deletedCount,
        cleaned_variants: cleanedVariants.length,
        date
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'validate') {
      // Validar consistencia después de limpieza
      const { data: currentMetrics } = await supabaseClient
        .from('sales_metrics')
        .select(`
          product_variant_id,
          sales_quantity,
          orders_count,
          product_variants (sku_variant)
        `)
        .eq('metric_date', date)

      const validation = currentMetrics?.reduce((acc: any, metric: any) => {
        const sku = metric.product_variants?.sku_variant
        if (!acc[sku]) {
          acc[sku] = {
            sku_variant: sku,
            total_sales: 0,
            total_orders: 0,
            entries_count: 0
          }
        }
        acc[sku].total_sales += metric.sales_quantity
        acc[sku].total_orders += metric.orders_count
        acc[sku].entries_count += 1
        return acc
      }, {})

      const duplicatesFound = Object.values(validation || {}).filter((v: any) => v.entries_count > 1)

      return new Response(JSON.stringify({
        success: true,
        date,
        validation_results: validation,
        duplicates_remaining: duplicatesFound.length,
        is_clean: duplicatesFound.length === 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error(`Acción no reconocida: ${action}`)

  } catch (error) {
    console.error('❌ Error en fix-sync-duplications:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})