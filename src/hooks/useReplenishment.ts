import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ReplenishmentSuggestion {
  id: string;
  product_name: string;
  variant_size: string | null;
  variant_color: string | null;
  sku_variant: string;
  suggested_quantity: number;
  current_stock: number;
  sales_velocity: number;
  sales_30_days: number;
  days_of_stock: number;
  open_orders_quantity: number;
  projected_demand: number;
  urgency_level: 'low' | 'normal' | 'high' | 'critical';
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  calculation_date: string;
  created_at: string;
  pending_production_quantity: number;
}

export interface ReplenishmentConfig {
  id: string;
  product_variant_id: string;
  min_stock_level: number;
  max_stock_level: number;
  lead_time_days: number;
  safety_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useReplenishment = () => {
  const [suggestions, setSuggestions] = useState<ReplenishmentSuggestion[]>([]);
  const [configs, setConfigs] = useState<ReplenishmentConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const { toast } = useToast();

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .rpc('get_replenishment_suggestions_with_details')
        .eq('calculation_date', new Date().toISOString().split('T')[0]);

      if (error) {
        console.error('Error fetching suggestions:', error);
        toast({
          title: "Error",
          description: "Error al cargar sugerencias de reposición",
          variant: "destructive",
        });
        return;
      }

      setSuggestions((data || []) as ReplenishmentSuggestion[]);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast({
        title: "Error",
        description: "Error al cargar sugerencias de reposición",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('replenishment_config')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching replenishment configs:', error);
        throw error;
      }

      setConfigs(data || []);
    } catch (error) {
      console.error('Error in fetchConfigs:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la configuración de reposición",
        variant: "destructive",
      });
    }
  };

  const syncShopifySales = async () => {
    try {
      setCalculating(true);
      
      toast({
        title: "Iniciando sincronización",
        description: "Sincronizando ventas de Shopify...",
      });

      const { data, error } = await supabase.functions.invoke('sync-shopify-sales');
      
      if (error) {
        console.error('Error syncing Shopify sales:', error);
        toast({
          title: "Error",
          description: "Error al sincronizar ventas de Shopify",
          variant: "destructive",
        });
        return;
      }

      console.log('Shopify sales synced successfully:', data);
      toast({
        title: "Sincronización completada",
        description: `Ventas de Shopify sincronizadas: ${data.summary?.total_sales_quantity || 0} unidades`,
      });
      
    } catch (error) {
      console.error('Error syncing Shopify sales:', error);
      toast({
        title: "Error",
        description: "Error al sincronizar ventas de Shopify",
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  };

  const calculateSuggestions = async () => {
    try {
      setCalculating(true);
      
      // Llamar a la función directamente en la base de datos
      const { data, error } = await supabase
        .rpc('calculate_replenishment_suggestions');

      if (error) {
        console.error('Error calculating replenishment:', error);
        throw error;
      }

      toast({
        title: "Éxito",
        description: `Cálculo completado. Se procesaron ${data?.length || 0} variantes.`,
      });

      // Recargar sugerencias después del cálculo
      await fetchSuggestions();
      
    } catch (error) {
      console.error('Error in calculateSuggestions:', error);
      toast({
        title: "Error",
        description: "Error al calcular sugerencias de reposición",
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  };

  const triggerReplenishmentFunction = async () => {
    try {
      setCalculating(true);
      
      // Llamar a la Edge Function
      const { data, error } = await supabase.functions.invoke('intelligent-replenishment', {
        body: { manual_trigger: true }
      });

      if (error) {
        console.error('Error triggering replenishment function:', error);
        throw error;
      }

      toast({
        title: "Éxito",
        description: "Función de reposición ejecutada exitosamente",
      });

      // Recargar sugerencias después del cálculo
      await fetchSuggestions();
      
    } catch (error) {
      console.error('Error in triggerReplenishmentFunction:', error);
      toast({
        title: "Error",
        description: "Error al ejecutar la función de reposición",
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  };

  const updateSuggestionStatus = async (suggestionId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('replenishment_suggestions')
        .update({ 
          status,
          approved_by: status === 'approved' ? (await supabase.auth.getUser()).data.user?.id : null,
          approved_at: status === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', suggestionId);

      if (error) {
        console.error('Error updating suggestion status:', error);
        throw error;
      }

      toast({
        title: "Éxito",
        description: `Sugerencia ${status === 'approved' ? 'aprobada' : 'rechazada'} exitosamente`,
      });

      // Recargar sugerencias
      await fetchSuggestions();
      
    } catch (error) {
      console.error('Error in updateSuggestionStatus:', error);
      toast({
        title: "Error",
        description: "Error al actualizar el estado de la sugerencia",
        variant: "destructive",
      });
    }
  };

  const createConfig = async (config: Omit<ReplenishmentConfig, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('replenishment_config')
        .insert([{
          ...config,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (error) {
        console.error('Error creating replenishment config:', error);
        throw error;
      }

      toast({
        title: "Éxito",
        description: "Configuración de reposición creada exitosamente",
      });

      // Recargar configuraciones
      await fetchConfigs();
      
    } catch (error) {
      console.error('Error in createConfig:', error);
      toast({
        title: "Error",
        description: "Error al crear la configuración de reposición",
        variant: "destructive",
      });
    }
  };

  const updateConfig = async (configId: string, updates: Partial<ReplenishmentConfig>) => {
    try {
      const { error } = await supabase
        .from('replenishment_config')
        .update(updates)
        .eq('id', configId);

      if (error) {
        console.error('Error updating replenishment config:', error);
        throw error;
      }

      toast({
        title: "Éxito",
        description: "Configuración de reposición actualizada exitosamente",
      });

      // Recargar configuraciones
      await fetchConfigs();
      
    } catch (error) {
      console.error('Error in updateConfig:', error);
      toast({
        title: "Error",
        description: "Error al actualizar la configuración de reposición",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchSuggestions();
    fetchConfigs();
  }, []);

  return {
    suggestions,
    configs,
    loading,
    calculating,
    fetchSuggestions,
    fetchConfigs,
    syncShopifySales,
    calculateSuggestions,
    triggerReplenishmentFunction,
    updateSuggestionStatus,
    createConfig,
    updateConfig,
  };
};