import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface DuplicateItem {
  order_id: string;
  order_number: string;
  product_variant_id: string;
  sku_variant: string;
  product_name: string;
  variant_name: string;
  duplicate_count: number;
  total_quantity: number;
  item_ids: string[];
  item_quantities: number[];
  item_created_ats: string[];
}

export const OrderDuplicationFixer = () => {
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const { toast } = useToast();

  const detectDuplicates = async () => {
    setLoading(true);
    try {
      // Query to find orders with duplicate product_variant_id entries
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          product_variant_id,
          quantity,
          created_at,
          orders!inner (
            order_number
          ),
          product_variants!inner (
            sku_variant,
            size,
            color,
            products!inner (
              name
            )
          )
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by order_id + product_variant_id to find duplicates
      const grouped: Record<string, any[]> = {};
      
      data?.forEach((item: any) => {
        const key = `${item.order_id}_${item.product_variant_id}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(item);
      });

      // Filter to only duplicates (more than 1 item per key)
      const duplicatesList: DuplicateItem[] = [];
      
      Object.entries(grouped).forEach(([_, items]) => {
        if (items.length > 1) {
          const first = items[0];
          duplicatesList.push({
            order_id: first.order_id,
            order_number: first.orders?.order_number || 'N/A',
            product_variant_id: first.product_variant_id,
            sku_variant: first.product_variants?.sku_variant || 'N/A',
            product_name: first.product_variants?.products?.name || 'N/A',
            variant_name: `${first.product_variants?.size || ''} ${first.product_variants?.color || ''}`.trim(),
            duplicate_count: items.length,
            total_quantity: items.reduce((sum: number, i: any) => sum + i.quantity, 0),
            item_ids: items.map((i: any) => i.id),
            item_quantities: items.map((i: any) => i.quantity),
            item_created_ats: items.map((i: any) => i.created_at)
          });
        }
      });

      // Sort by order_number
      duplicatesList.sort((a, b) => a.order_number.localeCompare(b.order_number));

      setDuplicates(duplicatesList);

      if (duplicatesList.length === 0) {
        toast({
          title: "Sin duplicados",
          description: "No se encontraron items duplicados en las órdenes.",
        });
      } else {
        toast({
          title: "Duplicados detectados",
          description: `Se encontraron ${duplicatesList.length} grupos de items duplicados.`,
          variant: "default",
        });
      }

    } catch (error) {
      console.error('Error detecting duplicates:', error);
      toast({
        title: "Error",
        description: "No se pudieron detectar los duplicados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fixDuplicate = async (duplicate: DuplicateItem, action: 'keep_first' | 'consolidate') => {
    setFixing(`${duplicate.order_id}_${duplicate.product_variant_id}`);
    try {
      if (action === 'keep_first') {
        // Keep the first (oldest) item, delete the rest
        const idsToDelete = duplicate.item_ids.slice(1);
        
        for (const id of idsToDelete) {
          const { error } = await supabase
            .from('order_items')
            .delete()
            .eq('id', id);
          
          if (error) throw error;
        }

        toast({
          title: "Duplicado eliminado",
          description: `Se eliminaron ${idsToDelete.length} items duplicados de ${duplicate.order_number}. Cantidad final: ${duplicate.item_quantities[0]}.`,
        });
      } else {
        // Consolidate: update first item with total quantity, delete rest
        const totalQuantity = duplicate.total_quantity;
        const keepId = duplicate.item_ids[0];
        const idsToDelete = duplicate.item_ids.slice(1);

        // Get the unit_price from the first item to calculate new total
        const { data: firstItem, error: fetchError } = await supabase
          .from('order_items')
          .select('unit_price')
          .eq('id', keepId)
          .single();

        if (fetchError) throw fetchError;

        // Update the first item with consolidated quantity
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            quantity: totalQuantity,
            total_price: totalQuantity * (firstItem?.unit_price || 0)
          })
          .eq('id', keepId);

        if (updateError) throw updateError;

        // Delete the duplicate items
        for (const id of idsToDelete) {
          const { error } = await supabase
            .from('order_items')
            .delete()
            .eq('id', id);
          
          if (error) throw error;
        }

        toast({
          title: "Duplicados consolidados",
          description: `Se consolidaron ${duplicate.duplicate_count} items en ${duplicate.order_number}. Cantidad final: ${totalQuantity}.`,
        });
      }

      // Remove from list
      setDuplicates(prev => prev.filter(d => 
        !(d.order_id === duplicate.order_id && d.product_variant_id === duplicate.product_variant_id)
      ));

    } catch (error) {
      console.error('Error fixing duplicate:', error);
      toast({
        title: "Error",
        description: "No se pudo corregir el duplicado.",
        variant: "destructive",
      });
    } finally {
      setFixing(null);
    }
  };

  useEffect(() => {
    detectDuplicates();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Detector de Items Duplicados en Órdenes
            </CardTitle>
            <CardDescription>
              Detecta y corrige items con el mismo producto/variante que aparecen múltiples veces en una orden.
            </CardDescription>
          </div>
          <Button onClick={detectDuplicates} disabled={loading} variant="outline">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Escanear
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : duplicates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">¡Sin duplicados!</p>
            <p className="text-muted-foreground">Todas las órdenes tienen items únicos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">{duplicates.length} duplicados</Badge>
              <span className="text-sm text-muted-foreground">
                Afectando {new Set(duplicates.map(d => d.order_number)).size} órdenes
              </span>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">Duplicados</TableHead>
                  <TableHead className="text-center">Cantidades</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicates.map((dup) => {
                  const isFixing = fixing === `${dup.order_id}_${dup.product_variant_id}`;
                  return (
                    <TableRow key={`${dup.order_id}_${dup.product_variant_id}`}>
                      <TableCell className="font-medium">{dup.order_number}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{dup.product_name}</div>
                          <div className="text-sm text-muted-foreground">{dup.variant_name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{dup.sku_variant}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{dup.duplicate_count}x</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono">
                          {dup.item_quantities.join(' + ')} = {dup.total_quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                disabled={isFixing}
                              >
                                {isFixing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mantener primero"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Mantener solo el primer item?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminará(n) {dup.duplicate_count - 1} item(s) duplicado(s), 
                                  manteniendo solo el primero con cantidad {dup.item_quantities[0]}.
                                  <br /><br />
                                  <strong>Orden:</strong> {dup.order_number}<br />
                                  <strong>Producto:</strong> {dup.product_name} - {dup.variant_name}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => fixDuplicate(dup, 'keep_first')}>
                                  Eliminar duplicados
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="default"
                                disabled={isFixing}
                              >
                                {isFixing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Consolidar"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Consolidar items duplicados?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se sumarán las cantidades ({dup.item_quantities.join(' + ')} = {dup.total_quantity}) 
                                  en un solo item y se eliminarán los duplicados.
                                  <br /><br />
                                  <strong>Orden:</strong> {dup.order_number}<br />
                                  <strong>Producto:</strong> {dup.product_name} - {dup.variant_name}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => fixDuplicate(dup, 'consolidate')}>
                                  Consolidar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
