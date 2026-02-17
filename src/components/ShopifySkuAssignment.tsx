import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Loader2, Info } from 'lucide-react';
import { useShopifySkuAssignment } from '@/hooks/useShopifySkuAssignment';

export const ShopifySkuAssignment = () => {
  const [result, setResult] = useState<unknown>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'empty-only' | 'artificial'>('empty-only');
  
  const { assignShopifySkus, loading } = useShopifySkuAssignment();

  const handleAssignment = async () => {
    setIsProcessing(true);
    try {
      const assignmentResult = await assignShopifySkus(selectedMode);
      setResult(assignmentResult);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-500" />
          Asignación Inteligente de SKUs
        </CardTitle>
        <CardDescription>
          Sistema inteligente para asignar SKUs a variantes de Shopify con diferentes niveles de intervención
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium">Modo de Asignación</label>
          <Select value={selectedMode} onValueChange={(value: 'empty-only' | 'artificial') => setSelectedMode(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="empty-only">
                <div>
                  <div className="font-medium">Solo SKUs Vacíos (Recomendado)</div>
                  <div className="text-xs text-muted-foreground">Asigna SKUs únicamente a variantes sin SKU</div>
                </div>
              </SelectItem>
              <SelectItem value="artificial">
                <div>
                  <div className="font-medium">SKUs Artificiales</div>
                  <div className="text-xs text-muted-foreground">Incluye SKUs con prefijos SHOPIFY- e ID-</div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">
            {selectedMode === 'empty-only' ? 'Modo Seguro - Solo SKUs Vacíos' : 'Modo Completo - SKUs Artificiales'}
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            {selectedMode === 'empty-only' ? (
              <>
                <li>• Revisa todas las variantes de productos en Shopify</li>
                <li>• Asigna SKUs únicamente a variantes completamente vacías</li>
                <li>• Conserva todos los SKUs numéricos existentes (seguros)</li>
                <li>• Usa el ID de la variante como nuevo SKU</li>
              </>
            ) : (
              <>
                <li>• Revisa todas las variantes de productos en Shopify</li>
                <li>• Detecta SKUs vacíos y con prefijos artificiales (SHOPIFY-, ID-)</li>
                <li>• Conserva SKUs numéricos normales del sistema anterior</li>
                <li>• Asigna el ID de la variante como nuevo SKU</li>
              </>
            )}
          </ul>
        </div>

        <Button 
          onClick={handleAssignment}
          disabled={loading || isProcessing}
          className="w-full"
          size="lg"
        >
          {(loading || isProcessing) ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Procesando en modo {selectedMode === 'empty-only' ? 'seguro' : 'completo'}...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Iniciar Asignación ({selectedMode === 'empty-only' ? 'Modo Seguro' : 'Modo Completo'})
            </>
          )}
        </Button>

        {/* Result Display */}
        {result && (
          <div className="bg-gray-50 border rounded-lg p-4">
            <h3 className="font-medium mb-2">Resultado del Proceso</h3>
            <p className="text-sm text-gray-600">{result.message}</p>
            {result.summary && (
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div>Variantes procesadas: <span className="font-medium">{result.summary.processedVariants}</span></div>
                <div>SKUs actualizados: <span className="font-medium text-green-600">{result.summary.updatedVariants}</span></div>
                <div>Errores: <span className="font-medium text-red-600">{result.summary.errorVariants}</span></div>
                <div>Productos revisados: <span className="font-medium">{result.summary.productsScanned}</span></div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShopifySkuAssignment;