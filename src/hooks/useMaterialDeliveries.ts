
import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/hooks/useUserContext';
import { extractRollNumberFromNotes } from '@/lib/materialRollNumber';

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
    rollNumber?: string;
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
  roll_number?: string;
}

interface IndividualMaterialDelivery {
  id: string;
  material_id: string;
  workshop_id: string;
  order_id?: string;
  delivery_date: string;
  delivered_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  quantity_delivered: number;
  quantity_consumed: number;
  quantity_remaining: number;
  material_name: string;
  material_sku: string;
  material_unit: string;
  material_color?: string;
  material_category: string;
  workshop_name: string;
  order_number?: string;
  roll_number?: string;
}

export const useMaterialDeliveries = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { workshopFilter, isAdmin, isDesigner } = useUserContext();
  const isMountedRef = useRef(true);
  const queryClient = useQueryClient();

  // Cleanup ref cuando el componente se desmonte
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetLoading = useCallback((value: boolean) => {
    if (isMountedRef.current) {
      setLoading(value);
    }
  }, []);

  const createMaterialDeliveryMutation = useMutation({
    mutationFn: async (deliveryData: MaterialDeliveryData) => {
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
        const rollNumber = material.rollNumber?.trim() || extractRollNumberFromNotes(material.notes);
        const deliveryRecord = {
          material_id: material.materialId,
          workshop_id: deliveryData.workshopId,
          order_id: deliveryData.orderId || null,
          quantity_delivered: material.quantity,
          quantity_remaining: material.quantity,
          delivered_by: session.user.id,
          notes: material.notes || deliveryData.notes || null,
          roll_number: rollNumber || null
        };

        console.log(`Creating delivery ${index + 1}/${deliveryData.materials.length}:`, deliveryRecord);

        const { data, error } = await supabase
          .from('material_deliveries')
          .insert(deliveryRecord as any)
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
      return results;
    },
    onSuccess: (results, deliveryData) => {
      if (isMountedRef.current) {
        toast({
          title: "¡Entrega registrada exitosamente!",
          description: `Se registraron ${deliveryData.materials.length} materiales entregados.`,
        });
      }
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['material-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['individual-material-deliveries'] });
    },
    onError: (error: any) => {
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
      
      if (isMountedRef.current) {
        toast({
          title: "Error al registrar entrega",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const createMaterialDelivery = createMaterialDeliveryMutation.mutateAsync;

  const deleteMaterialDelivery = async (deliveryId: string) => {
    safeSetLoading(true);
    try {
      console.log('Deleting material delivery:', deliveryId);

      // Verificar autenticación
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

      // Eliminar la entrega
      const { error } = await supabase
        .from('material_deliveries')
        .delete()
        .eq('id', deliveryId);

      if (error) {
        console.error('Error deleting material delivery:', error);
        console.error('Full error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          deliveryId
        });
        throw new Error(`Error al eliminar entrega: ${error.message}`);
      }

      console.log('Material delivery deleted successfully:', deliveryId);

      if (isMountedRef.current) {
        toast({
          title: "¡Entrega eliminada exitosamente!",
          description: "La entrega de material ha sido eliminada.",
        });
      }

    } catch (error: any) {
      console.error('Error deleting material delivery:', error);
      
      let errorMessage = "No se pudo eliminar la entrega de material";
      
      if (error.message?.includes('Usuario no autenticado')) {
        errorMessage = "Debes iniciar sesión para eliminar entregas.";
      } else if (error.message?.includes('Error de autenticación')) {
        errorMessage = "Error de autenticación. Por favor vuelve a iniciar sesión.";
      } else if (error.code === 'PGRST301' || error.message?.includes('policy')) {
        errorMessage = "Sin permisos: Tu usuario no tiene autorización para eliminar entregas de materiales. Contacta al administrador.";
      } else if (error.code === '42501') {
        errorMessage = "Permisos insuficientes: No tienes autorización para realizar esta acción.";
      } else if (error.message?.includes('foreign key constraint')) {
        errorMessage = "No se puede eliminar: Esta entrega está siendo referenciada por otros registros.";
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      if (isMountedRef.current) {
        toast({
          title: "Error al eliminar entrega",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    } finally {
      safeSetLoading(false);
    }
  };

  const fetchIndividualMaterialDeliveries = useCallback(async (): Promise<IndividualMaterialDelivery[]> => {
    safeSetLoading(true);
    try {
      console.log('=== FETCH INDIVIDUAL MATERIAL DELIVERIES START ===');
      console.log('User context:', { workshopFilter, isAdmin, isDesigner });
      
      // Verificar autenticación
      console.log('Checking authentication...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError);
        throw new Error('Error de autenticación');
      }
      
      if (!session?.user) {
        console.error('❌ No authenticated user');
        throw new Error('Usuario no autenticado');
      }

      console.log('✅ Authenticated user:', {
        id: session.user.id,
        email: session.user.email
      });
      
      // Consulta directa a material_deliveries con joins
      console.log('🔄 Fetching individual material deliveries');
      
      let query = supabase
        .from('material_deliveries')
        .select(`
          id,
          material_id,
          workshop_id,
          order_id,
          delivery_date,
          delivered_by,
          notes,
          roll_number,
          created_at,
          updated_at,
          quantity_delivered,
          quantity_consumed,
          quantity_remaining,
          materials:material_id (
            name,
            sku,
            unit,
            color,
            category
          ),
          workshops:workshop_id (
            name
          ),
          orders:order_id (
            order_number
          )
        `)
        .order('delivery_date', { ascending: false })
        .order('created_at', { ascending: false });

      // Aplicar filtros según rol y contexto
      if (!isAdmin && !isDesigner && workshopFilter) {
        console.log('🏭 Applying workshop filter for regular user:', workshopFilter);
        query = query.eq('workshop_id', workshopFilter);
      }

      const { data: rawData, error } = await query;

      if (error) {
        console.error('❌ Query Error:', error);
        throw error;
      }

      console.log('✅ Query Success - Raw data received:', {
        count: rawData?.length || 0,
        sampleData: rawData?.slice(0, 2)
      });

      if (!rawData || !Array.isArray(rawData)) {
        console.warn('⚠️  Invalid data structure, returning empty array');
        return [];
      }

      // Transformar los datos para el formato esperado
      const transformedData: IndividualMaterialDelivery[] = rawData.map(delivery => ({
        id: delivery.id,
        material_id: delivery.material_id,
        workshop_id: delivery.workshop_id,
        order_id: delivery.order_id,
        delivery_date: delivery.delivery_date,
        delivered_by: delivery.delivered_by,
        notes: delivery.notes,
        roll_number: (delivery as any).roll_number || extractRollNumberFromNotes(delivery.notes) || undefined,
        created_at: delivery.created_at,
        updated_at: delivery.updated_at,
        quantity_delivered: delivery.quantity_delivered,
        quantity_consumed: delivery.quantity_consumed || 0,
        quantity_remaining: delivery.quantity_remaining,
        material_name: delivery.materials?.name || 'N/A',
        material_sku: delivery.materials?.sku || 'N/A',
        material_unit: delivery.materials?.unit || '',
        material_color: delivery.materials?.color,
        material_category: delivery.materials?.category || 'N/A',
        workshop_name: delivery.workshops?.name || 'N/A',
        order_number: delivery.orders?.order_number
      }));

      console.log('✅ Final transformed deliveries:', {
        count: transformedData.length,
        sampleData: transformedData.slice(0, 2)
      });

      console.log('=== FETCH INDIVIDUAL MATERIAL DELIVERIES SUCCESS ===');
      return transformedData;

    } catch (error: any) {
      console.error('=== FETCH INDIVIDUAL MATERIAL DELIVERIES ERROR ===');
      console.error('Error details:', error);
      
      let errorMessage = "No se pudieron cargar las entregas de materiales.";
      
      if (error.message?.includes('Usuario no autenticado')) {
        errorMessage = "Debes iniciar sesión para ver las entregas.";
      } else if (error.message?.includes('Error de autenticación')) {
        errorMessage = "Error de autenticación. Por favor vuelve a iniciar sesión.";
      } else if (error.code === 'PGRST301' || error.message?.includes('policy')) {
        errorMessage = "Sin permisos para ver las entregas. Contacta al administrador.";
      } else if (error.message) {
        errorMessage = `Error al cargar datos: ${error.message}`;
      }
      
      if (isMountedRef.current) {
        toast({
          title: "Error al cargar entregas",
          description: errorMessage,
          variant: "destructive",
        });
      }
      
      console.log('🔄 Returning empty array to prevent UI crashes');
      return [];
    } finally {
      safeSetLoading(false);
      console.log('=== FETCH INDIVIDUAL MATERIAL DELIVERIES COMPLETE ===');
    }
  }, [workshopFilter, isAdmin, isDesigner, toast, safeSetLoading]);

  // Convert to React Query
  const { data: individualDeliveries = [], isLoading: loadingIndividual, refetch: refetchIndividual } = useQuery({
    queryKey: ['individual-material-deliveries', workshopFilter],
    queryFn: fetchIndividualMaterialDeliveries,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });

  const fetchMaterialDeliveries = useCallback(async (): Promise<MaterialDeliveryWithBalance[]> => {
    safeSetLoading(true);
    try {
      console.log('=== FETCH MATERIAL DELIVERIES START ===');
      console.log('User context:', { workshopFilter, isAdmin, isDesigner });
      
      // Verificar autenticación
      console.log('Checking authentication...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError);
        throw new Error('Error de autenticación');
      }
      
      if (!session?.user) {
        console.error('❌ No authenticated user');
        throw new Error('Usuario no autenticado');
      }

      console.log('✅ Authenticated user:', {
        id: session.user.id,
        email: session.user.email
      });
      
      // LLAMADA RPC DIRECTA SIN FILTROS ADICIONALES
      console.log('🔄 Executing RPC: get_material_deliveries_with_real_balance');
      
      const { data: rawData, error } = await supabase
        .rpc('get_material_deliveries_with_real_balance');

      if (error) {
        console.error('❌ RPC Error:', error);
        throw error;
      }

      console.log('✅ RPC Success - Raw data received:', {
        count: rawData?.length || 0,
        data: rawData
      });

      if (!rawData || !Array.isArray(rawData)) {
        console.warn('⚠️  Invalid data structure, returning empty array');
        return [];
      }

      // APLICAR FILTROS SOLO SI ES NECESARIO (SIN MODIFICAR LOS DATOS ORIGINALES)
      let filteredData = rawData;
      
      console.log('🔍 Applying filters...');
      console.log('Filter conditions:', {
        isAdmin,
        isDesigner,
        hasWorkshopFilter: !!workshopFilter,
        workshopFilter
      });

      // Solo filtrar por taller si no es admin/diseñador Y tiene filtro específico
      if (!isAdmin && !isDesigner && workshopFilter) {
        console.log('🏭 Applying workshop filter for regular user:', workshopFilter);
        const beforeFilter = filteredData.length;
        filteredData = rawData.filter(delivery => delivery.workshop_id === workshopFilter);
        console.log(`🔽 Workshop filter: ${beforeFilter} → ${filteredData.length} deliveries`);
      } else {
        console.log('👑 Admin/Designer - showing all deliveries');
      }

      console.log('✅ Final filtered deliveries:', {
        count: filteredData.length,
        sampleData: filteredData.slice(0, 2)
      });

      console.log('=== FETCH MATERIAL DELIVERIES SUCCESS ===');
      return filteredData;

    } catch (error: any) {
      console.error('=== FETCH MATERIAL DELIVERIES ERROR ===');
      console.error('Error details:', error);
      
      let errorMessage = "No se pudieron cargar las entregas de materiales.";
      
      if (error.message?.includes('Usuario no autenticado')) {
        errorMessage = "Debes iniciar sesión para ver las entregas.";
      } else if (error.message?.includes('Error de autenticación')) {
        errorMessage = "Error de autenticación. Por favor vuelve a iniciar sesión.";
      } else if (error.code === 'PGRST301' || error.message?.includes('policy')) {
        errorMessage = "Sin permisos para ver las entregas. Contacta al administrador.";
      } else if (error.message) {
        errorMessage = `Error al cargar datos: ${error.message}`;
      }
      
      if (isMountedRef.current) {
        toast({
          title: "Error al cargar entregas",
          description: errorMessage,
          variant: "destructive",
        });
      }
      
      console.log('🔄 Returning empty array to prevent UI crashes');
      return [];
    } finally {
      safeSetLoading(false);
      console.log('=== FETCH MATERIAL DELIVERIES COMPLETE ===');
    }
  }, [workshopFilter, isAdmin, isDesigner, toast, safeSetLoading]);

  // Convert to React Query
  const { data: materialDeliveries = [], isLoading: loadingDeliveries, refetch: refetchDeliveries } = useQuery({
    queryKey: ['material-deliveries', workshopFilter],
    queryFn: fetchMaterialDeliveries,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });

  return {
    loading: loading || createMaterialDeliveryMutation.isPending || loadingIndividual || loadingDeliveries,
    createMaterialDelivery,
    deleteMaterialDelivery,
    fetchMaterialDeliveries: refetchDeliveries,
    fetchIndividualMaterialDeliveries: refetchIndividual,
    materialDeliveries,
    individualDeliveries
  };
};
