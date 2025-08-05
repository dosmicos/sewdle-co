
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type WorkshopAssignment = Database['public']['Tables']['workshop_assignments']['Row'];
type WorkshopAssignmentInsert = Database['public']['Tables']['workshop_assignments']['Insert'];
type WorkshopAssignmentUpdate = Database['public']['Tables']['workshop_assignments']['Update'];

interface WorkshopCapacityStats {
  workshop_id: string;
  workshop_name: string;
  total_capacity: number;
  current_assignments: number;
  available_capacity: number;
  completion_rate: number;
}

interface AvailableOrder {
  id: string;
  order_number: string;
  client_name: string;
  due_date: string | null;
  total_amount: number | null;
  status: string | null;
  created_at: string;
}

export const useWorkshopAssignments = (autoFetch: boolean = true) => {
  const [assignments, setAssignments] = useState<WorkshopAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workshop_assignments')
        .select(`
          *,
          orders:order_id(order_number, client_name, due_date, total_amount),
          workshops:workshop_id(name, capacity)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las asignaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createAssignment = async (assignmentData: WorkshopAssignmentInsert) => {
    try {
      setLoading(true); // Agregar loading state
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener la organización actual del usuario
      const { data: orgData, error: orgError } = await supabase.rpc('get_current_organization_safe');
      
      if (orgError || !orgData) {
        console.error('Error getting organization:', orgError);
        throw new Error('No se pudo obtener la organización del usuario');
      }

      const { data, error } = await supabase
        .from('workshop_assignments')
        .insert({
          ...assignmentData,
          assigned_by: session.user.id,
          organization_id: orgData // Agregar organization_id requerido por RLS
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      toast({
        title: "Éxito",
        description: "Asignación creada correctamente",
      });
      return { data, error: null };
    } catch (error: any) {
      console.error('Error creating assignment:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la asignación",
        variant: "destructive",
      });
      return { data: null, error };
    } finally {
      setLoading(false); // Asegurar que loading se resetee
    }
  };

  const updateAssignment = async (id: string, updates: WorkshopAssignmentUpdate) => {
    try {
      const { data, error } = await supabase
        .from('workshop_assignments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await fetchAssignments();
      toast({
        title: "Éxito",
        description: "Asignación actualizada correctamente",
      });
      return { data, error: null };
    } catch (error: any) {
      console.error('Error updating assignment:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la asignación",
        variant: "destructive",
      });
      return { data: null, error };
    }
  };

  const deleteAssignment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('workshop_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchAssignments();
      toast({
        title: "Éxito",
        description: "Asignación eliminada correctamente",
      });
      return { error: null };
    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la asignación",
        variant: "destructive",
      });
      return { error };
    }
  };

  const getWorkshopCapacityStats = async (): Promise<WorkshopCapacityStats[]> => {
    try {
      const { data, error } = await supabase.rpc('get_workshop_capacity_stats');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching capacity stats:', error);
      return [];
    }
  };

  const getAvailableOrders = async (): Promise<AvailableOrder[]> => {
    try {
      const { data, error } = await supabase.rpc('get_available_orders');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching available orders:', error);
      return [];
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchAssignments();
    }
  }, [autoFetch]);

  return {
    assignments,
    loading,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    getWorkshopCapacityStats,
    getAvailableOrders,
    refetch: fetchAssignments
  };
};
