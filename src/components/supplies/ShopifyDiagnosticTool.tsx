import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Search, FileText, Package, Settings } from 'lucide-react';
import { useShopifyDiagnosis } from '@/hooks/useShopifyDiagnosis';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { XCircle } from 'lucide-react';

const ShopifyDiagnosticTool = () => {
  const { 
    runDiagnosis, 
    getSyncLogDetails, 
    testShopifyConnection,
    runInventoryDiagnosis,
    diagnosisResult, 
    loading 
  } = useShopifyDiagnosis();
  
  const { toast } = useToast();

  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState('');

  const handleRunDiagnosis = async () => {
    await runDiagnosis();
  };

  const handleViewSyncLogs = async (deliveryId: string) => {
    if (!deliveryId.trim()) {
      toast({
        title: "ID requerido",
        description: "Por favor ingresa un ID de entrega válido",
        variant: "destructive",
      });
      return;
    }

    try {
      const logs = await getSyncLogDetails(deliveryId);
      setSyncLogs(logs);
      
      if (logs.length === 0) {
        toast({
          title: "Sin logs",
          description: "No se encontraron logs de sincronización para esta entrega",
        });
      }
    } catch (error) {
      console.error('Error viewing sync logs:', error);
    }
  };

  const handleTestConnection = async () => {
    try {
      await testShopifyConnection();
    } catch (error) {
      console.error('Error testing connection:', error);
    }
  };

  const handleInventoryDiagnosis = async () => {
    try {
      await runInventoryDiagnosis();
    } catch (error) {
      console.error('Error running inventory diagnosis:', error);
    }
  };

  const renderMatchStatus = (matched: boolean) => {
    return matched ? (
      <Badge className="bg-green-100 text-green-700">
        <CheckCircle className="w-3 h-3 mr-1" />
        Encontrado
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-700">
        <AlertTriangle className="w-3 h-3 mr-1" />
        No encontrado
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Herramienta de Diagnóstico Shopify</h2>
        <div className="flex gap-2">
          <Button onClick={handleInventoryDiagnosis} disabled={loading} variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Test Inventario
          </Button>
          <Button onClick={handleTestConnection} disabled={loading} variant="outline">
            <Package className="w-4 h-4 mr-2" />
            Test Conexión
          </Button>
          <Button onClick={runDiagnosis} disabled={loading}>
            <Search className="w-4 h-4 mr-2" />
            {loading ? 'Ejecutando...' : 'Ejecutar Diagnóstico'}
          </Button>
        </div>
      </div>

      {/* Información importante sobre las mejoras */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Mejoras Implementadas</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Ahora usando la API correcta de Inventory Levels de Shopify</li>
                <li>• Detección automática de Location ID principal</li>
                <li>• Validación de configuración de inventory_management</li>
                <li>• Verificación post-actualización con delay</li>
                <li>• Método de respaldo (SET) si falla ADJUST</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Logs Viewer */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Ver Logs de Sincronización</h3>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="ID de entrega (ej: 1b7ceadf-4cd4-4d54-a4a4-ea5b8ac26eb5)"
            value={selectedDeliveryId}
            onChange={(e) => setSelectedDeliveryId(e.target.value)}
            className="flex-1"
          />
          <Button 
            onClick={() => handleViewSyncLogs(selectedDeliveryId)}
            disabled={loading}
          >
            <Search className="w-4 h-4 mr-2" />
            Ver Logs
          </Button>
        </div>

        {syncLogs.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Logs de Sincronización</h4>
            {syncLogs.map((log, index) => (
              <Card key={index} className="p-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium">Fecha</p>
                    <p className="text-sm text-gray-600">
                      {new Date(log.synced_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Resultado</p>
                    <p className="text-sm">
                      <span className="text-green-600">{log.success_count} exitosos</span>
                      {log.error_count > 0 && (
                        <span className="text-red-600 ml-2">{log.error_count} errores</span>
                      )}
                    </p>
                  </div>
                </div>

                {log.sync_results && log.sync_results.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Detalles por SKU:</p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Cantidad Anterior</TableHead>
                            <TableHead>Cantidad Agregada</TableHead>
                            <TableHead>Cantidad Final</TableHead>
                            <TableHead>Verificado</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {log.sync_results.map((result: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">
                                {result.sku}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  result.status === 'success' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {result.status === 'success' ? (
                                    <>
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Éxito
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Error
                                    </>
                                  )}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {result.method || 'variants_api'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {result.previousQuantity !== undefined ? result.previousQuantity : '-'}
                              </TableCell>
                              <TableCell>
                                {result.addedQuantity !== undefined ? result.addedQuantity : result.quantityAttempted || '-'}
                              </TableCell>
                              <TableCell>
                                {result.newQuantity !== undefined ? result.newQuantity : '-'}
                              </TableCell>
                              <TableCell>
                                {result.verifiedQuantity !== undefined ? (
                                  result.verifiedQuantity === result.newQuantity ? (
                                    <span className="text-green-600 text-xs">✓ Verificado</span>
                                  ) : (
                                    <span className="text-red-600 text-xs">✗ No coincide</span>
                                  )
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-xs text-red-600">
                                {result.error || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="w-5 h-5" />
            <span>Diagnóstico de Sincronización Shopify</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-gray-600">
                Verificar compatibilidad entre productos locales y Shopify
              </p>
              <Button
                onClick={handleRunDiagnosis}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Search className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Analizando...' : 'Ejecutar Diagnóstico'}
              </Button>
            </div>

            {diagnosisResult && (
              <div className="mt-6">
                {/* Resumen */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {diagnosisResult.summary.totalLocalProducts}
                      </div>
                      <div className="text-sm text-gray-600">Productos Locales</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {diagnosisResult.summary.matchedSkus}
                      </div>
                      <div className="text-sm text-gray-600">SKUs Coinciden</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {diagnosisResult.summary.unmatchedSkus}
                      </div>
                      <div className="text-sm text-gray-600">SKUs Faltantes</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {diagnosisResult.summary.matchRate}%
                      </div>
                      <div className="text-sm text-gray-600">Tasa de Coincidencia</div>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="unmatched" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="unmatched">SKUs Faltantes</TabsTrigger>
                    <TabsTrigger value="matched">SKUs Encontrados</TabsTrigger>
                    <TabsTrigger value="empty">SKUs Vacíos</TabsTrigger>
                    <TabsTrigger value="suggestions">Sugerencias</TabsTrigger>
                  </TabsList>

                  <TabsContent value="unmatched" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">SKUs No Encontrados en Shopify</h3>
                      <Badge variant="outline" className="border-red-500 text-red-700">
                        {diagnosisResult.analysis.unmatchedSkus.length} faltantes
                      </Badge>
                    </div>
                    
                    {diagnosisResult.analysis.unmatchedSkus.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Todos los SKUs coinciden!</h3>
                        <p className="text-gray-600">No hay SKUs faltantes en Shopify</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU Local</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Variante</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {diagnosisResult.analysis.unmatchedSkus.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono">{item.localSku}</TableCell>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell>
                                <Badge variant={item.type === 'product' ? 'default' : 'secondary'}>
                                  {item.type === 'product' ? 'Producto' : 'Variante'}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.variantInfo || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  <TabsContent value="matched" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">SKUs Encontrados en Shopify</h3>
                      <Badge variant="outline" className="border-green-500 text-green-700">
                        {diagnosisResult.analysis.matchedSkus.length} encontrados
                      </Badge>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Producto Local</TableHead>
                          <TableHead>Producto Shopify</TableHead>
                          <TableHead>Inventario</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diagnosisResult.analysis.matchedSkus.slice(0, 20).map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono">{item.localSku}</TableCell>
                            <TableCell>
                              {item.productName}
                              {item.variantInfo && (
                                <div className="text-sm text-gray-500">{item.variantInfo}</div>
                              )}
                            </TableCell>
                            <TableCell>{item.shopifyData.productTitle}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.shopifyData.inventory || 0} unidades
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="empty" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Productos sin SKU</h3>
                      <Badge variant="outline" className="border-orange-500 text-orange-700">
                        {diagnosisResult.analysis.emptySkus.length} sin SKU
                      </Badge>
                    </div>
                    
                    {diagnosisResult.analysis.emptySkus.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Todos los productos tienen SKU</h3>
                        <p className="text-gray-600">No hay productos o variantes sin SKU</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead>Problema</TableHead>
                            <TableHead>Acción Requerida</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {diagnosisResult.analysis.emptySkus.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-orange-500 text-orange-700">
                                  {item.issue}
                                </Badge>
                              </TableCell>
                              <TableCell>Asignar SKU antes de sincronizar</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  <TabsContent value="suggestions" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Sugerencias de Mejora</h3>
                      <Badge variant="outline">
                        {diagnosisResult.patterns.suggestions.length} sugerencias
                      </Badge>
                    </div>
                    
                    <div className="space-y-4">
                      {diagnosisResult.patterns.suggestions.map((suggestion, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                              <FileText className="w-5 h-5 text-blue-500 mt-1" />
                              <div>
                                <h4 className="font-semibold text-gray-900">{suggestion.message}</h4>
                                <p className="text-sm text-gray-600 mt-1">{suggestion.action}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShopifyDiagnosticTool;
