import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';

export type PhaseType = 
  | 'order_received'
  | 'supplies_packed'
  | 'caps_sent_embroidery'
  | 'embroidered_caps_received'
  | 'final_production_delivered';

export interface TimelinePhase {
  id: string;
  order_id: string;
  phase_type: PhaseType;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export const useOrderTimeline = (orderId: string) => {
  const [phases, setPhases] = useState<TimelinePhase[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  const fetchPhases = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('order_timeline_phases')
        .select('*')
        .eq('order_id', orderId)
        .order('phase_type');

      if (error) throw error;

      setPhases((data || []) as TimelinePhase[]);
    } catch (error: any) {
      console.error('Error fetching timeline phases:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las fases del timeline',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePhase = async (
    phaseType: PhaseType,
    completed: boolean,
    notes?: string
  ) => {
    if (!orderId || !currentOrganization) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuario no autenticado');

      // Check if phase exists
      const existingPhase = phases.find((p) => p.phase_type === phaseType);

      if (existingPhase) {
        // Update existing phase
        const { error } = await supabase
          .from('order_timeline_phases')
          .update({
            completed_at: completed ? new Date().toISOString() : null,
            completed_by: completed ? user.user.id : null,
            notes: notes || null,
          })
          .eq('id', existingPhase.id);

        if (error) throw error;
      } else {
        // Create new phase
        const { error } = await supabase
          .from('order_timeline_phases')
          .insert({
            order_id: orderId,
            phase_type: phaseType,
            completed_at: completed ? new Date().toISOString() : null,
            completed_by: completed ? user.user.id : null,
            notes: notes || null,
            organization_id: currentOrganization.id,
          });

        if (error) throw error;
      }

      await fetchPhases();

      toast({
        title: 'Fase actualizada',
        description: 'La fase del timeline ha sido actualizada correctamente',
      });
    } catch (error: any) {
      console.error('Error updating timeline phase:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la fase del timeline',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchPhases();
  }, [orderId]);

  return {
    phases,
    loading,
    updatePhase,
    refetch: fetchPhases,
  };
};