import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Loader2 } from 'lucide-react';
import { useShopifySkuAssignment } from '@/hooks/useShopifySkuAssignment';

export const ShopifySkuAssignment = () => {
  const [result, setResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { assignShopifySkus, loading } = useShopifySkuAssignment();

  const handleAssignment = async () => {
    setIsProcessing(true);
    try {
      const assignmentResult = await assignShopifySkus();
      setResult(assignmentResult);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Asignación Completa de SKUs Shopify
        </CardTitle>
        <CardDescription>
          Procesa TODAS las variantes de una sola vez, detectando y corrigiendo automáticamente SKUs artificiales 
          generados por Shopify, asignando el ID de variante como SKU definitivo.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">¿Qué hace este proceso?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Detecta SKUs artificiales como "SHOPIFY-", "ID-", o códigos numéricos largos</li>
            <li>• Reemplaza automáticamente estos SKUs con el ID único de la variante</li>
            <li>• Procesa TODAS las variantes de tu tienda en una sola ejecución</li>
            <li>• Incluye reintentos inteligentes y manejo de límites de Shopify</li>
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
              Procesando todas las variantes...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Procesar Todas las Variantes
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