
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Error de autenticación');
      }
      
      if (!session?.user) {
        console.error('No session found');
        throw new Error('Usuario no autenticado. Por favor inicia sesión.');
      }

      console.log('User authenticated:', session.user.id);

      // Create material deliveries for each material
      const deliveryPromises = deliveryData.materials.map(async (material) => {
        const deliveryRecord = {
          material_id: material.materialId,
          workshop_id: deliveryData.workshopId,
          order_id: deliveryData.orderId || null,
          quantity_delivered: material.quantity,
          quantity_remaining: material.quantity,
          delivered_by: session.user.id,
          notes: material.notes || deliveryData.notes || null
        };

        console.log('Inserting delivery record:', deliveryRecord);

        const { data, error } = await supabase
          .from('material_deliveries')
          .insert(deliveryRecord)
          .select()
          .single();

        if (error) {
          console.error('Error creating material delivery:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          throw error;
        }

        console.log('Material delivery created successfully:', data);
        return data;
      });

      const results = await Promise.all(deliveryPromises);

      console.log('All material deliveries created successfully:', results);

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
      } else if (error.message?.includes('Error de autenticación')) {
        errorMessage = "Error de autenticación. Por favor vuelve a iniciar sesión.";
      } else if (error.code === 'PGRST301') {
        errorMessage = "Error de permisos. Contacta al administrador del sistema.";
      } else if (error.code === '42501') {
        errorMessage = "No tienes permisos para realizar esta acción.";
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
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
      console.log('Fetching material deliveries...');
      
      const { data, error } = await supabase
        .from('material_deliveries')
        .select(`
          *,
          materials (
            name,
            sku,
            unit,
            category,
            color
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
