
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

  const fetchMaterialDeliveries = async () => {
    setLoading(true);
    try {
      console.log('Step 1: Fetching basic material deliveries...');
      
      // Step 1: Get basic material deliveries first
      const { data: basicDeliveries, error: basicError } = await supabase
        .from('material_deliveries')
        .select('*')
        .order('created_at', { ascending: false });

      if (basicError) {
        console.error('Error fetching basic material deliveries:', basicError);
        throw basicError;
      }

      console.log('Step 1 completed: Basic deliveries fetched:', basicDeliveries?.length || 0);

      if (!basicDeliveries || basicDeliveries.length === 0) {
        console.log('No material deliveries found');
        return [];
      }

      // Step 2: Get materials data
      console.log('Step 2: Fetching materials data...');
      const materialIds = [...new Set(basicDeliveries.map(d => d.material_id).filter(Boolean))];
      
      let materialsData = [];
      if (materialIds.length > 0) {
        const { data: materials, error: materialsError } = await supabase
          .from('materials')
          .select('id, name, sku, unit, category, color')
          .in('id', materialIds);

        if (materialsError) {
          console.error('Error fetching materials:', materialsError);
          // Continue without materials data instead of failing
        } else {
          materialsData = materials || [];
          console.log('Step 2 completed: Materials fetched:', materialsData.length);
        }
      }

      // Step 3: Get workshops data
      console.log('Step 3: Fetching workshops data...');
      const workshopIds = [...new Set(basicDeliveries.map(d => d.workshop_id).filter(Boolean))];
      
      let workshopsData = [];
      if (workshopIds.length > 0) {
        const { data: workshops, error: workshopsError } = await supabase
          .from('workshops')
          .select('id, name')
          .in('id', workshopIds);

        if (workshopsError) {
          console.error('Error fetching workshops:', workshopsError);
          // Continue without workshops data instead of failing
        } else {
          workshopsData = workshops || [];
          console.log('Step 3 completed: Workshops fetched:', workshopsData.length);
        }
      }

      // Step 4: Get orders data
      console.log('Step 4: Fetching orders data...');
      const orderIds = [...new Set(basicDeliveries.map(d => d.order_id).filter(Boolean))];
      
      let ordersData = [];
      if (orderIds.length > 0) {
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, order_number')
          .in('id', orderIds);

        if (ordersError) {
          console.error('Error fetching orders:', ordersError);
          // Continue without orders data instead of failing
        } else {
          ordersData = orders || [];
          console.log('Step 4 completed: Orders fetched:', ordersData.length);
        }
      }

      // Step 5: Combine all data
      console.log('Step 5: Combining all data...');
      const enrichedDeliveries = basicDeliveries.map(delivery => {
        const material = materialsData.find(m => m.id === delivery.material_id);
        const workshop = workshopsData.find(w => w.id === delivery.workshop_id);
        const order = ordersData.find(o => o.id === delivery.order_id);

        return {
          ...delivery,
          materials: material || null,
          workshops: workshop || null,
          orders: order || null
        };
      });

      console.log('Step 5 completed: Final data prepared:', enrichedDeliveries.length);
      return enrichedDeliveries;

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
