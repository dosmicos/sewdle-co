import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

// Nueva interfaz basada en inventory_replenishment
export interface ReplenishmentSuggestion {
  id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  sku_variant: string;
  variant_size: string | null;
  variant_color: string | null;
  current_stock: number;
  pending_production: number;
  sales_30d: number;
  orders_count_30d: number;
  avg_daily_sales: number;
  days_of_supply: number | null;
  projected_demand_40d: number;
  suggested_quantity: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reason: string | null;
  data_confidence: 'high' | 'medium' | 'low';
  calculated_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}

export const useReplenishment = () => {
  const [suggestions, setSuggestions] = useState<ReplenishmentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const { currentOrganization } = useOrganization();

  const fetchSuggestions = async () => {
    if (!currentOrganization?.id) return;
    
    try {
      setLoading(true);
      
      // Usar la nueva vista v_replenishment_details - solo datos de hoy
      const { data, error } = await supabase
        .from('v_replenishment_details')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('calculation_date', new Date().toISOString().split('T')[0]);
      
      if (error) throw error;
      
      setSuggestions((data || []) as ReplenishmentSuggestion[]);
    } catch (error) {
      console.error('Error fetching replenishment suggestions:', error);
      toast.error('Error al cargar sugerencias de reposición');
    } finally {
      setLoading(false);
    }
  };

  const calculateSuggestions = async () => {
    if (!currentOrganization?.id) {
      toast.error('No se pudo identificar la organización');
      return;
    }
    
    try {
      setCalculating(true);
      
      console.log('🔄 Calculando sugerencias para organización:', currentOrganization.id);
      
      // Llamar a la nueva función refresh_inventory_replenishment
      const { data, error } = await supabase
        .rpc('refresh_inventory_replenishment', {
          org_id: currentOrganization.id
        });
      
      if (error) {
        console.error('❌ Error en RPC:', error);
        throw error;
      }
      
      console.log('✅ Respuesta RPC:', data);
      
      const result = data as { inserted?: number } | null;
      
      if (result?.inserted !== undefined && result.inserted >= 0) {
        toast.success(`Cálculo completado: ${result.inserted} sugerencias generadas`);
        await fetchSuggestions();
      } else {
        toast.warning('No se generaron nuevas sugerencias');
      }
    } catch (error: any) {
      console.error('❌ Error calculating suggestions:', error);
      toast.error(error.message || 'Error al calcular sugerencias');
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchSuggestions();
    }
  }, [currentOrganization?.id]);

  return {
    suggestions,
    loading,
    calculating,
    fetchSuggestions,
    calculateSuggestions,
  };
};
