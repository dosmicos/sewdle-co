import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminDashboardStats {
  activeOrders: number;
  unitsInProduction: number;
  unitsDeliveredWeek: number;
  unitsApprovedWeek: number;
}

interface ProductionData {
  period: string;
  delivered: number;
  approved: number;
}

interface WorkshopRanking {
  workshopName: string;
  deliveredUnits: number;
  approvedUnits: number;
  qualityScore: number;
  compositeScore: number;
}


export const useAdminDashboardData = () => {
  const [stats, setStats] = useState<AdminDashboardStats>({
    activeOrders: 0,
    unitsInProduction: 0,
    unitsDeliveredWeek: 0,
    unitsApprovedWeek: 0
  });
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [workshopRanking, setWorkshopRanking] = useState<WorkshopRanking[]>([]);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDashboardStats = async () => {
    try {
      // Active orders count
      const { count: activeOrdersCount, error: ordersError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'assigned', 'in_progress']);

      if (ordersError) throw ordersError;

      // Units in production (total ordered - total approved)
      // Get total units ordered in active orders
      const { data: totalOrderedData, error: totalOrderedError } = await supabase
        .from('order_items')
        .select(`
          quantity,
          orders!inner(status)
        `)
        .in('orders.status', ['pending', 'assigned', 'in_progress']);

      if (totalOrderedError) throw totalOrderedError;

      const totalOrdered = totalOrderedData?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

      // Get total units approved from all deliveries of active orders
      const { data: totalApprovedData, error: totalApprovedError } = await supabase
        .from('delivery_items')
        .select(`
          quantity_approved,
          deliveries!inner(
            order_id,
            orders!inner(status)
          )
        `)
        .in('deliveries.orders.status', ['pending', 'assigned', 'in_progress']);

      if (totalApprovedError) throw totalApprovedError;

      const totalApproved = totalApprovedData?.reduce((sum, item) => sum + (item.quantity_approved || 0), 0) || 0;

      // Units in production = Total ordered - Total approved
      const unitsInProduction = Math.max(0, totalOrdered - totalApproved);

      // Units delivered this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { data: weekDeliveredData, error: weekDeliveredError } = await supabase
        .from('delivery_items')
        .select('quantity_delivered, deliveries!inner(delivery_date)')
        .gte('deliveries.delivery_date', weekAgo.toISOString().split('T')[0]);

      const unitsDeliveredWeek = weekDeliveredData?.reduce((sum, item) => sum + (item.quantity_delivered || 0), 0) || 0;

      // Units approved this week
      const { data: weekApprovedData, error: weekApprovedError } = await supabase
        .from('delivery_items')
        .select('quantity_approved, deliveries!inner(delivery_date)')
        .gte('deliveries.delivery_date', weekAgo.toISOString().split('T')[0]);

      const unitsApprovedWeek = weekApprovedData?.reduce((sum, item) => sum + (item.quantity_approved || 0), 0) || 0;

      setStats({
        activeOrders: activeOrdersCount || 0,
        unitsInProduction,
        unitsDeliveredWeek,
        unitsApprovedWeek
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast({
        title: "Error al cargar estadísticas",
        description: "No se pudieron cargar las estadísticas del dashboard.",
        variant: "destructive",
      });
    }
  };

  const fetchProductionData = async () => {
    try {
      const isWeekly = viewMode === 'weekly';
      const periods = isWeekly ? 8 : 6; // Last 8 weeks or 6 months
      
      const productionStats: ProductionData[] = [];
      
      if (isWeekly) {
        // Weekly logic remains the same
        for (let i = periods - 1; i >= 0; i--) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() - (i * 7));
          
          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 6);
          
          // Get delivered units for this period
          const { data: deliveredData } = await supabase
            .from('delivery_items')
            .select('quantity_delivered, deliveries!inner(delivery_date)')
            .gte('deliveries.delivery_date', startDate.toISOString().split('T')[0])
            .lte('deliveries.delivery_date', endDate.toISOString().split('T')[0]);

          // Get approved units for this period  
          const { data: approvedData } = await supabase
            .from('delivery_items')
            .select('quantity_approved, deliveries!inner(delivery_date)')
            .gte('deliveries.delivery_date', startDate.toISOString().split('T')[0])
            .lte('deliveries.delivery_date', endDate.toISOString().split('T')[0]);

          const delivered = deliveredData?.reduce((sum, item) => sum + (item.quantity_delivered || 0), 0) || 0;
          const approved = approvedData?.reduce((sum, item) => sum + (item.quantity_approved || 0), 0) || 0;

          const month = endDate.toLocaleDateString('es-ES', { month: 'short' });
          const weekNum = Math.ceil(endDate.getDate() / 7);
          const periodLabel = `${month} S${weekNum}`;

          productionStats.push({
            period: periodLabel,
            delivered,
            approved
          });
        }
      } else {
        // Monthly logic - use calendar months
        for (let i = periods - 1; i >= 0; i--) {
          const targetDate = new Date();
          targetDate.setMonth(targetDate.getMonth() - i);
          
          // Get first and last day of this month
          const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
          const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
          
          // Get delivered units for this month
          const { data: deliveredData } = await supabase
            .from('delivery_items')
            .select('quantity_delivered, deliveries!inner(delivery_date)')
            .gte('deliveries.delivery_date', startDate.toISOString().split('T')[0])
            .lte('deliveries.delivery_date', endDate.toISOString().split('T')[0]);

          // Get approved units for this month
          const { data: approvedData } = await supabase
            .from('delivery_items')
            .select('quantity_approved, deliveries!inner(delivery_date)')
            .gte('deliveries.delivery_date', startDate.toISOString().split('T')[0])
            .lte('deliveries.delivery_date', endDate.toISOString().split('T')[0]);

          const delivered = deliveredData?.reduce((sum, item) => sum + (item.quantity_delivered || 0), 0) || 0;
          const approved = approvedData?.reduce((sum, item) => sum + (item.quantity_approved || 0), 0) || 0;

          const periodLabel = targetDate.toLocaleDateString('es-ES', { month: 'short' });

          productionStats.push({
            period: periodLabel,
            delivered,
            approved
          });
        }
      }

      setProductionData(productionStats);

    } catch (error) {
      console.error('Error fetching production data:', error);
    }
  };

  const fetchWorkshopRanking = async () => {
    try {
      // Get last week's data
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: workshopData, error } = await supabase
        .from('deliveries')
        .select(`
          workshop_id,
          workshops!inner(name),
          delivery_items!inner(
            quantity_delivered,
            quantity_approved
          )
        `)
        .gte('delivery_date', weekAgo.toISOString().split('T')[0]);

      if (error) throw error;

      // Group by workshop and calculate metrics
      const workshopStats: { [key: string]: any } = {};
      
      workshopData?.forEach(delivery => {
        const workshopId = delivery.workshop_id;
        const workshopName = delivery.workshops?.name || 'Taller';
        
        if (!workshopStats[workshopId]) {
          workshopStats[workshopId] = {
            workshopName,
            deliveredUnits: 0,
            approvedUnits: 0
          };
        }
        
        delivery.delivery_items?.forEach(item => {
          workshopStats[workshopId].deliveredUnits += item.quantity_delivered || 0;
          workshopStats[workshopId].approvedUnits += item.quantity_approved || 0;
        });
      });

      // Calculate scores and sort
      const workshopsArray = Object.values(workshopStats);
      
      // First pass: calculate quality scores
      const workshopsWithQuality = workshopsArray.map((workshop: any) => {
        const qualityScore = workshop.deliveredUnits > 0 
          ? Math.round((workshop.approvedUnits / workshop.deliveredUnits) * 100)
          : 0;
        
        return {
          ...workshop,
          qualityScore
        };
      });
      
      // Calculate volume scores based on relative ranking
      const maxDelivered = Math.max(...workshopsWithQuality.map(w => w.deliveredUnits || 1));
      
      const ranking = workshopsWithQuality.map((workshop: any) => {
        // Volume score: normalized to 0-100 based on delivered units
        const volumeScore = Math.round((workshop.deliveredUnits / maxDelivered) * 100);
        
        // Hybrid balanced composite score: 40% quality + 60% volume
        const compositeScore = Math.round((workshop.qualityScore * 0.4) + (volumeScore * 0.6));
        
        return {
          ...workshop,
          volumeScore,
          compositeScore
        };
      }).sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5);

      setWorkshopRanking(ranking);

    } catch (error) {
      console.error('Error fetching workshop ranking:', error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboardStats(),
      fetchProductionData(),
      fetchWorkshopRanking()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [viewMode]);

  return {
    stats,
    productionData,
    workshopRanking,
    viewMode,
    setViewMode,
    loading,
    refreshData: loadAllData
  };
};