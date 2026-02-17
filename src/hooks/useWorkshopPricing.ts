import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WorkshopPricing {
  id: string;
  workshop_id: string;
  product_id: string;
  unit_price: number;
  currency: string;
  effective_from: string;
  effective_until?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  workshop_name?: string;
  product_name?: string;
}

export interface WorkshopPricingInsert {
  workshop_id: string;
  product_id: string;
  unit_price: number;
  currency?: string;
  effective_from: string;
  effective_until?: string;
  notes?: string;
}

export const useWorkshopPricing = () => {
  const [pricing, setPricing] = useState<WorkshopPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPricing = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workshop_pricing')
        .select(`
          *,
          workshops!workshop_pricing_workshop_id_fkey(name),
          products!workshop_pricing_product_id_fkey(name)
        `)
        .order('effective_from', { ascending: false });

      if (error) throw error;

      const transformedData = data?.map(item => ({
        ...item,
        workshop_name: item.workshops?.name,
        product_name: item.products?.name
      })) || [];

      setPricing(transformedData);
    } catch (error) {
      console.error('Error fetching workshop pricing:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los precios de talleres"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createPricing = async (newPricing: WorkshopPricingInsert) => {
    try {
      const { data, error } = await supabase
        .from('workshop_pricing')
        .insert({
          ...newPricing,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Precio creado",
        description: "El precio para el taller ha sido creado correctamente"
      });

      fetchPricing();
      return data;
    } catch (error) {
      console.error('Error creating pricing:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear el precio"
      });
      throw error;
    }
  };

  const updatePricing = async (id: string, updates: Partial<WorkshopPricingInsert>) => {
    try {
      const { error } = await supabase
        .from('workshop_pricing')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Precio actualizado",
        description: "El precio ha sido actualizado correctamente"
      });

      fetchPricing();
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el precio"
      });
      throw error;
    }
  };

  const deletePricing = async (id: string) => {
    try {
      const { error } = await supabase
        .from('workshop_pricing')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Precio eliminado",
        description: "El precio ha sido eliminado correctamente"
      });

      fetchPricing();
    } catch (error) {
      console.error('Error deleting pricing:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el precio"
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  return {
    pricing,
    loading,
    createPricing,
    updatePricing,
    deletePricing,
    refetch: fetchPricing
  };
};
