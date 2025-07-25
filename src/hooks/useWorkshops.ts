
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Workshop {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  status: 'active' | 'inactive';
  capacity: number;
  specialties: string[];
  workingHoursStart?: string;
  workingHoursEnd?: string;
  notes?: string;
  paymentMethod: 'approved' | 'delivered';
  createdAt: string;
  updatedAt: string;
}

export const useWorkshops = () => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchWorkshops = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: workshopsError } = await supabase
        .from('workshops')
        .select('*')
        .order('name');

      if (workshopsError) {
        throw workshopsError;
      }

      const formattedWorkshops: Workshop[] = data?.map((workshop: any) => ({
        id: workshop.id,
        name: workshop.name,
        address: workshop.address,
        city: workshop.city,
        phone: workshop.phone,
        email: workshop.email,
        contactPerson: workshop.contact_person,
        status: workshop.status,
        capacity: workshop.capacity || 0,
        specialties: workshop.specialties || [],
        workingHoursStart: workshop.working_hours_start,
        workingHoursEnd: workshop.working_hours_end,
        notes: workshop.notes,
        paymentMethod: workshop.payment_method || 'approved',
        createdAt: workshop.created_at,
        updatedAt: workshop.updated_at
      })) || [];

      setWorkshops(formattedWorkshops);
    } catch (err: any) {
      console.error('Error fetching workshops:', err);
      setError(err.message || 'Error al cargar talleres');
      toast({
        title: "Error",
        description: "No se pudieron cargar los talleres",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createWorkshop = async (workshopData: {
    name: string;
    address?: string;
    city?: string;
    phone?: string;
    email?: string;
    contact_person?: string;
    specialties?: string[];
    notes?: string;
    status: 'active' | 'inactive';
    payment_method?: 'approved' | 'delivered';
  }) => {
    try {
      const { data, error } = await supabase
        .from('workshops')
        .insert({
          name: workshopData.name,
          address: workshopData.address,
          city: workshopData.city,
          phone: workshopData.phone,
          email: workshopData.email,
          contact_person: workshopData.contact_person,
          specialties: workshopData.specialties || [],
          notes: workshopData.notes,
          status: workshopData.status,
          payment_method: workshopData.payment_method || 'approved'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Taller creado",
        description: `El taller "${workshopData.name}" ha sido creado exitosamente`,
      });

      return { error: null };
    } catch (err: any) {
      console.error('Error creating workshop:', err);
      toast({
        title: "Error al crear taller",
        description: err.message || "Hubo un problema al crear el taller",
        variant: "destructive",
      });
      return { error: err.message };
    }
  };

  const deleteWorkshop = async (workshopId: string) => {
    try {
      const { error } = await supabase
        .from('workshops')
        .delete()
        .eq('id', workshopId);

      if (error) {
        throw error;
      }

      // Actualizar el estado local inmediatamente
      setWorkshops(prev => prev.filter(workshop => workshop.id !== workshopId));
      
      toast({
        title: "Taller eliminado",
        description: "El taller ha sido eliminado correctamente",
      });

      return { success: true };
    } catch (err: any) {
      console.error('Error deleting workshop:', err);
      toast({
        title: "Error al eliminar taller",
        description: err.message || "Hubo un problema al eliminar el taller",
        variant: "destructive",
      });
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchWorkshops();
  }, []);

  return {
    workshops,
    loading,
    error,
    createWorkshop,
    deleteWorkshop,
    refetch: fetchWorkshops
  };
};
