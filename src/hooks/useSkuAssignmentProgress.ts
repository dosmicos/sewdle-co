
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SkuAssignmentLog {
  id: string;
  process_id: string;
  status: string;
  total_products: number;
  total_variants: number;
  processed_variants: number;
  updated_variants: number;
  skipped_variants: number;
  error_variants: number;
  current_cursor: string | null;
  last_processed_product_id: string | null;
  last_processed_variant_id: string | null;
  shopify_api_calls: number;
  rate_limit_hits: number;
  error_message: string | null;
  detailed_results: unknown;
  started_at: string;
  completed_at: string | null;
  last_activity_at: string;
}

export const useSkuAssignmentProgress = () => {
  const [logs, setLogs] = useState<SkuAssignmentLog[]>([]);
  const [currentProcess, setCurrentProcess] = useState<SkuAssignmentLog | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('sku_assignment_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLogs(data || []);

      // Buscar proceso en curso
      const activeProcess = data?.find(log => 
        log.status === 'running' || log.status === 'paused'
      );
      setCurrentProcess(activeProcess || null);

    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const getProgressPercentage = (log: SkuAssignmentLog) => {
    if (!log.total_variants || log.total_variants === 0) return 0;
    return Math.round((log.processed_variants / log.total_variants) * 100);
  };

  const startNewProcess = async (maxVariants = 100) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('assign-shopify-skus', {
        body: { maxVariants }
      });

      if (error) throw error;

      toast({
        title: "Proceso iniciado",
        description: "La asignación de SKUs ha comenzado",
      });

      await fetchLogs();
      return data;

    } catch (error) {
      console.error('Error starting process:', error);
      toast({
        title: "Error",
        description: "No se pudo iniciar el proceso de asignación",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resumeProcess = async (processId: string, cursor?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('assign-shopify-skus', {
        body: { 
          processId,
          resumeFromCursor: cursor,
          maxVariants: 100
        }
      });

      if (error) throw error;

      toast({
        title: "Proceso reanudado",
        description: "Continuando desde donde se quedó",
      });

      await fetchLogs();
      return data;

    } catch (error) {
      console.error('Error resuming process:', error);
      toast({
        title: "Error",
        description: "No se pudo reanudar el proceso",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelProcess = async (processId: string) => {
    try {
      const { error } = await supabase
        .from('sku_assignment_logs')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('process_id', processId);

      if (error) throw error;

      toast({
        title: "Proceso cancelado",
        description: "La asignación de SKUs fue cancelada",
      });

      await fetchLogs();
    } catch (error) {
      console.error('Error cancelling process:', error);
      toast({
        title: "Error",
        description: "No se pudo cancelar el proceso",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchLogs();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('sku-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sku_assignment_logs'
        },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    // Polling cada 30 segundos para procesos activos
    const interval = setInterval(() => {
      if (currentProcess && (currentProcess.status === 'running' || currentProcess.status === 'paused')) {
        fetchLogs();
      }
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [currentProcess]);

  return {
    logs,
    currentProcess,
    loading,
    getProgressPercentage,
    startNewProcess,
    resumeProcess,
    cancelProcess,
    refetch: fetchLogs
  };
};
