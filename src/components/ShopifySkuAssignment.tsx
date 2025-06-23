
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, CheckCircle, AlertTriangle, XCircle, Clock, Info } from 'lucide-react';
import { useShopifySkuAssignment } from '@/hooks/useShopifySkuAssignment';

const ShopifySkuAssignment = () => {
  const { assignShopifySkus, loading, processing } = useShopifySkuAssignment();
  const [result, setResult] = useState<any>(null);

  const handleAssignment = async () => {
    const assignmentResult = await assignShopifySkus();
    if (assignmentResult) {
      setResult(assignmentResult);
    }
  };

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-blue-700">
          <Settings className="w-5 h-5" />
          <span>Asignación Optimizada de SKUs en Shopify</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2" />
              Nueva versión optimizada
            </h4>
            <div className="text-sm text-blue-700 space-y-2">
              <p>• <strong>Procesamiento por lotes:</strong> Maneja grandes volúmenes sin timeouts</p>
              <p>• <strong>Filtrado inteligente:</strong> Solo productos activos y en borrador</p>
              <p>• <strong>Omite duplicados:</strong> No reprocesa variantes con SKU existente</p>
              <p>• <strong>Ejecución en segundo plano:</strong> No bloquea la interfaz</p>
            </div>
          </div>

          {processing && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center space-x-2 text-yellow-800">
                <Clock className="w-5 h-5 animate-spin" />
                <span className="font-medium">Procesamiento en curso...</span>
              </div>
              <p className="text-sm text-yellow-700 mt-2">
                El proceso está ejecutándose en segundo plano. Puedes continuar usando la aplicación 
                mientras se procesan los SKUs. Revisa tu tienda Shopify para ver el progreso.
              </p>
            </div>
          )}
          
          <Button
            onClick={handleAssignment}
            disabled={loading || processing}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Settings className={`w-4 h-4 mr-2 ${(loading || processing) ? 'animate-spin' : ''}`} />
            {loading ? 'Iniciando proceso...' : 
             processing ? 'Procesando en segundo plano...' : 
             'Asignar SKUs Optimizado'}
          </Button>

          {result && (
            <div className="mt-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center">
                  {result.status === 'processing' ? (
                    <Clock className="w-5 h-5 text-blue-500 mr-2" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  )}
                  {result.status === 'processing' ? 'Proceso Iniciado' : 'Resultado de la Asignación'}
                </h4>
                
                {result.summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {result.summary.totalProducts}
                      </div>
                      <div className="text-sm text-gray-600">Productos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {result.summary.updatedVariants}
                      </div>
                      <div className="text-sm text-gray-600">SKUs Asignados</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {result.summary.skippedVariants}
                      </div>
                      <div className="text-sm text-gray-600">Ya tenían SKU</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {result.summary.errorVariants}
                      </div>
                      <div className="text-sm text-gray-600">Errores</div>
                    </div>
                  </div>
                )}

                <div className={`p-3 rounded border ${
                  result.status === 'processing' 
                    ? 'bg-blue-50 border-blue-200 text-blue-800' 
                    : 'bg-green-50 border-green-200 text-green-800'
                }`}>
                  <p className="font-medium">
                    {result.status === 'processing' ? '🚀' : '✅'} {result.message}
                  </p>
                  {result.note && (
                    <p className="text-sm mt-1 opacity-90">{result.note}</p>
                  )}
                </div>

                {result.summary && result.summary.errorVariants > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-red-700 text-sm">
                      ⚠️ {result.summary.errorVariants} variantes tuvieron errores. 
                      Revisa los logs de la función para más detalles.
                    </p>
                  </div>
                )}
              </div>

              {result.details && result.details.length > 0 && (
                <div className="max-h-60 overflow-y-auto">
                  <h5 className="font-medium mb-2">Últimas actualizaciones:</h5>
                  <div className="space-y-2">
                    {result.details.slice(0, 10).map((detail: any, index: number) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-2 bg-white border rounded text-sm"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{detail.productTitle}</div>
                          <div className="text-gray-500">
                            {detail.variantTitle} • Estado: {detail.productStatus}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {detail.status === 'success' ? (
                            <>
                              <Badge variant="outline" className="text-green-700 border-green-300">
                                SKU: {detail.skuAssigned}
                              </Badge>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </>
                          ) : (
                            <>
                              <Badge variant="outline" className="text-red-700 border-red-300">
                                Error
                              </Badge>
                              <XCircle className="w-4 h-4 text-red-500" />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {result.details.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">
                        ... y {result.details.length - 10} más
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ShopifySkuAssignment;
