import { useState, useEffect, useCallback } from 'react';
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
  in_transit: number;
  sales_30d: number;
  orders_count_30d: number;
  avg_daily_sales: number;
  days_of_supply: number | null;
  projected_demand_40d: number;
  suggested_quantity: number;
  pipeline_coverage_days: number | null;
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
  const organizationId = currentOrganization?.id;

  const fetchSuggestions = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      setLoading(true);
      
      // Usar la nueva vista v_replenishment_details - solo datos de hoy
      const { data, error } = await supabase
        .from('v_replenishment_details')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('calculation_date', new Date().toISOString().split('T')[0])
        .eq('status', 'pending');
      
      if (error) throw error;
      
      setSuggestions((data || []) as ReplenishmentSuggestion[]);
    } catch (error) {
      console.error('Error fetching replenishment suggestions:', error);
      toast.error('Error al cargar sugerencias de reposición');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const calculateSuggestions = useCallback(async () => {
    if (!organizationId) {
      toast.error('No se pudo identificar la organización');
      return;
    }
    
    try {
      setCalculating(true);
      
      console.log('🔄 Calculando sugerencias para organización:', organizationId);
      
      // Llamar a la nueva función refresh_inventory_replenishment
      const { data, error } = await supabase
        .rpc('refresh_inventory_replenishment', {
          org_id: organizationId
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
    } catch (error: unknown) {
      console.error('❌ Error calculating suggestions:', error);
      toast.error(error.message || 'Error al calcular sugerencias');
    } finally {
      setCalculating(false);
    }
  }, [fetchSuggestions, organizationId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return {
    suggestions,
    loading,
    calculating,
    fetchSuggestions,
    calculateSuggestions,
  };
};
