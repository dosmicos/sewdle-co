
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DiagnosisResult {
  success: boolean;
  analysis: {
    localProducts: number;
    shopifyProducts: number;
    matchedSkus: any[];
    unmatchedSkus: any[];
    duplicateSkus: any[];
    emptySkus: any[];
    formatIssues: any[];
  };
  patterns: {
    localPatterns: any;
    shopifyPatterns: any;
    suggestions: any[];
  };
  summary: {
    totalLocalProducts: number;
    totalShopifyProducts: number;
    matchedSkus: number;
    unmatchedSkus: number;
    emptySkus: number;
    matchRate: string;
  };
}

interface SyncLogDetails {
  delivery_id: string;
  sync_results: any[];
  success_count: number;
  error_count: number;
  synced_at: string;
}

export const useShopifyDiagnosis = () => {
  const [loading, setLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const { toast } = useToast();

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      console.log('Ejecutando diagnóstico de Shopify...');

      const { data, error } = await supabase.functions.invoke('diagnose-shopify-sync');

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Error en el diagnóstico');
      }

      setDiagnosisResult(data);

      toast({
        title: "Diagnóstico completado",
        description: `${data.summary.matchedSkus} SKUs coinciden de ${data.summary.totalLocalProducts} productos locales`,
      });

      return data;

    } catch (error) {
      console.error('Error en diagnóstico:', error);
      toast({
        title: "Error en diagnóstico",
        description: error instanceof Error ? error.message : "No se pudo ejecutar el diagnóstico",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getSyncLogDetails = async (deliveryId: string): Promise<SyncLogDetails[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_sync_logs')
        .select('*')
        .eq('delivery_id', deliveryId)
        .order('synced_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Type conversion to handle Supabase Json type
      const typedData = (data || []).map(item => ({
        ...item,
        sync_results: Array.isArray(item.sync_results) 
          ? item.sync_results 
          : typeof item.sync_results === 'string' 
            ? JSON.parse(item.sync_results)
            : []
      })) as SyncLogDetails[];

      return typedData;
    } catch (error) {
      console.error('Error obteniendo logs de sincronización:', error);
      toast({
        title: "Error obteniendo logs",
        description: error instanceof Error ? error.message : "No se pudieron obtener los logs",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const testShopifyConnection = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-inventory-shopify', {
        body: {
          deliveryId: 'test',
          approvedItems: []
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Test de conexión",
        description: "Conexión con Shopify verificada",
      });

      return data;
    } catch (error) {
      console.error('Error en test de conexión:', error);
      toast({
        title: "Error de conexión",
        description: error instanceof Error ? error.message : "No se pudo conectar con Shopify",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    runDiagnosis,
    getSyncLogDetails,
    testShopifyConnection,
    diagnosisResult,
    loading
  };
};
