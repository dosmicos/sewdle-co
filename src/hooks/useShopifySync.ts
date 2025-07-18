
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  success: boolean;
  message: string;
  summary?: any;
}

export const useShopifySync = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const triggerSync = async (mode: 'initial' | 'daily' | 'monthly', days?: number): Promise<SyncResult> => {
    setLoading(true);
    try {
      console.log(`Ejecutando sincronización ${mode} con ${days || 'default'} días...`);

      const { data, error } = await supabase.functions.invoke('sync-shopify-sales', {
        body: {
          mode,
          days: days || (mode === 'initial' ? 90 : mode === 'daily' ? 7 : 30),
          scheduled: false
        }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Error en la sincronización');
      }

      toast({
        title: "Sincronización completada",
        description: `${mode} sync: ${data.summary?.shopify_orders_processed || 0} órdenes procesadas`,
      });

      return data;

    } catch (error) {
      console.error('Error en sincronización:', error);
      toast({
        title: "Error en sincronización",
        description: error instanceof Error ? error.message : "No se pudo ejecutar la sincronización",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getSyncLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_control_logs')
        .select('*')
        .eq('sync_mode', 'sales')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error obteniendo logs de sincronización:', error);
      return [];
    }
  };

  return {
    triggerSync,
    getSyncLogs,
    loading
  };
};
