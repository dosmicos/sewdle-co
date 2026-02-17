import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

// Hook personalizado para queries que requieren organización
export const useOrganizationQuery = <T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
  }
) => {
  const { currentOrganization } = useOrganization();
  
  return useQuery({
    queryKey: [currentOrganization?.id, ...queryKey],
    queryFn,
    enabled: !!currentOrganization && (options?.enabled !== false),
    staleTime: options?.staleTime || 5 * 60 * 1000, // 5 minutos por defecto
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
  });
};

// Hook para mutations que afectan datos de organización
export const useOrganizationMutation = <TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    invalidateQueries?: string[];
  }
) => {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      // Invalidar queries relacionadas con la organización
      if (currentOrganization) {
        const queriesToInvalidate = options?.invalidateQueries || [];
        queriesToInvalidate.forEach(queryKey => {
          queryClient.invalidateQueries({
            queryKey: [currentOrganization.id, queryKey]
          });
        });
      }
      
      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      console.error('Mutation error:', error);
      toast.error('Error al realizar la operación');
      options?.onError?.(error, variables);
    }
  });
};

// Hook específico para obtener datos filtrados por organización
export const useOrganizationData = () => {
  const { currentOrganization } = useOrganization();

  // Función helper para agregar filtro de organización a queries
  const withOrganizationFilter = <T extends Record<string, unknown>>(
    query: unknown,
    options?: { 
      table?: string;
      column?: string;
    }
  ) => {
    if (!currentOrganization) {
      throw new Error('No organization context available');
    }

    const column = options?.column || 'organization_id';
    return query.eq(column, currentOrganization.id);
  };

  // Queries comunes con filtro de organización
  const getOrders = () => {
    if (!currentOrganization) return Promise.resolve([]);
    
    return supabase
      .from('orders')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false });
  };

  const getProducts = () => {
    if (!currentOrganization) return Promise.resolve([]);
    
    return supabase
      .from('products')
      .select(`
        *,
        product_variants(*)
      `)
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false });
  };

  const getWorkshops = () => {
    if (!currentOrganization) return Promise.resolve([]);
    
    return supabase
      .from('workshops')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('name', { ascending: true });
  };

  const getDeliveries = () => {
    if (!currentOrganization) return Promise.resolve([]);
    
    return supabase
      .from('deliveries')
      .select(`
        *,
        orders(order_number),
        workshops(name)
      `)
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false });
  };

  const getMaterials = () => {
    if (!currentOrganization) return Promise.resolve([]);
    
    return supabase
      .from('materials')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('name', { ascending: true });
  };

  return {
    currentOrganization,
    withOrganizationFilter,
    getOrders,
    getProducts,
    getWorkshops,
    getDeliveries,
    getMaterials
  };
};