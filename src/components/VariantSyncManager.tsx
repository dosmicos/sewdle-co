import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, RefreshCw, CheckCircle, AlertCircle, Clock, Zap, ImageIcon } from 'lucide-react'
import { useVariantSync, VariantComparison } from '@/hooks/useVariantSync'
import { useFullShopifySync } from '@/hooks/useFullShopifySync'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export const VariantSyncManager = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set())
  const [syncingImages, setSyncingImages] = useState(false)
  const [imageSyncSummary, setImageSyncSummary] = useState<{
    shopify_products: number
    sku_image_mappings: number
    products_fixed: number
    line_items_fixed: number
  } | null>(null)
  
  const {
    loading,
    syncing,
    comparisons,
    summary,
    syncResults,
    detectNewVariants,
    syncVariants,
    getNewVariants
  } = useVariantSync()

  const { syncing: fullSyncing, summary: fullSyncSummary, syncAll } = useFullShopifySync()

  const handleDetectVariants = async () => {
    await detectNewVariants(searchTerm)
    setSelectedVariants(new Set())
  }

  const handleSyncSelected = async () => {
    const newVariants = getNewVariants()
    const variantsToSync = newVariants.filter(variant => 
      selectedVariants.has(variant.shopify_variant_id)
    )
    
    if (variantsToSync.length === 0) {
      return
    }

    // Convert to format expected by sync function
    const formattedVariants = variantsToSync.map(variant => ({
      id: variant.shopify_variant_id,
      sku: variant.has_sku ? variant.shopify_sku : null,
      title: variant.variant_title,
      product_title: variant.product_title,
      price: variant.shopify_price.toString(),
      inventory_quantity: variant.shopify_stock,
      // Extract size and color from variant title
      option1: extractSizeFromTitle(variant.variant_title),
      option2: extractColorFromTitle(variant.variant_title),
      option3: null
    }))

    await syncVariants(formattedVariants)
    setSelectedVariants(new Set())
  }

  const handleSelectVariant = (variantId: string, checked: boolean) => {
    const newSelection = new Set(selectedVariants)
    if (checked) {
      newSelection.add(variantId)
    } else {
      newSelection.delete(variantId)
    }
    setSelectedVariants(newSelection)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newVariants = getNewVariants()
      setSelectedVariants(new Set(newVariants.map(v => v.shopify_variant_id)))
    } else {
      setSelectedVariants(new Set())
    }
  }

  const handleSyncImages = async () => {
    setSyncingImages(true)
    setImageSyncSummary(null)
    try {
      const { data, error } = await supabase.functions.invoke('sync-shopify-images', {
        body: {}
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setImageSyncSummary(data.summary)
      toast.success(`Fotos sincronizadas: ${data.summary.products_fixed} productos + ${data.summary.line_items_fixed} line items`)
    } catch (err: any) {
      console.error('Error syncing images:', err)
      toast.error('Error al sincronizar fotos: ' + err.message)
    } finally {
      setSyncingImages(false)
    }
  }

  const newVariants = getNewVariants()
  const allNewSelected = newVariants.length > 0 && newVariants.every(v => selectedVariants.has(v.shopify_variant_id))

  return (
    <div className="space-y-6">
      {/* Image Sync Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-blue-600" />
            Sincronizar Fotos desde Shopify
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Busca productos y line items sin foto en Sewdle y las jala directamente de Shopify. No modifica nada mas, solo fotos.
          </p>
          <Button
            onClick={handleSyncImages}
            disabled={syncingImages}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ImageIcon className="h-4 w-4" />
            {syncingImages ? 'Sincronizando fotos...' : 'Sincronizar Solo Fotos'}
          </Button>

          {imageSyncSummary && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-600">{imageSyncSummary.shopify_products}</div>
                <div className="text-xs text-muted-foreground">Productos Shopify</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-600">{imageSyncSummary.sku_image_mappings}</div>
                <div className="text-xs text-muted-foreground">SKUs con Foto</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-600">{imageSyncSummary.products_fixed}</div>
                <div className="text-xs text-muted-foreground">Productos Arreglados</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-600">{imageSyncSummary.line_items_fixed}</div>
                <div className="text-xs text-muted-foreground">Line Items Arreglados</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Sync Card */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600" />
            Sincronización Completa Automática
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Sincroniza TODOS los productos y variantes de Shopify a Sewdle en un solo clic.
            Crea productos faltantes, crea variantes nuevas y actualiza stock/precios.
          </p>
          <Button
            onClick={() => syncAll()}
            disabled={fullSyncing}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Zap className="h-4 w-4" />
            {fullSyncing ? 'Sincronizando todo...' : 'Sincronizar Todo desde Shopify'}
          </Button>

          {fullSyncSummary && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-600">{fullSyncSummary.shopify_products}</div>
                <div className="text-xs text-muted-foreground">Productos Shopify</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-600">{fullSyncSummary.products_created}</div>
                <div className="text-xs text-muted-foreground">Productos Creados</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-orange-600">{fullSyncSummary.variants_created}</div>
                <div className="text-xs text-muted-foreground">Variantes Creadas</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-purple-600">{fullSyncSummary.variants_updated}</div>
                <div className="text-xs text-muted-foreground">Variantes Actualizadas</div>
              </div>
              {fullSyncSummary.errors > 0 && (
                <div className="col-span-full">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {fullSyncSummary.errors} errores durante la sincronización.
                      {fullSyncSummary.error_details.slice(0, 3).map((e, i) => (
                        <div key={i} className="text-xs mt-1">• {e}</div>
                      ))}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Detection Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Detección Manual de Variantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Buscar productos (opcional)
              </label>
              <Input
                placeholder="Ej: Walker, Star, TOG 2.5..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleDetectVariants}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              {loading ? 'Detectando...' : 'Detectar Variantes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{summary.total_shopify_variants}</div>
                <div className="text-sm text-muted-foreground">Total en Shopify</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{summary.existing_in_sewdle}</div>
                <div className="text-sm text-muted-foreground">Ya en Sewdle</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{summary.new_variants_count}</div>
                <div className="text-sm text-muted-foreground">Variantes Nuevas</div>
              </div>
              <div className="text-center">
                <Badge variant={summary.sync_needed ? 'destructive' : 'secondary'}>
                  {summary.sync_needed ? 'Sincronización Requerida' : 'Sincronizado'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Results */}
      {syncResults && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Sincronización completada: {syncResults.success} exitosas, {syncResults.errors} errores, {syncResults.skipped} omitidas
          </AlertDescription>
        </Alert>
      )}

      {/* Variants List */}
      {comparisons.length > 0 && (
        <Tabs defaultValue="new" className="w-full">
          <TabsList>
            <TabsTrigger value="new">
              Variantes Nuevas ({newVariants.length})
            </TabsTrigger>
            <TabsTrigger value="all">
              Todas las Variantes ({comparisons.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            {newVariants.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allNewSelected}
                      onCheckedChange={handleSelectAll}
                      disabled={syncing}
                    />
                    <span className="text-sm font-medium">
                      Seleccionar todas ({selectedVariants.size} de {newVariants.length})
                    </span>
                  </div>
                  <Button
                    onClick={handleSyncSelected}
                    disabled={selectedVariants.size === 0 || syncing}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {syncing ? 'Sincronizando...' : `Sincronizar (${selectedVariants.size})`}
                  </Button>
                </div>

                <div className="grid gap-4">
                  {newVariants.map((variant) => (
                    <VariantCard
                      key={variant.shopify_variant_id}
                      variant={variant}
                      selected={selectedVariants.has(variant.shopify_variant_id)}
                      onSelect={(checked) => handleSelectVariant(variant.shopify_variant_id, checked)}
                      disabled={syncing}
                    />
                  ))}
                </div>
              </>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  No se encontraron variantes nuevas. Todas las variantes de Shopify ya están sincronizadas.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <div className="grid gap-4">
              {comparisons.map((variant) => (
                <VariantCard
                  key={variant.shopify_variant_id}
                  variant={variant}
                  showSyncStatus
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

interface VariantCardProps {
  variant: VariantComparison
  selected?: boolean
  onSelect?: (checked: boolean) => void
  disabled?: boolean
  showSyncStatus?: boolean
}

const VariantCard: React.FC<VariantCardProps> = ({
  variant,
  selected = false,
  onSelect,
  disabled = false,
  showSyncStatus = false
}) => {
  return (
    <Card className={`${!variant.exists_in_sewdle ? 'border-orange-200 bg-orange-50' : ''}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {onSelect && (
                <Checkbox
                  checked={selected}
                  onCheckedChange={onSelect}
                  disabled={disabled}
                />
              )}
              <div>
                <h4 className="font-medium">{variant.product_title}</h4>
                <p className="text-sm text-muted-foreground">{variant.variant_title}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">SKU:</span> 
                {variant.has_sku ? (
                  <span className="ml-1">{variant.shopify_sku}</span>
                ) : (
                  <Badge variant="outline" className="ml-1 text-xs">
                    NO SKU - ID: {variant.shopify_variant_id}
                  </Badge>
                )}
              </div>
              <div>
                <span className="font-medium">Precio:</span> ${variant.shopify_price}
              </div>
              <div>
                <span className="font-medium">Stock:</span> {variant.shopify_stock}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {showSyncStatus && (
              <Badge variant={variant.exists_in_sewdle ? 'secondary' : 'destructive'}>
                {variant.exists_in_sewdle ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> Sincronizado</>
                ) : (
                  <><Clock className="h-3 w-3 mr-1" /> Pendiente</>
                )}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Helper functions to extract size and color from variant title
const extractSizeFromTitle = (title: string): string | null => {
  const sizePatterns = [
    /\b(XS|S|M|L|XL|XXL|XXXL)\b/i,
    /\b(\d{1,2})\b/,
    /\b(Newborn|NB|0-3|3-6|6-9|9-12|12-18|18-24)\b/i,
    /\b(\d+\s*a\s*\d+\s*(meses?|años?))\b/i
  ]
  
  for (const pattern of sizePatterns) {
    const match = title.match(pattern)
    if (match) return match[1]
  }
  return null
}

const extractColorFromTitle = (title: string): string | null => {
  const colorPatterns = [
    /\b(rojo|azul|verde|amarillo|negro|blanco|gris|rosa|morado|naranja|café|marrón|beige|crema)\b/i,
    /\b(red|blue|green|yellow|black|white|gray|grey|pink|purple|orange|brown|beige|cream)\b/i,
    /\b(leopardo|estrella|star|dino|rex)\b/i
  ]
  
  for (const pattern of colorPatterns) {
    const match = title.match(pattern)
    if (match) return match[1]
  }
  return null
}