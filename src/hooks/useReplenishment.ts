import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface ReplenishmentSuggestion {
  id: string; // Now properly returned by RPC as product_variant_id
  product_variant_id: string;
  order_id: string | null;
  product_name: string;
  variant_name: string;
  variant_size: string;
  variant_color: string;
  sku: string;
  sku_variant: string;
  suggested_quantity: number;
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number;
  sales_last_30_days: number;
  sales_last_7_days: number;
  sales_velocity: number;
  stock_days_remaining: number;
  open_orders_quantity: number;
  urgency_level: 'critical' | 'high' | 'normal' | 'low';
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  created_at: string;
  updated_at: string;
  data_quality?: 'high' | 'medium' | 'low' | 'insufficient';
}

export interface ReplenishmentConfig {
  id: string;
  product_variant_id: string;
  organization_id: string;
  min_stock_level: number;
  max_stock_level: number;
  lead_time_days: number;
  safety_days: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export const useReplenishment = () => {
  const [suggestions, setSuggestions] = useState<ReplenishmentSuggestion[]>([]);
  const [configs, setConfigs] = useState<ReplenishmentConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  const fetchSuggestions = async () => {
    try {
      setLoading(true);

      console.log('🔍 Obteniendo sugerencias de reposición...');
      const { data, error } = await supabase
        .rpc('get_replenishment_suggestions_with_details');

      if (error) {
        console.error('Error fetching suggestions:', error);
        toast({
          title: "Error",
          description: "Error al cargar sugerencias de reposición",
          variant: "destructive",
        });
        return;
      }

      setSuggestions((data || []) as any[]);
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


  const calculateSuggestions = async () => {
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No se pudo obtener la organización actual",
        variant: "destructive",
      });
      return;
    }

    try {
      setCalculating(true);
      
      toast({
        title: "Calculando sugerencias",
        description: "Procesando datos automáticos de Shopify...",
      });
      
      // Call the calculation function with organization_id
      console.log('Calculando sugerencias de reposición con datos automáticos...');
      const { data, error } = await supabase
        .rpc('calculate_replenishment_suggestions', { 
          p_organization_id: currentOrganization.id 
        });

      if (error) {
        console.error('Error calculating replenishment:', error);
        throw error;
      }

      toast({
        title: "Éxito",
        description: "Sugerencias calculadas con datos automáticos de Shopify.",
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
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No se pudo obtener la organización actual",
        variant: "destructive",
      });
      return;
    }

    try {
      setCalculating(true);
      
      // Llamar a la Edge Function con organization_id
      const { data, error } = await supabase.functions.invoke('intelligent-replenishment', {
        body: { 
          organization_id: currentOrganization.id,
          manual_trigger: true 
        }
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


  const createConfig = async (config: Omit<ReplenishmentConfig, 'id' | 'created_at' | 'updated_at' | 'organization_id' | 'created_by'>) => {
    try {
      // Get current organization and user
      const user = await supabase.auth.getUser();
      const { data: orgData } = await supabase
        .from('organization_users')
        .select('organization_id')
        .eq('user_id', user.data.user?.id)
        .eq('status', 'active')
        .single();

      const { error } = await supabase
        .from('replenishment_config')
        .insert({
          ...config,
          organization_id: orgData?.organization_id,
          created_by: user.data.user?.id
        });

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
    calculateSuggestions,
    triggerReplenishmentFunction,
    createConfig,
    updateConfig,
  };
};
