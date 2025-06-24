
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/hooks/useUserContext';

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

interface MaterialDeliveryWithBalance {
  id: string;
  material_id: string;
  workshop_id: string;
  order_id?: string;
  delivery_date: string;
  delivered_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  total_delivered: number;
  total_consumed: number;
  real_balance: number;
  material_name: string;
  material_sku: string;
  material_unit: string;
  material_color?: string;
  material_category: string;
  workshop_name: string;
  order_number?: string;
}

export const useMaterialDeliveries = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { workshopFilter, isAdmin } = useUserContext();

  const createMaterialDelivery = async (deliveryData: MaterialDeliveryData) => {
    setLoading(true);
    try {
      console.log('Creating material delivery with data:', deliveryData);

      // Enhanced authentication check
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Error de autenticación: ' + sessionError.message);
      }
      
      if (!session?.user) {
        console.error('No session found');
        throw new Error('Usuario no autenticado. Por favor inicia sesión.');
      }

      console.log('User authenticated:', session.user.id);

      // Create material deliveries for each material
      const deliveryPromises = deliveryData.materials.map(async (material, index) => {
        const deliveryRecord = {
          material_id: material.materialId,
          workshop_id: deliveryData.workshopId,
          order_id: deliveryData.orderId || null,
          quantity_delivered: material.quantity,
          quantity_remaining: material.quantity,
          delivered_by: session.user.id,
          notes: material.notes || deliveryData.notes || null
        };

        console.log(`Creating delivery ${index + 1}/${deliveryData.materials.length}:`, deliveryRecord);

        const { data, error } = await supabase
          .from('material_deliveries')
          .insert(deliveryRecord)
          .select()
          .single();

        if (error) {
          console.error(`Error creating material delivery ${index + 1}:`, error);
          console.error('Full error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            deliveryRecord
          });
          throw new Error(`Error en entrega ${index + 1}: ${error.message}`);
        }

        console.log(`Material delivery ${index + 1} created successfully:`, data);
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
      } else if (error.code === 'PGRST301' || error.message?.includes('policy')) {
        errorMessage = "Sin permisos: Tu usuario no tiene autorización para registrar entregas de materiales. Contacta al administrador.";
      } else if (error.code === '42501') {
        errorMessage = "Permisos insuficientes: No tienes autorización para realizar esta acción.";
      } else if (error.code === 'PGRST116') {
        errorMessage = "Datos no encontrados: Verifica que el taller y materiales seleccionados existan.";
      } else if (error.message?.includes('foreign key constraint')) {
        errorMessage = "Error de datos: Verifica que el taller, material u orden seleccionados sean válidos.";
      } else if (error.message?.includes('violates not-null constraint')) {
        errorMessage = "Datos incompletos: Faltan campos obligatorios en el formulario.";
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      toast({
        title: "Error al registrar entrega",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterialDeliveries = async (): Promise<MaterialDeliveryWithBalance[]> => {
    setLoading(true);
    try {
      console.log('Fetching material deliveries with workshop filter:', { workshopFilter, isAdmin });
      
      // Construir la consulta base
      let query = supabase.rpc('get_material_deliveries_with_real_balance');
      
      // Si no es admin y tiene workshopFilter, filtrar por taller
      if (!isAdmin && workshopFilter) {
        // Filtrar los resultados por workshop_id después de obtenerlos
        const { data: allDeliveries, error } = await query.order('delivery_date', { ascending: false });

        if (error) {
          console.error('Error fetching material deliveries:', error);
          throw error;
        }

        // Filtrar manualmente por workshop_id
        const filteredDeliveries = allDeliveries?.filter(delivery => 
          delivery.workshop_id === workshopFilter
        ) || [];

        console.log('Material deliveries filtered by workshop:', filteredDeliveries.length, 'of', allDeliveries?.length || 0);
        return filteredDeliveries;
      } else {
        // Si es admin, mostrar todos
        const { data: deliveries, error } = await query.order('delivery_date', { ascending: false });

        if (error) {
          console.error('Error fetching material deliveries:', error);
          throw error;
        }

        console.log('Material deliveries (admin view):', deliveries?.length || 0);
        return deliveries || [];
      }

    } catch (error: any) {
      console.error('Error in fetchMaterialDeliveries:', error);
      
      let errorMessage = "No se pudieron cargar las entregas de materiales.";
      
      if (error.code === 'PGRST301' || error.message?.includes('policy')) {
        errorMessage = "Sin permisos para ver las entregas. Contacta al administrador.";
      } else if (error.message) {
        errorMessage = `Error al cargar datos: ${error.message}`;
      }
      
      toast({
        title: "Error al cargar entregas",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Return empty array instead of throwing to prevent UI crashes
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
