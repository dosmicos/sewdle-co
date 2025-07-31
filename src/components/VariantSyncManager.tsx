import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { useVariantSync, VariantComparison } from '@/hooks/useVariantSync'

export const VariantSyncManager = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set())
  
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

  const handleDetectVariants = async () => {
    await detectNewVariants(searchTerm)
    setSelectedVariants(new Set())
  }

  const handleSyncSelected = async () => {
    const newVariants = getNewVariants()
    const variantsToSync = newVariants.filter(variant => 
      selectedVariants.has(variant.shopify_sku)
    )
    
    if (variantsToSync.length === 0) {
      return
    }

    // Convert to format expected by sync function
    const formattedVariants = variantsToSync.map(variant => ({
      sku: variant.shopify_sku,
      title: variant.variant_title,
      price: variant.shopify_price.toString(),
      inventory_quantity: variant.shopify_stock
    }))

    await syncVariants(formattedVariants)
    setSelectedVariants(new Set())
  }

  const handleSelectVariant = (sku: string, checked: boolean) => {
    const newSelection = new Set(selectedVariants)
    if (checked) {
      newSelection.add(sku)
    } else {
      newSelection.delete(sku)
    }
    setSelectedVariants(newSelection)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newVariants = getNewVariants()
      setSelectedVariants(new Set(newVariants.map(v => v.shopify_sku)))
    } else {
      setSelectedVariants(new Set())
    }
  }

  const newVariants = getNewVariants()
  const allNewSelected = newVariants.length > 0 && newVariants.every(v => selectedVariants.has(v.shopify_sku))

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sincronización de Variantes de Shopify
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
                      key={variant.shopify_sku}
                      variant={variant}
                      selected={selectedVariants.has(variant.shopify_sku)}
                      onSelect={(checked) => handleSelectVariant(variant.shopify_sku, checked)}
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
                  key={variant.shopify_sku}
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
                <span className="font-medium">SKU:</span> {variant.shopify_sku}
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