import { useState, useEffect, useMemo } from 'react';
import { useWorkshops, Workshop } from './useWorkshops';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WorkshopWithStats extends Workshop {
  stats: {
    unitsDeliveredLastWeek: number;
    qualityScore: number;
    activeOrders: number;
  };
}

export const useWorkshopsWithStats = () => {
  const { workshops, loading: workshopsLoading, deleteWorkshop, refetch } = useWorkshops();
  const [workshopsWithStats, setWorkshopsWithStats] = useState<WorkshopWithStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const { toast } = useToast();

  const fetchAllWorkshopStats = async (workshopList: Workshop[]) => {
    if (workshopList.length === 0) return;
    
    try {
      setStatsLoading(true);
      
      // Fecha de hace una semana
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoString = oneWeekAgo.toISOString().split('T')[0];

      const statsPromises = workshopList.map(async (workshop) => {
        try {
          // Obtener asignaciones con órdenes activas
          const { data: assignments } = await supabase
            .from('workshop_assignments')
            .select(`
              *,
              orders!inner(
                id,
                status
              )
            `)
            .eq('workshop_id', workshop.id)
            .in('orders.status', ['assigned', 'in_progress']);

          // Calcular unidades pendientes por entregar (ordenadas - aprobadas)
          let pendingUnits = 0;
          if (assignments && assignments.length > 0) {
            const activeOrderIds = assignments.map(a => a.orders?.id).filter(Boolean);
            
            if (activeOrderIds.length > 0) {
              const { data: pendingUnitsData } = await supabase
                .from('order_items')
                .select(`
                  quantity,
                  delivery_items!left(quantity_approved)
                `)
                .in('order_id', activeOrderIds);

              pendingUnitsData?.forEach(item => {
                const totalOrdered = item.quantity || 0;
                const totalApproved = item.delivery_items?.reduce((sum: number, di: any) => 
                  sum + (di.quantity_approved || 0), 0) || 0;
                pendingUnits += Math.max(0, totalOrdered - totalApproved);
              });
            }
          }

          // Obtener entregas de la última semana
          const { data: lastWeekDeliveries } = await supabase
            .from('deliveries')
            .select(`
              delivery_items(quantity_delivered)
            `)
            .eq('workshop_id', workshop.id)
            .gte('delivery_date', oneWeekAgoString);

          // Obtener todas las entregas para calcular calidad
          const { data: allDeliveries } = await supabase
            .from('deliveries')
            .select(`
              delivery_items(quantity_delivered, quantity_approved)
            `)
            .eq('workshop_id', workshop.id);

          // Calcular unidades entregadas última semana
          let unitsDeliveredLastWeek = 0;
          if (lastWeekDeliveries) {
            lastWeekDeliveries.forEach(delivery => {
              delivery.delivery_items?.forEach(item => {
                unitsDeliveredLastWeek += item.quantity_delivered || 0;
              });
            });
          }

          // Calcular score de calidad
          let qualityScore = 0;
          if (allDeliveries && allDeliveries.length > 0) {
            let totalDelivered = 0;
            let totalApproved = 0;
            
            allDeliveries.forEach(delivery => {
              delivery.delivery_items?.forEach(item => {
                totalDelivered += item.quantity_delivered || 0;
                totalApproved += item.quantity_approved || 0;
              });
            });

            if (totalDelivered > 0) {
              qualityScore = Math.round((totalApproved / totalDelivered) * 100);
            }
          }

          return {
            ...workshop,
            stats: {
              unitsDeliveredLastWeek,
              qualityScore,
              activeOrders: pendingUnits
            }
          };
        } catch (error) {
          console.error(`Error fetching stats for workshop ${workshop.id}:`, error);
          return {
            ...workshop,
            stats: {
              unitsDeliveredLastWeek: 0,
              qualityScore: 0,
              activeOrders: 0
            }
          };
        }
      });

      const results = await Promise.all(statsPromises);
      setWorkshopsWithStats(results);
    } catch (error: any) {
      console.error('Error fetching workshop stats:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas de los talleres",
        variant: "destructive",
      });
    } finally {
      setStatsLoading(false);
    }
  };

  // Ordenar talleres por unidades entregadas última semana (mayor a menor)
  const sortedWorkshopsWithStats = useMemo(() => {
    return [...workshopsWithStats].sort((a, b) => 
      b.stats.unitsDeliveredLastWeek - a.stats.unitsDeliveredLastWeek
    );
  }, [workshopsWithStats]);

  useEffect(() => {
    if (!workshopsLoading && workshops.length > 0) {
      fetchAllWorkshopStats(workshops);
    } else if (!workshopsLoading && workshops.length === 0) {
      setWorkshopsWithStats([]);
    }
  }, [workshops, workshopsLoading]);

  return {
    workshops: sortedWorkshopsWithStats,
    loading: workshopsLoading || statsLoading,
    deleteWorkshop,
    refetch: async () => {
      await refetch();
    }
  };
};