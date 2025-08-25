import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface WorkshopAdvanceBalance {
  workshop_id: string;
  workshop_name: string;
  total_advances: number;
  total_deductions_used: number;
  net_balance: number;
}

export const useWorkshopAdvanceBalance = () => {
  const [balances, setBalances] = useState<WorkshopAdvanceBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  const fetchWorkshopBalances = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);

      // Get total advances per workshop
      const { data: advancesData, error: advancesError } = await supabase
        .from('order_advances')
        .select(`
          workshop_id,
          amount,
          workshops!order_advances_workshop_id_fkey(name)
        `)
        .eq('organization_id', currentOrganization.id);

      if (advancesError) throw advancesError;

      // Get total deductions used per workshop
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('delivery_payments')
        .select(`
          workshop_id,
          advance_deduction,
          custom_advance_deduction,
          workshops!delivery_payments_workshop_id_fkey(name)
        `)
        .eq('organization_id', currentOrganization.id);

      if (paymentsError) throw paymentsError;

      // Process the data to calculate balances
      const workshopMap = new Map<string, WorkshopAdvanceBalance>();

      // Add advances
      advancesData?.forEach(advance => {
        const workshopId = advance.workshop_id;
        const workshopName = advance.workshops?.name || 'Taller Desconocido';
        
        if (!workshopMap.has(workshopId)) {
          workshopMap.set(workshopId, {
            workshop_id: workshopId,
            workshop_name: workshopName,
            total_advances: 0,
            total_deductions_used: 0,
            net_balance: 0
          });
        }
        
        workshopMap.get(workshopId)!.total_advances += advance.amount;
      });

      // Subtract deductions used
      paymentsData?.forEach(payment => {
        const workshopId = payment.workshop_id;
        const workshopName = payment.workshops?.name || 'Taller Desconocido';
        
        if (!workshopMap.has(workshopId)) {
          workshopMap.set(workshopId, {
            workshop_id: workshopId,
            workshop_name: workshopName,
            total_advances: 0,
            total_deductions_used: 0,
            net_balance: 0
          });
        }

        const deductionAmount = payment.custom_advance_deduction || payment.advance_deduction;
        workshopMap.get(workshopId)!.total_deductions_used += deductionAmount;
      });

      // Calculate net balances
      const balancesArray = Array.from(workshopMap.values()).map(balance => ({
        ...balance,
        net_balance: balance.total_advances - balance.total_deductions_used
      }));

      // Sort by net balance descending (highest debts first)
      balancesArray.sort((a, b) => b.net_balance - a.net_balance);

      setBalances(balancesArray);
    } catch (error) {
      console.error('Error fetching workshop balances:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los balances de talleres"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkshopBalances();
  }, [currentOrganization]);

  return {
    balances,
    loading,
    refetch: fetchWorkshopBalances
  };
};