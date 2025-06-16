
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
      console.log('Fetching workshops...');
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session?.user?.id);
      
      if (!session?.user) {
        console.error('User not authenticated');
        toast({
          title: "Error",
          description: "Debes iniciar sesión para ver los talleres",
          variant: "destructive",
        });
        return;
      }
      
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Workshops fetched:', data?.length);
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
      console.log('=== STARTING WORKSHOP CREATION ===');
      console.log('Workshop data received:', workshopData);
      
      // Check authentication status in detail
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Session check:', { 
        hasSession: !!session, 
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        sessionError 
      });
      
      if (!session?.user) {
        throw new Error('Usuario no autenticado');
      }

      // Log the exact data being sent
      console.log('Data being inserted:', JSON.stringify(workshopData, null, 2));
      
      // Try the insert with detailed error logging
      console.log('Attempting to insert workshop...');
      const { data, error } = await supabase
        .from('workshops')
        .insert(workshopData)
        .select()
        .single();

      console.log('Insert result:', { data, error });

      if (error) {
        console.error('=== SUPABASE INSERT ERROR ===');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        throw error;
      }

      console.log('Workshop created successfully:', data);
      setWorkshops(prev => [data, ...prev]);
      toast({
        title: "Éxito",
        description: "Taller creado correctamente",
      });
      return { data, error: null };
    } catch (error: any) {
      console.error('=== WORKSHOP CREATION ERROR ===');
      console.error('Error type:', typeof error);
      console.error('Error message:', error?.message);
      console.error('Full error:', error);
      
      let errorMessage = "No se pudo crear el taller";
      
      if (error.message?.includes('Usuario no autenticado')) {
        errorMessage = "Debes iniciar sesión para crear talleres.";
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
      return { data: null, error };
    }
  };

  const updateWorkshop = async (id: string, updates: WorkshopUpdate) => {
    try {
      console.log('Updating workshop:', id, updates);
      
      const { data, error } = await supabase
        .from('workshops')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

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
      console.log('Deleting workshop:', id);
      
      const { error } = await supabase
        .from('workshops')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }

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
