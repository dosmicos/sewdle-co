
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useShopifySkuAssignment } from '@/hooks/useShopifySkuAssignment';

const ShopifySkuAssignment = () => {
  const { assignShopifySkus, loading } = useShopifySkuAssignment();
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
          <span>Asignación de SKUs en Shopify</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">
              ¿Productos sin SKUs en Shopify?
            </h4>
            <p className="text-sm text-blue-700 mb-3">
              Si tus productos en Shopify no tienen SKUs asignados, esta herramienta 
              usará el ID único de cada variante como su SKU.
            </p>
            <p className="text-sm text-blue-700">
              Esto permitirá una sincronización perfecta entre tu catálogo local y Shopify.
            </p>
          </div>
          
          <Button
            onClick={handleAssignment}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Settings className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Asignando SKUs...' : 'Asignar SKUs en Shopify'}
          </Button>

          {result && (
            <div className="mt-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  Resultado de la Asignación
                </h4>
                
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

                <p className="text-green-700 font-medium">
                  ✅ {result.message}
                </p>

                {result.summary.errorVariants > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-red-700 text-sm">
                      ⚠️ {result.summary.errorVariants} variantes tuvieron errores. 
                      Revisa los logs para más detalles.
                    </p>
                  </div>
                )}
              </div>

              {result.details && result.details.length > 0 && (
                <div className="max-h-60 overflow-y-auto">
                  <h5 className="font-medium mb-2">Detalles por variante:</h5>
                  <div className="space-y-2">
                    {result.details.slice(0, 10).map((detail: any, index: number) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-2 bg-white border rounded text-sm"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{detail.productTitle}</div>
                          <div className="text-gray-500">{detail.variantTitle}</div>
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
