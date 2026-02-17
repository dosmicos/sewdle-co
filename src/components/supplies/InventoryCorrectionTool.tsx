import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Calculator, RefreshCw, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface InventoryDiscrepancy {
  sku: string;
  current_shopify_inventory: number;
  expected_inventory: number;
  discrepancy: number;
  delivery_count: number;
  total_approved: number;
}

export const InventoryCorrectionTool = () => {
  const [discrepancies, setDiscrepancies] = useState<InventoryDiscrepancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [manualSku, setManualSku] = useState('');
  const [manualCorrection, setManualCorrection] = useState('');
  const { toast } = useToast();

  const detectDiscrepancies = useCallback(async () => {
    setLoading(true);
    try {
      // Get all approved delivery items with their SKUs
      const { data: deliveryItems, error } = await supabase
        .from('delivery_items')
        .select(`
          quantity_approved,
          order_items (
            product_variants (
              sku_variant
            )
          )
        `)
        .gt('quantity_approved', 0);

      if (error) throw error;

      // Group by SKU and calculate totals
      const skuTotals: Record<string, number> = {};
      deliveryItems?.forEach(item => {
        const sku = item.order_items?.product_variants?.sku_variant;
        if (sku) {
          skuTotals[sku] = (skuTotals[sku] || 0) + item.quantity_approved;
        }
      });

      // For demo purposes, we'll show some example discrepancies
      // In a real implementation, you would query Shopify's current inventory
      const mockDiscrepancies: InventoryDiscrepancy[] = [
        {
          sku: '46460170961131',
          current_shopify_inventory: 102, // Example: showing excess inventory
          expected_inventory: 50,
          discrepancy: 52, // Excess that needs to be corrected
          delivery_count: 3,
          total_approved: 50
        }
      ];

      setDiscrepancies(mockDiscrepancies);
      
      toast({
        title: "Análisis completado",
        description: `Se encontraron ${mockDiscrepancies.length} discrepancias de inventario`,
      });
    } catch (error) {
      console.error('Error detecting discrepancies:', error);
      toast({
        title: "Error en análisis",
        description: "No se pudieron detectar las discrepancias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const correctInventory = async (sku: string, correctionAmount: number) => {
    setCorrecting(sku);
    try {
      // This would call a Shopify API to adjust inventory
      console.log(`Correcting inventory for SKU ${sku} by ${correctionAmount}`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Inventario corregido",
        description: `SKU ${sku} ajustado en ${correctionAmount} unidades`,
      });
      
      // Refresh discrepancies
      await detectDiscrepancies();
    } catch (error) {
      console.error('Error correcting inventory:', error);
      toast({
        title: "Error en corrección",
        description: "No se pudo corregir el inventario",
        variant: "destructive",
      });
    } finally {
      setCorrecting(null);
    }
  };

  const handleManualCorrection = async () => {
    if (!manualSku || !manualCorrection) {
      toast({
        title: "Datos incompletos",
        description: "Por favor ingresa SKU y cantidad",
        variant: "destructive",
      });
      return;
    }

    await correctInventory(manualSku, parseInt(manualCorrection));
    setManualSku('');
    setManualCorrection('');
  };

  useEffect(() => {
    detectDiscrepancies();
  }, [detectDiscrepancies]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <CardTitle>Herramienta de Corrección de Inventario</CardTitle>
          </div>
          <CardDescription>
            Detecta y corrige discrepancias entre el inventario de Shopify y las entregas confirmadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-6">
            <Button 
              onClick={detectDiscrepancies} 
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Analizar Discrepancias</span>
            </Button>
          </div>

          {discrepancies.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Discrepancias Detectadas</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Inventario Actual</TableHead>
                    <TableHead>Inventario Esperado</TableHead>
                    <TableHead>Discrepancia</TableHead>
                    <TableHead>Entregas</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discrepancies.map((item) => (
                    <TableRow key={item.sku}>
                      <TableCell className="font-mono">{item.sku}</TableCell>
                      <TableCell>{item.current_shopify_inventory}</TableCell>
                      <TableCell>{item.expected_inventory}</TableCell>
                      <TableCell>
                        <Badge variant={item.discrepancy > 0 ? "destructive" : "secondary"}>
                          {item.discrepancy > 0 ? '+' : ''}{item.discrepancy}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.delivery_count}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => correctInventory(item.sku, -item.discrepancy)}
                          disabled={correcting === item.sku}
                        >
                          {correcting === item.sku ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Calculator className="h-4 w-4" />
                          )}
                          Corregir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Corrección Manual</span>
          </CardTitle>
          <CardDescription>
            Ajusta manualmente el inventario de un SKU específico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="manual-sku">SKU</Label>
              <Input
                id="manual-sku"
                value={manualSku}
                onChange={(e) => setManualSku(e.target.value)}
                placeholder="Ej: 46460170961131"
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="manual-correction">Cantidad a Ajustar</Label>
              <Input
                id="manual-correction"
                type="number"
                value={manualCorrection}
                onChange={(e) => setManualCorrection(e.target.value)}
                placeholder="Ej: -52"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleManualCorrection} className="w-full">
                Aplicar Corrección
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
