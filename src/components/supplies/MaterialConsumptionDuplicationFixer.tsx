import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface DuplicateGroup {
  material_id: string;
  order_id: string;
  material_name: string;
  material_sku: string;
  order_number: string;
  records: unknown[];
  total_quantity: number;
}

export const MaterialConsumptionDuplicationFixer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [fixing, setFixing] = useState<string | null>(null);
  const { toast } = useToast();

  const findDuplicates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_deliveries')
        .select(`
          id,
          material_id,
          order_id,
          quantity_consumed,
          delivery_date,
          notes,
          created_at,
          materials (
            name,
            sku
          ),
          orders (
            order_number
          )
        `)
        .gt('quantity_consumed', 0)
        .order('material_id, order_id, created_at');

      if (error) throw error;

      // Group by material + order
      const groups: { [key: string]: unknown[] } = {};
      
      data?.forEach(record => {
        const key = `${record.material_id}-${record.order_id}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(record);
      });

      // Find groups with duplicates (more than 1 record)
      const duplicateGroups: DuplicateGroup[] = [];
      
      Object.values(groups).forEach(records => {
        if (records.length > 1) {
          const firstRecord = records[0];
          const total = records.reduce((sum, r) => sum + Number(r.quantity_consumed), 0);
          
          duplicateGroups.push({
            material_id: firstRecord.material_id,
            order_id: firstRecord.order_id,
            material_name: firstRecord.materials?.name || 'N/A',
            material_sku: firstRecord.materials?.sku || 'N/A',
            order_number: firstRecord.orders?.order_number || 'N/A',
            records,
            total_quantity: total
          });
        }
      });

      setDuplicates(duplicateGroups);
      
      toast({
        title: "Análisis completado",
        description: `Se encontraron ${duplicateGroups.length} grupos con registros duplicados.`,
      });
    } catch (error: unknown) {
      console.error('Error finding duplicates:', error);
      toast({
        title: "Error",
        description: "No se pudieron analizar los registros duplicados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const consolidateDuplicate = async (duplicate: DuplicateGroup) => {
    const key = `${duplicate.material_id}-${duplicate.order_id}`;
    setFixing(key);
    
    try {
      // Consolidar en un solo registro (mantener el más reciente y sumar cantidades)
      const sortedRecords = duplicate.records.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      const keepRecord = sortedRecords[0];
      const deleteRecords = sortedRecords.slice(1);
      
      const totalQuantity = duplicate.records.reduce((sum, r) => 
        sum + Number(r.quantity_consumed), 0
      );
      
      const combinedNotes = duplicate.records
        .map(r => r.notes)
        .filter(Boolean)
        .join('; ');

      // Actualizar el registro que se mantiene
      const { error: updateError } = await supabase
        .from('material_deliveries')
        .update({
          quantity_consumed: totalQuantity,
          notes: combinedNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', keepRecord.id);

      if (updateError) throw updateError;

      // Eliminar los registros duplicados
      const { error: deleteError } = await supabase
        .from('material_deliveries')
        .delete()
        .in('id', deleteRecords.map(r => r.id));

      if (deleteError) throw deleteError;

      toast({
        title: "Duplicado consolidado",
        description: `${deleteRecords.length} registros duplicados eliminados. Cantidad total: ${totalQuantity}`,
      });

      // Actualizar la lista
      setDuplicates(prev => prev.filter(d => 
        `${d.material_id}-${d.order_id}` !== key
      ));
      
    } catch (error: unknown) {
      console.error('Error consolidating duplicate:', error);
      toast({
        title: "Error",
        description: "No se pudo consolidar el registro duplicado",
        variant: "destructive",
      });
    } finally {
      setFixing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Corrector de Duplicados</h2>
          <p className="text-muted-foreground">
            Detecta y corrige registros duplicados de consumo de materiales
          </p>
        </div>
        <Button 
          onClick={findDuplicates}
          disabled={loading}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Analizar Duplicados
        </Button>
      </div>

      {duplicates.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
            <p className="text-lg font-medium mb-2">No se encontraron duplicados</p>
            <p className="text-muted-foreground text-center">
              Haz clic en "Analizar Duplicados" para verificar los registros
            </p>
          </CardContent>
        </Card>
      )}

      {duplicates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <span className="text-lg font-semibold">
              {duplicates.length} grupos con registros duplicados encontrados
            </span>
          </div>

          {duplicates.map((duplicate) => {
            const key = `${duplicate.material_id}-${duplicate.order_id}`;
            const isFixing = fixing === key;
            
            return (
              <Card key={key} className="border-yellow-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {duplicate.material_name} ({duplicate.material_sku})
                      </CardTitle>
                      <p className="text-muted-foreground">
                        Orden: {duplicate.order_number}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      {duplicate.records.length} registros duplicados
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground">
                      <span>Cantidad</span>
                      <span>Fecha</span>
                      <span>Creado</span>
                      <span>Notas</span>
                    </div>
                    
                    {duplicate.records.map((record, index) => (
                      <div key={record.id} className="grid grid-cols-4 gap-4 text-sm border-l-2 border-yellow-500 pl-3">
                        <span className="font-medium">{record.quantity_consumed}</span>
                        <span>{new Date(record.delivery_date).toLocaleDateString()}</span>
                        <span>{new Date(record.created_at).toLocaleString()}</span>
                        <span className="truncate">{record.notes || 'Sin notas'}</span>
                      </div>
                    ))}
                    
                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="text-lg font-bold">
                        Total: {duplicate.total_quantity} unidades
                      </div>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline"
                            size="sm"
                            disabled={isFixing}
                          >
                            {isFixing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <Trash2 className="w-4 h-4 mr-2" />
                            Consolidar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Consolidar registros duplicados?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se mantendrá el registro más reciente con la cantidad total ({duplicate.total_quantity} unidades) 
                              y se eliminarán los {duplicate.records.length - 1} registros duplicados restantes.
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => consolidateDuplicate(duplicate)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Consolidar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};