import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ResyncOptions {
  specificSkus?: string[];
  retryAll?: boolean;
}

interface ResyncResult {
  success: boolean;
  message: string;
  tracking_number?: string;
  attempted_items?: number;
  sync_result?: any;
}

export const useResyncDelivery = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const resyncDelivery = async (deliveryId: string, options: ResyncOptions = {}): Promise<ResyncResult | null> => {
    setLoading(true);
    try {
      console.log('Resincronizando entrega:', deliveryId, options);

      const { data, error } = await supabase.functions.invoke('resync-delivery', {
        body: {
          deliveryId,
          ...options
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: "Éxito en resincronización",
          description: data.message,
        });
      } else {
        throw new Error(data.error || 'Error en resincronización');
      }

      return data;

    } catch (error) {
      console.error('Error en resincronización:', error);
      toast({
        title: "Error en resincronización",
        description: error instanceof Error ? error.message : "No se pudo resincronizar la entrega",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const resyncFailedItems = async (deliveryId: string, failedSkus: string[]): Promise<ResyncResult | null> => {
    if (failedSkus.length === 0) {
      toast({
        title: "Sin items para resincronizar",
        description: "No hay items fallidos en esta entrega",
      });
      return null;
    }

    return resyncDelivery(deliveryId, { specificSkus: failedSkus });
  };

  const resyncAllItems = async (deliveryId: string): Promise<ResyncResult | null> => {
    return resyncDelivery(deliveryId, { retryAll: true });
  };

  return {
    resyncDelivery,
    resyncFailedItems,
    resyncAllItems,
    loading
  };
};