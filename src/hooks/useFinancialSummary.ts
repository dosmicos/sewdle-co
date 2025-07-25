import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FinancialSummary {
  pendingPayments: number;
  completedPayments: number;
  totalAdvances: number;
  totalDeliveries: number;
}

export const useFinancialSummary = () => {
  const [summary, setSummary] = useState<FinancialSummary>({
    pendingPayments: 0,
    completedPayments: 0,
    totalAdvances: 0,
    totalDeliveries: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchFinancialSummary = async () => {
    setLoading(true);
    try {
      // Obtener pagos pendientes y realizados
      const { data: payments, error: paymentsError } = await supabase
        .from('delivery_payments')
        .select('payment_status, net_amount');

      if (paymentsError) {
        throw paymentsError;
      }

      // Obtener total de anticipos
      const { data: advances, error: advancesError } = await supabase
        .from('order_advances')
        .select('amount');

      if (advancesError) {
        throw advancesError;
      }

      // Obtener total de entregas
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('id');

      if (deliveriesError) {
        throw deliveriesError;
      }

      // Calcular resumen
      const pendingPayments = payments
        .filter(p => p.payment_status === 'pending')
        .reduce((sum, p) => sum + (Number(p.net_amount) || 0), 0);

      const completedPayments = payments
        .filter(p => p.payment_status === 'paid')
        .reduce((sum, p) => sum + (Number(p.net_amount) || 0), 0);

      const totalAdvances = advances
        .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

      setSummary({
        pendingPayments,
        completedPayments,
        totalAdvances,
        totalDeliveries: deliveries.length
      });

    } catch (error) {
      console.error('Error fetching financial summary:', error);
      toast({
        title: "Error al cargar resumen financiero",
        description: "No se pudo cargar la información financiera.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialSummary();
  }, []);

  return {
    summary,
    loading,
    refetch: fetchFinancialSummary
  };
};