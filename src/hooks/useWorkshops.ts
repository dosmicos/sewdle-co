
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

  useEffect(() => {
    fetchWorkshops();
  }, []);

  return {
    workshops,
    loading,
    error,
    refetch: fetchWorkshops
  };
};
