import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { syncDEL0014_SKU45968383148267 } from '@/utils/manualSync';
import { useToast } from '@/hooks/use-toast';

const ManualSyncButton = () => {
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setLoading(true);
    try {
      const result = await syncDEL0014_SKU45968383148267();
      
      if (result.success) {
        setSynced(true);
        toast({
          title: "Sincronización exitosa",
          description: result.message,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error en sincronización:', error);
      toast({
        title: "Error en sincronización",
        description: error.message || "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5" />
          <span>Sincronización Manual</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Entrega:</span>
            <Badge variant="outline">DEL-0014</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">SKU:</span>
            <Badge variant="outline">45968383148267</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Cantidad:</span>
            <Badge variant="outline">6 unidades</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Estado:</span>
            {synced ? (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3 mr-1" />
                Sincronizado
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                Pendiente
              </Badge>
            )}
          </div>
        </div>
        
        {!synced && (
          <Button 
            onClick={handleSync} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sincronizar Ahora
              </>
            )}
          </Button>
        )}
        
        {synced && (
          <div className="text-center text-sm text-green-600 font-medium">
            ✅ Variante sincronizada exitosamente
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ManualSyncButton;