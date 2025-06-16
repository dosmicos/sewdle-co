
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Workshop = Database['public']['Tables']['workshops']['Row'];
type WorkshopInsert = Database['public']['Tables']['workshops']['Insert'];
type WorkshopUpdate = Database['public']['Tables']['workshops']['Update'];

export const useWorkshops = () => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchWorkshops = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error('Error fetching workshops:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los talleres",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createWorkshop = async (workshopData: WorkshopInsert) => {
    try {
      const { data, error } = await supabase
        .from('workshops')
        .insert(workshopData)
        .select()
        .single();

      if (error) throw error;

      setWorkshops(prev => [data, ...prev]);
      toast({
        title: "Éxito",
        description: "Taller creado correctamente",
      });
      return { data, error: null };
    } catch (error) {
      console.error('Error creating workshop:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el taller",
        variant: "destructive",
      });
      return { data: null, error };
    }
  };

  const updateWorkshop = async (id: string, updates: WorkshopUpdate) => {
    try {
      const { data, error } = await supabase
        .from('workshops')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setWorkshops(prev => 
        prev.map(workshop => 
          workshop.id === id ? data : workshop
        )
      );
      toast({
        title: "Éxito",
        description: "Taller actualizado correctamente",
      });
      return { data, error: null };
    } catch (error) {
      console.error('Error updating workshop:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el taller",
        variant: "destructive",
      });
      return { data: null, error };
    }
  };

  const deleteWorkshop = async (id: string) => {
    try {
      const { error } = await supabase
        .from('workshops')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setWorkshops(prev => prev.filter(workshop => workshop.id !== id));
      toast({
        title: "Éxito",
        description: "Taller eliminado correctamente",
      });
      return { error: null };
    } catch (error) {
      console.error('Error deleting workshop:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el taller",
        variant: "destructive",
      });
      return { error };
    }
  };

  useEffect(() => {
    fetchWorkshops();
  }, []);

  return {
    workshops,
    loading,
    createWorkshop,
    updateWorkshop,
    deleteWorkshop,
    refetch: fetchWorkshops
  };
};
