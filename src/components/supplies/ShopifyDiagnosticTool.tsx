
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Search, FileText, Package } from 'lucide-react';
import { useShopifyDiagnosis } from '@/hooks/useShopifyDiagnosis';

const ShopifyDiagnosticTool = () => {
  const { runDiagnosis, diagnosisResult, loading } = useShopifyDiagnosis();

  const handleRunDiagnosis = async () => {
    await runDiagnosis();
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
