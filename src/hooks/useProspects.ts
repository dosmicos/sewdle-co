import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { WorkshopProspect, ProspectStage } from '@/types/prospects';
import { toast } from 'sonner';

// Helper para convertir stages obsoletos
const normalizeProspectStage = (stage: string): ProspectStage => {
  // Convertir 'sample_requested' a 'sample_in_progress'
  if (stage === 'sample_requested') {
    return 'sample_in_progress';
  }
  return stage as ProspectStage;
};

const normalizeProspect = (prospect: any): WorkshopProspect => ({
  ...prospect,
  stage: normalizeProspectStage(prospect.stage),
});

export const useProspects = () => {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<WorkshopProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProspects = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('workshop_prospects')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setProspects((data || []).map(normalizeProspect));
    } catch (err: any) {
      console.error('Error fetching prospects:', err);
      setError(err.message);
      toast.error('Error al cargar prospectos');
    } finally {
      setLoading(false);
    }
  };

  const createProspect = async (prospectData: Partial<WorkshopProspect> & { 
    name: string;
    organization_id: string;
  }) => {
    try {
      const { data, error: createError } = await supabase
        .from('workshop_prospects')
        .insert([{
          ...prospectData,
          created_by: user?.id,
        }])
        .select()
        .single();

      if (createError) throw createError;

      setProspects(prev => [normalizeProspect(data), ...prev]);
      toast.success('Prospecto creado exitosamente');
      return { data, error: null };
    } catch (err: any) {
      console.error('Error creating prospect:', err);
      toast.error('Error al crear prospecto');
      return { data: null, error: err.message };
    }
  };

  const updateProspect = async (id: string, updates: Partial<WorkshopProspect>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('workshop_prospects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      setProspects(prev => prev.map(p => p.id === id ? normalizeProspect(data) : p));
      toast.success('Prospecto actualizado');
      return { data, error: null };
    } catch (err: any) {
      console.error('Error updating prospect:', err);
      toast.error('Error al actualizar prospecto');
      return { data: null, error: err.message };
    }
  };

  const deleteProspect = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('workshop_prospects')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setProspects(prev => prev.filter(p => p.id !== id));
      toast.success('Prospecto eliminado');
      return { error: null };
    } catch (err: any) {
      console.error('Error deleting prospect:', err);
      toast.error('Error al eliminar prospecto');
      return { error: err.message };
    }
  };

  useEffect(() => {
    if (user) {
      fetchProspects();
    }
  }, [user]);

  return {
    prospects,
    loading,
    error,
    createProspect,
    updateProspect,
    deleteProspect,
    refetch: fetchProspects,
  };
};
