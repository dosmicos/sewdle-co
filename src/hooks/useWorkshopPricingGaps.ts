import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WorkshopPricingGap {
  workshop_id: string;
  workshop_name: string;
  product_id: string;
  product_name: string;
  base_price: number;
  deliveries_count: number;
  avg_sale_price: number;
}

export const useWorkshopPricingGaps = () => {
  const [gaps, setGaps] = useState<WorkshopPricingGap[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPricingGaps = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_workshop_pricing_gaps');

      if (error) throw error;

      setGaps(data || []);
    } catch (error) {
      console.error('Error fetching workshop pricing gaps:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los problemas de precios de talleres"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricingGaps();
  }, []);

  return {
    gaps,
    loading,
    refetch: fetchPricingGaps
  };
};