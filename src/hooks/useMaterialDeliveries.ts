
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MaterialDeliveryData {
  workshopId: string;
  orderId?: string;
  deliveredBy: string;
  notes?: string;
  materials: {
    materialId: string;
    quantity: number;
    unit: string;
    notes?: string;
  }[];
  supportDocument?: File;
}

export const useMaterialDeliveries = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createMaterialDelivery = async (deliveryData: MaterialDeliveryData) => {
    setLoading(true);
    try {
      console.log('Creating material delivery with data:', deliveryData);

      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        throw new Error('Usuario no autenticado');
      }

      // Create material deliveries for each material
      const deliveryPromises = deliveryData.materials.map(async (material) => {
        const { data, error } = await supabase
          .from('material_deliveries')
          .insert({
            material_id: material.materialId,
            workshop_id: deliveryData.workshopId,
            order_id: deliveryData.orderId || null,
            quantity_delivered: material.quantity,
            quantity_remaining: material.quantity,
            delivered_by: session.user.id,
            notes: material.notes || deliveryData.notes || null
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating material delivery:', error);
          throw error;
        }

        return data;
      });

      const results = await Promise.all(deliveryPromises);

      console.log('Material deliveries created successfully:', results);

      toast({
        title: "¡Entrega registrada exitosamente!",
        description: `Se registraron ${deliveryData.materials.length} materiales entregados.`,
      });

      return results;
    } catch (error: any) {
      console.error('Error creating material delivery:', error);
      
      let errorMessage = "No se pudo registrar la entrega de materiales";
      
      if (error.message?.includes('Usuario no autenticado')) {
        errorMessage = "Debes iniciar sesión para registrar entregas.";
      } else if (error.message?.includes('policy')) {
        errorMessage = "Error de permisos. Verifica tu rol de usuario.";
      } else if (error.code) {
        errorMessage = `Error de base de datos: ${error.message}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterialDeliveries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_deliveries')
        .select(`
          *,
          materials (
            name,
            sku,
            unit,
            category
          ),
          workshops (
            name
          ),
          orders (
            order_number
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching material deliveries:', error);
        throw error;
      }

      console.log('Fetched material deliveries:', data);
      return data || [];
    } catch (error) {
      console.error('Error fetching material deliveries:', error);
      toast({
        title: "Error al cargar entregas",
        description: "No se pudieron cargar las entregas de materiales.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    createMaterialDelivery,
    fetchMaterialDeliveries
  };
};
