import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useInventorySync } from '@/hooks/useInventorySync';
import { useToast } from '@/hooks/use-toast';

export const ManualVariantSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const { syncApprovedItemsToShopify } = useInventorySync();
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    
    try {
      const syncData = {
        deliveryId: 'bbf93e36-5bbe-448e-9ecf-c54d838cae70',
        approvedItems: [{
          variantId: '14be6107-5ac8-4536-8311-cdfed46589df',
          skuVariant: '46312745304299',
          quantityApproved: 7
        }]
      };

      console.log('🔄 Sincronizando variante específica:', syncData);
      const result = await syncApprovedItemsToShopify(syncData);
      
      if (result.success) {
        setSyncResult('✅ Sincronización exitosa - Verifica en Shopify');
        toast({
          title: "Sincronización exitosa",
          description: `Variante 46312745304299 sincronizada con 7 unidades en Shopify`,
        });
      } else {
        setSyncResult('❌ Sincronización fallida');
        toast({
          title: "Error en sincronización",
          description: result.error || "No se pudo sincronizar",
          variant: "destructive",
        });
      }
      
      console.log('📊 Resultado completo:', result);
    } catch (error) {
      console.error('💥 Error en sincronización:', error);
      setSyncResult('❌ Error en sincronización');
      toast({
        title: "Error",
        description: "No se pudo sincronizar la variante",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
      <h3 className="font-semibold mb-2 text-yellow-800">🔧 Sincronización Manual - Variante 46312745304299</h3>
      <p className="text-sm text-yellow-700 mb-4">
        Esta variante necesita sincronización manual con Shopify. Haz clic para ejecutar la sincronización real.
      </p>
      
      {syncResult && (
        <div className="mb-4 p-2 rounded bg-white border">
          <p className="text-sm font-mono">{syncResult}</p>
        </div>
      )}
      
      <div className="flex gap-2">
        <Button 
          onClick={handleSync} 
          disabled={syncing}
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
        >
          {syncing ? '🔄 Sincronizando...' : '🚀 Sincronizar 7 unidades con Shopify'}
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => window.open('https://admin.shopify.com/store/your-store/products', '_blank')}
          size="sm"
        >
          📦 Ver en Shopify
        </Button>
      </div>
    </div>
  );
};