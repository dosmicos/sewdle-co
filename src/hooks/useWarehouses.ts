import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Warehouse {
  id: string;
  name: string;
  description?: string;
  address?: string;
  is_central: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export const useWarehouses = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error: any) {
      console.error('Error fetching warehouses:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las bodegas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCentralWarehouse = () => {
    return warehouses.find(warehouse => warehouse.is_central);
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  return {
    warehouses,
    centralWarehouse: getCentralWarehouse(),
    loading,
    refetch: fetchWarehouses
  };
};