
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

      // Verify user role before proceeding
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (roleError && roleError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking user role:', roleError);
      }

      console.log('User role:', userRole?.role || 'no role assigned');

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
      
      // Enhanced error handling with more specific messages
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
        
        // Enhanced error handling for fetch operations
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
        
        throw error;
      }

      console.log('Fetched material deliveries:', data?.length || 0, 'records');
      return data || [];
    } catch (error) {
      console.error('Error fetching material deliveries:', error);
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
