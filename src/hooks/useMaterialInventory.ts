import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MaterialInventory {
  id: string;
  material_id: string;
  location_type: 'warehouse' | 'workshop';
  location_id: string;
  current_stock: number;
  reserved_stock: number;
  organization_id: string;
  created_at: string;
  updated_at: string;
  material?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    category: string;
    color?: string;
  };
  location_name?: string;
}

export const useMaterialInventory = (locationId?: string, locationType?: 'warehouse' | 'workshop') => {
  const [inventory, setInventory] = useState<MaterialInventory[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchInventory = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('material_inventory')
        .select(`
          *,
          material:materials (
            id,
            name,
            sku,
            unit,
            category,
            color
          )
        `)
        .order('current_stock', { ascending: false });

      if (locationId && locationType) {
        query = query
          .eq('location_id', locationId)
          .eq('location_type', locationType);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enriquecer con nombres de ubicación
      const enrichedData = await Promise.all((data || []).map(async (item) => {
        let locationName = '';
        
        if (item.location_type === 'warehouse') {
          const { data: warehouseData } = await supabase
            .from('warehouses')
            .select('name')
            .eq('id', item.location_id)
            .single();
          locationName = warehouseData?.name || 'Bodega';
        } else if (item.location_type === 'workshop') {
          const { data: workshopData } = await supabase
            .from('workshops')
            .select('name')
            .eq('id', item.location_id)
            .single();
          locationName = workshopData?.name || 'Taller';
        }

        return {
          ...item,
          location_type: item.location_type as 'warehouse' | 'workshop',
          location_name: locationName,
          material: (item.material as any)?.id ? item.material as any : undefined
        } as MaterialInventory;
      }));

      setInventory(enrichedData);
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el inventario",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStock = (materialId: string, locationId: string, locationType: 'warehouse' | 'workshop') => {
    const item = inventory.find(i => 
      i.material_id === materialId && 
      i.location_id === locationId && 
      i.location_type === locationType
    );
    return item ? Math.max(0, item.current_stock - item.reserved_stock) : 0;
  };

  useEffect(() => {
    fetchInventory();
  }, [locationId, locationType]);

  return {
    inventory,
    loading,
    getAvailableStock,
    refetch: fetchInventory
  };
};