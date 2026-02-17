import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface FullSyncSummary {
  shopify_products: number
  shopify_variants: number
  products_created: number
  variants_created: number
  variants_updated: number
  variants_skipped: number
  errors: number
  error_details: string[]
}

export const useFullShopifySync = () => {
  const [syncing, setSyncing] = useState(false)
  const [summary, setSummary] = useState<FullSyncSummary | null>(null)
  const { toast } = useToast()

  const syncAll = async (organizationId?: string) => {
    setSyncing(true)
    setSummary(null)

    try {
      const { data, error } = await supabase.functions.invoke('sync-all-shopify-products', {
        body: { organization_id: organizationId }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setSummary(data.summary)

      toast({
        title: 'Sincronización completa',
        description: `Productos creados: ${data.summary.products_created}, Variantes creadas: ${data.summary.variants_created}, Actualizadas: ${data.summary.variants_updated}`,
      })

      return data.summary
    } catch (error: unknown) {
      console.error('Error in full sync:', error)
      toast({
        title: 'Error de sincronización',
        description: error.message || 'Error al sincronizar con Shopify',
        variant: 'destructive',
      })
      throw error
    } finally {
      setSyncing(false)
    }
  }

  return { syncing, summary, syncAll }
}
