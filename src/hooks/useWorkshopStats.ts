
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WorkshopStats {
  activeOrders: number;
  completionRate: number;
  qualityScore: number;
  onTimeDelivery: number;
}

export const useWorkshopStats = (workshopId: string) => {
  const [stats, setStats] = useState<WorkshopStats>({
    activeOrders: 0,
    completionRate: 0,
    qualityScore: 0,
    onTimeDelivery: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Obtener órdenes activas del taller
      const { data: activeAssignments, error: assignmentsError } = await supabase
        .from('workshop_assignments')
        .select('id')
        .eq('workshop_id', workshopId)
        .in('status', ['assigned', 'in_progress']);

      if (assignmentsError) throw assignmentsError;

      // Obtener todas las entregas del taller para calcular métricas
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select(`
          id,
          status,
          delivery_date,
          orders!inner(due_date),
          delivery_items(quantity_delivered, quantity_approved, quantity_defective)
        `)
        .eq('workshop_id', workshopId);

      if (deliveriesError) throw deliveriesError;

      // Calcular estadísticas
      const activeOrders = activeAssignments?.length || 0;
      
      let completionRate = 0;
      let qualityScore = 0;
      let onTimeDelivery = 0;

      if (deliveries && deliveries.length > 0) {
        // Tasa de finalización (entregas aprobadas vs totales)
        const approvedDeliveries = deliveries.filter(d => d.status === 'approved').length;
        completionRate = Math.round((approvedDeliveries / deliveries.length) * 100);

        // Score de calidad (items aprobados vs total entregado)
        let totalDelivered = 0;
        let totalApproved = 0;
        
        deliveries.forEach(delivery => {
          delivery.delivery_items?.forEach(item => {
            totalDelivered += item.quantity_delivered || 0;
            totalApproved += item.quantity_approved || 0;
          });
        });

        if (totalDelivered > 0) {
          qualityScore = Math.round((totalApproved / totalDelivered) * 5); // Escala de 5
        }

        // Puntualidad (entregas a tiempo vs totales)
        const onTimeDeliveries = deliveries.filter(delivery => {
          if (!delivery.delivery_date || !delivery.orders?.due_date) return false;
          return new Date(delivery.delivery_date) <= new Date(delivery.orders.due_date);
        }).length;

        onTimeDelivery = Math.round((onTimeDeliveries / deliveries.length) * 100);
      }

      setStats({
        activeOrders,
        completionRate,
        qualityScore: Math.min(qualityScore, 5), // Máximo 5
        onTimeDelivery
      });

    } catch (error: any) {
      console.error('Error fetching workshop stats:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas del taller",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workshopId) {
      fetchStats();
    }
  }, [workshopId]);

  return { stats, loading, refetch: fetchStats };
};
