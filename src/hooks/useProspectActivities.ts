import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProspectActivity } from '@/types/prospects';
import { toast } from 'sonner';

export const useProspectActivities = (prospectId?: string) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ProspectActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = async (id: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('prospect_activities')
        .select('*')
        .eq('prospect_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setActivities(data || []);
    } catch (err: any) {
      console.error('Error fetching activities:', err);
      toast.error('Error al cargar actividades');
    } finally {
      setLoading(false);
    }
  };

  const createActivity = async (activityData: Partial<ProspectActivity> & { 
    activity_type: ProspectActivity['activity_type'];
    title: string;
    prospect_id: string;
    organization_id: string;
  }) => {
    try {
      const { data, error } = await supabase
        .from('prospect_activities')
        .insert([{
          ...activityData,
          created_by: user?.id,
        }])
        .select()
        .single();

      if (error) throw error;

      setActivities(prev => [data, ...prev]);
      toast.success('Actividad registrada');
      return { data, error: null };
    } catch (err: any) {
      console.error('Error creating activity:', err);
      toast.error('Error al registrar actividad');
      return { data: null, error: err.message };
    }
  };

  const updateActivity = async (id: string, updates: Partial<ProspectActivity>) => {
    try {
      const { data, error } = await supabase
        .from('prospect_activities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setActivities(prev => prev.map(a => a.id === id ? data : a));
      toast.success('Actividad actualizada');
      return { data, error: null };
    } catch (err: any) {
      console.error('Error updating activity:', err);
      toast.error('Error al actualizar actividad');
      return { data: null, error: err.message };
    }
  };

  useEffect(() => {
    if (prospectId) {
      fetchActivities(prospectId);
    }
  }, [prospectId]);

  return {
    activities,
    loading,
    createActivity,
    updateActivity,
    refetch: prospectId ? () => fetchActivities(prospectId) : () => {},
  };
};
