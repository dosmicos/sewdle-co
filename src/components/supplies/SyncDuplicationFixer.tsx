import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Search, Trash2, CheckCircle, Copy } from 'lucide-react';
import { useSyncDuplicationFixer } from '@/hooks/useSyncDuplicationFixer';

const SyncDuplicationFixer = () => {
  const [targetDate, setTargetDate] = useState('2025-07-27');
  const [specificSku, setSpecificSku] = useState('');
  const { investigate, cleanDuplications, validateCleanup, clearInvestigation, investigation, loading } = useSyncDuplicationFixer();

  const handleInvestigate = async () => {
    await investigate(targetDate);
  };

  const handleClean = async () => {
    await cleanDuplications(targetDate, specificSku || undefined);
  };

  const handleValidate = async () => {
    await validateCleanup(targetDate);
  };

  const getBadgeVariant = (count: number) => {
    if (count >= 3) return 'destructive';
    if (count >= 2) return 'secondary';
    return 'default';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Corrector de Duplicaciones de Sincronización
          </CardTitle>
          <CardDescription>
            Detecta y corrige duplicaciones en las métricas de ventas que causan discrepancias con Shopify
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-date">Fecha objetivo</Label>
              <Input
                id="target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specific-sku">SKU específico (opcional)</Label>
              <Input
                id="specific-sku"
                type="text"
                placeholder="Ej: 46347965268203"
                value={specificSku}
                onChange={(e) => setSpecificSku(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleInvestigate}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Investigar Duplicaciones
            </Button>
            
            {investigation?.duplications.length > 0 && (
              <Button
                onClick={handleClean}
                disabled={loading}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Limpiar Duplicaciones
              </Button>
            )}
            
            <Button
              onClick={handleValidate}
              disabled={loading}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Validar Limpieza
            </Button>

            {investigation && (
              <Button
                onClick={clearInvestigation}
                variant="ghost"
                size="sm"
              >
                Limpiar Resultados
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {investigation && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados de Investigación - {investigation.date}</CardTitle>
            <CardDescription>
              Total de métricas: {investigation.total_metrics} | 
              Duplicaciones encontradas: {investigation.duplications.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {investigation.investigation_summary && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Resumen:</strong> {investigation.investigation_summary.total_duplicated_variants} variantes afectadas, 
                  {' '}{investigation.investigation_summary.total_duplicate_entries} entradas duplicadas, 
                  {' '}{investigation.investigation_summary.affected_sales} ventas afectadas
                </AlertDescription>
              </Alert>
            )}

            {investigation.duplications.length === 0 ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ✅ No se encontraron duplicaciones en la fecha seleccionada
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                <h4 className="font-semibold">Duplicaciones Detectadas:</h4>
                {investigation.duplications.map((dup, index) => (
                  <Card key={dup.variant_id} className="border-l-4 border-l-red-500">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium">{dup.product_name}</span>
                          <Badge variant={getBadgeVariant(dup.duplicate_count)} className="ml-2">
                            {dup.duplicate_count} duplicados
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigator.clipboard.writeText(dup.sku_variant)}
                          className="flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          {dup.sku_variant}
                        </Button>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mb-2">
                        Total ventas: {dup.total_sales} | Total órdenes: {dup.total_orders}
                      </div>

                      <Separator className="my-2" />

                      <div className="space-y-1">
                        <span className="text-xs font-medium">Entradas duplicadas:</span>
                        {dup.entries.map((entry, entryIndex) => (
                          <div key={entry.id} className="text-xs bg-muted p-2 rounded flex justify-between">
                            <span>Ventas: {entry.sales_quantity} | Órdenes: {entry.orders_count}</span>
                            <span>{new Date(entry.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SyncDuplicationFixer;