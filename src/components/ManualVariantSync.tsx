import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useInventorySync } from '@/hooks/useInventorySync';
import { useToast } from '@/hooks/use-toast';

export const ManualVariantSync = () => {
  const [syncing, setSyncing] = useState(false);
  const { syncApprovedItemsToShopify } = useInventorySync();
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const syncData = {
        deliveryId: 'bbf93e36-5bbe-448e-9ecf-c54d838cae70',
        approvedItems: [{
          variantId: '14be6107-5ac8-4536-8311-cdfed46589df',
          skuVariant: '46312745304299',
          quantityApproved: 7
        }]
      };

      console.log('Sincronizando variante específica:', syncData);
      const result = await syncApprovedItemsToShopify(syncData);
      
      toast({
        title: "Sincronización completada",
        description: `Variante 46312745304299 sincronizada con ${syncData.approvedItems[0].quantityApproved} unidades`,
      });
      
      console.log('Resultado:', result);
    } catch (error) {
      console.error('Error en sincronización:', error);
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
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-2">Sincronización Manual - Variante 46312745304299</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Esta variante estaba marcada como sincronizada pero no se ejecutó la sincronización real con Shopify.
      </p>
      <Button onClick={handleSync} disabled={syncing}>
        {syncing ? 'Sincronizando...' : 'Sincronizar 7 unidades con Shopify'}
      </Button>
    </div>
  );
};