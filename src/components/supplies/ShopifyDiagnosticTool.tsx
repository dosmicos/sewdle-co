
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useShopifyDiagnosis } from '@/hooks/useShopifyDiagnosis';
import { Search, AlertTriangle, CheckCircle, TrendingUp, Package, Calendar } from 'lucide-react';

const ShopifyDiagnosticTool = () => {
  const [targetDate, setTargetDate] = useState('2025-07-23');
  const { runDiagnosis, clearDiagnosis, diagnostic, summary, loading } = useShopifyDiagnosis();

  const handleDiagnosis = async () => {
    await runDiagnosis(targetDate);
  };

  const getDifferenceColor = (difference: number) => {
    if (difference === 0) return 'text-green-600';
    if (Math.abs(difference) <= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAccuracyColor = (percentage: number) => {
    if (percentage >= 95) return 'text-green-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Diagnóstico de Sincronización Shopify
          </CardTitle>
          <CardDescription>
            Herramienta para diagnosticar y comparar datos de ventas entre Shopify y el sistema local
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 mb-4">
            <div className="flex-1">
              <Label htmlFor="target-date">Fecha a diagnosticar</Label>
              <Input
                id="target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button 
              onClick={handleDiagnosis}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Diagnosticando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Ejecutar Diagnóstico
                </>
              )}
            </Button>
            {(diagnostic || summary) && (
              <Button 
                variant="outline"
                onClick={clearDiagnosis}
              >
                Limpiar
              </Button>
            )}
          </div>

          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Shopify</p>
                      <p className="text-2xl font-bold">{summary.shopify_units}</p>
                      <p className="text-xs text-muted-foreground">unidades</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Sistema Local</p>
                      <p className="text-2xl font-bold">{summary.local_units}</p>
                      <p className="text-xs text-muted-foreground">unidades</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    {summary.difference === 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Diferencia</p>
                      <p className={`text-2xl font-bold ${getDifferenceColor(summary.difference)}`}>
                        {summary.difference > 0 ? '+' : ''}{summary.difference}
                      </p>
                      <p className="text-xs text-muted-foreground">unidades</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Precisión</p>
                      <p className={`text-2xl font-bold ${getAccuracyColor(summary.accuracy_percentage)}`}>
                        {summary.accuracy_percentage}%
                      </p>
                      <p className="text-xs text-muted-foreground">exactitud</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {summary && summary.difference !== 0 && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Discrepancia detectada:</strong> Hay una diferencia de {summary.difference} unidades 
                entre Shopify y el sistema local para {summary.date}. 
                {summary.difference > 0 ? 
                  ' El sistema local tiene más unidades registradas (posible duplicación).' : 
                  ' El sistema local tiene menos unidades registradas (posible pérdida de datos).'
                }
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {diagnostic && (
        <Card>
          <CardHeader>
            <CardTitle>Detalles del Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary">Resumen</TabsTrigger>
                <TabsTrigger value="shopify">Datos Shopify</TabsTrigger>
                <TabsTrigger value="local">Datos Locales</TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Shopify</h4>
                    <p>Órdenes: {diagnostic.shopify_data.orders_count}</p>
                    <p>Unidades: {diagnostic.shopify_data.total_units}</p>
                    <p>Productos únicos: {diagnostic.shopify_data.unique_products}</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Sistema Local</h4>
                    <p>Métricas: {diagnostic.local_data.metrics_count}</p>
                    <p>Unidades: {diagnostic.local_data.total_units}</p>
                    <p>Variantes únicas: {diagnostic.local_data.unique_variants}</p>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Discrepancias</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Diferencia de unidades:</span>
                      <Badge variant={diagnostic.discrepancies.unit_difference === 0 ? 'default' : 'destructive'}>
                        {diagnostic.discrepancies.unit_difference > 0 ? '+' : ''}
                        {diagnostic.discrepancies.unit_difference}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Órdenes faltantes:</span>
                      <Badge variant={diagnostic.discrepancies.missing_orders === 0 ? 'default' : 'destructive'}>
                        {diagnostic.discrepancies.missing_orders}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Entradas duplicadas:</span>
                      <Badge variant={diagnostic.discrepancies.duplicate_entries === 0 ? 'default' : 'destructive'}>
                        {diagnostic.discrepancies.duplicate_entries}
                      </Badge>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="shopify" className="space-y-4">
                <div className="max-h-96 overflow-y-auto">
                  <h4 className="font-medium mb-2">Órdenes de Shopify ({diagnostic.shopify_data.orders_count})</h4>
                  <div className="space-y-2">
                    {diagnostic.shopify_data.orders.map((order, index) => (
                      <div key={order.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">Orden #{order.id}</span>
                          <Badge variant="outline">{order.financial_status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Fecha: {new Date(order.created_at).toLocaleDateString()}</p>
                          <p>Items: {order.line_items.length}</p>
                          <p>Total unidades: {order.line_items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="local" className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Métricas Locales</h4>
                  <p>Fecha: {diagnostic.local_data.date_range}</p>
                  <p>Total métricas: {diagnostic.local_data.metrics_count}</p>
                  <p>Total unidades: {diagnostic.local_data.total_units}</p>
                  <p>Variantes únicas: {diagnostic.local_data.unique_variants}</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShopifyDiagnosticTool;
