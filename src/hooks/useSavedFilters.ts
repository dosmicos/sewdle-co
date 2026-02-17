import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  is_shared: boolean;
  user_id: string;
  created_at: string;
}

export const useSavedFilters = () => {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSavedFilters = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_picking_filters')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;
      setSavedFilters((data || []).map(item => ({
        ...item,
        filters: item.filters as Record<string, unknown>
      })));
    } catch (error: unknown) {
      toast.error('Error al cargar filtros guardados');
      console.error('Error fetching saved filters:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const saveFilter = async (name: string, filters: Record<string, unknown>, isShared: boolean = false) => {
    if (!organizationId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data, error } = await supabase
        .from('saved_picking_filters')
        .insert([{
          organization_id: organizationId,
          user_id: user.id,
          name,
          filters: filters as unknown as Json,
          is_shared: isShared
        }])
        .select()
        .single();

      if (error) throw error;
      
      toast.success(`Filtro "${name}" guardado exitosamente`);
      await fetchSavedFilters();
      return data;
    } catch (error: unknown) {
      toast.error('Error al guardar filtro');
      console.error('Error saving filter:', error);
    }
  };

  const deleteFilter = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_picking_filters')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Filtro eliminado');
      await fetchSavedFilters();
    } catch (error: unknown) {
      toast.error('Error al eliminar filtro');
      console.error('Error deleting filter:', error);
    }
  };

  const updateFilter = async (id: string, name: string, filters: Record<string, unknown>) => {
    try {
      const { error } = await supabase
        .from('saved_picking_filters')
        .update({ name, filters: filters as unknown as Json, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Filtro actualizado');
      await fetchSavedFilters();
    } catch (error: unknown) {
      toast.error('Error al actualizar filtro');
      console.error('Error updating filter:', error);
    }
  };

  useEffect(() => {
    fetchSavedFilters();
  }, [fetchSavedFilters]);

  return {
    savedFilters,
    loading,
    saveFilter,
    deleteFilter,
    updateFilter,
    refetch: fetchSavedFilters
  };
};
