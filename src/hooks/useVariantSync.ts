import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface VariantComparison {
  shopify_sku: string
  shopify_variant_id: string
  product_title: string
  variant_title: string
  shopify_price: number
  shopify_stock: number
  exists_in_sewdle: boolean
  sewdle_product_id?: string
  has_sku: boolean
}

export interface SyncSummary {
  total_shopify_variants: number
  existing_in_sewdle: number
  new_variants_count: number
  sync_needed: boolean
}

export interface SyncResults {
  success: number
  errors: number
  skipped: number
  details: Array<{
    sku: string
    status: 'success' | 'error' | 'skipped'
    message: string
    variant_id?: string
  }>
}

export const useVariantSync = () => {
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [comparisons, setComparisons] = useState<VariantComparison[]>([])
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [syncResults, setSyncResults] = useState<SyncResults | null>(null)
  const { toast } = useToast()

  const detectNewVariants = async (searchTerm = '') => {
    setLoading(true)
    setSyncResults(null)
    
    try {
      const { data, error } = await supabase.functions.invoke('detect-new-variants', {
        body: { searchTerm }
      })

      if (error) throw error

      setComparisons(data.comparisons || [])
      setSummary(data.summary)

      toast({
        title: 'Detección completada',
        description: `Se encontraron ${data.summary.new_variants_count} variantes nuevas`,
      })

      return data
    } catch (error) {
      console.error('Error detecting variants:', error)
      toast({
        title: 'Error',
        description: 'Error al detectar variantes nuevas',
        variant: 'destructive',
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const syncVariants = async (variantsToSync: any[]) => {
    setSyncing(true)
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-new-variants', {
        body: { variants_to_sync: variantsToSync }
      })

      if (error) throw error

      setSyncResults(data.results)

      // Update comparisons to reflect synced variants
      setComparisons(prev => 
        prev.map(comp => {
          const syncDetail = data.results.details.find((d: any) => d.sku === comp.shopify_sku)
          if (syncDetail && syncDetail.status === 'success') {
            return { ...comp, exists_in_sewdle: true }
          }
          return comp
        })
      )

      // Update summary
      if (summary) {
        setSummary({
          ...summary,
          existing_in_sewdle: summary.existing_in_sewdle + data.results.success,
          new_variants_count: summary.new_variants_count - data.results.success,
          sync_needed: (summary.new_variants_count - data.results.success) > 0
        })
      }

      toast({
        title: 'Sincronización completada',
        description: `${data.results.success} variantes sincronizadas exitosamente`,
      })

      return data
    } catch (error) {
      console.error('Error syncing variants:', error)
      toast({
        title: 'Error',
        description: 'Error al sincronizar variantes',
        variant: 'destructive',
      })
      throw error
    } finally {
      setSyncing(false)
    }
  }

  const getNewVariants = () => {
    return comparisons.filter(comp => !comp.exists_in_sewdle)
  }

  return {
    loading,
    syncing,
    comparisons,
    summary,
    syncResults,
    detectNewVariants,
    syncVariants,
    getNewVariants
  }
}