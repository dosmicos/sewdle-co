import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OrderAdvance {
  id: string;
  order_id: string;
  workshop_id: string;
  amount: number;
  currency: string;
  advance_date: string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
  receipt_url?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  workshop_name?: string;
  order_number?: string;
}

export interface OrderAdvanceInsert {
  order_id: string;
  workshop_id: string;
  amount: number;
  currency?: string;
  advance_date: string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
  receipt_url?: string;
}

export const useOrderAdvances = () => {
  const [advances, setAdvances] = useState<OrderAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('order_advances')
        .select(`
          *,
          workshops!order_advances_workshop_id_fkey(name),
          orders!order_advances_order_id_fkey(order_number)
        `)
        .order('advance_date', { ascending: false });

      if (error) throw error;

      const transformedData = data?.map(item => ({
        ...item,
        workshop_name: item.workshops?.name,
        order_number: item.orders?.order_number
      })) || [];

      setAdvances(transformedData);
    } catch (error) {
      console.error('Error fetching order advances:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los anticipos"
      });
    } finally {
      setLoading(false);
    }
  };

  const createAdvance = async (newAdvance: OrderAdvanceInsert) => {
    try {
      const { data, error } = await supabase
        .from('order_advances')
        .insert({
          ...newAdvance,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Anticipo creado",
        description: "El anticipo ha sido registrado correctamente"
      });

      fetchAdvances();
      return data;
    } catch (error) {
      console.error('Error creating advance:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear el anticipo"
      });
      throw error;
    }
  };

  const updateAdvance = async (id: string, updates: Partial<OrderAdvanceInsert>) => {
    try {
      const { error } = await supabase
        .from('order_advances')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Anticipo actualizado",
        description: "El anticipo ha sido actualizado correctamente"
      });

      fetchAdvances();
    } catch (error) {
      console.error('Error updating advance:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el anticipo"
      });
      throw error;
    }
  };

  const deleteAdvance = async (id: string) => {
    try {
      const { error } = await supabase
        .from('order_advances')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Anticipo eliminado",
        description: "El anticipo ha sido eliminado correctamente"
      });

      fetchAdvances();
    } catch (error) {
      console.error('Error deleting advance:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el anticipo"
      });
      throw error;
    }
  };

  const getAdvancesByOrder = (orderId: string) => {
    return advances.filter(advance => advance.order_id === orderId);
  };

  const getAdvancesByWorkshop = (workshopId: string) => {
    return advances.filter(advance => advance.workshop_id === workshopId);
  };

  const getTotalAdvancesByOrderAndWorkshop = (orderId: string, workshopId: string) => {
    return advances
      .filter(advance => advance.order_id === orderId && advance.workshop_id === workshopId)
      .reduce((total, advance) => total + advance.amount, 0);
  };

  useEffect(() => {
    fetchAdvances();
  }, []);

  return {
    advances,
    loading,
    createAdvance,
    updateAdvance,
    deleteAdvance,
    getAdvancesByOrder,
    getAdvancesByWorkshop,
    getTotalAdvancesByOrderAndWorkshop,
    refetch: fetchAdvances
  };
};