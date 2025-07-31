import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface WorkshopDashboardStats {
  assignedOrders: number;
  completedOrders: number;
  activeOrders: number;
  pendingDeliveries: number;
  pendingUnits: number;
  pendingUnitsUrgency: 'excellent' | 'warning' | 'urgent' | 'critical';
  completionRate: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
  maxDueDate?: string;
}

interface MonthlyProgressData {
  name: string;
  delivered: number;
  approved: number;
}

interface OrderStatusData {
  name: string;
  value: number;
  color: string;
}

interface RecentWorkshopActivity {
  id: string;
  icon: string;
  color: string;
  title: string;
  description: string;
  time: string;
}

export const useWorkshopDashboardData = (viewMode: 'weekly' | 'monthly' = 'weekly') => {
  const { user } = useAuth();
  const [stats, setStats] = useState<WorkshopDashboardStats>({
    assignedOrders: 0,
    completedOrders: 0,
    activeOrders: 0,
    pendingDeliveries: 0,
    pendingUnits: 0,
    pendingUnitsUrgency: 'excellent',
    completionRate: 0,
    onTimeDeliveryRate: 0,
    qualityScore: 0
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyProgressData[]>([]);
  const [statusData, setStatusData] = useState<OrderStatusData[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentWorkshopActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const workshopId = user?.workshopId;

  const fetchWorkshopStats = async () => {
    if (!workshopId) return;

    try {
      console.log('Fetching stats for workshop:', workshopId);

      // Fetch workshop assignments with order data (JOIN to get real order status)
      const { data: assignments, error: assignmentsError } = await supabase
        .from('workshop_assignments')
        .select(`
          *,
          orders!inner(
            id,
            order_number,
            status,
            due_date,
            created_at
          )
        `)
        .eq('workshop_id', workshopId);

      if (assignmentsError) throw assignmentsError;

      console.log('Raw assignments data:', assignments);

      // Calculate metrics based on REAL order status, not assignment status
      const assignedOrders = assignments?.length || 0;
      const completedOrders = assignments?.filter(a => a.orders?.status === 'completed').length || 0;
      const activeOrders = assignments?.filter(a => 
        a.orders?.status === 'assigned' || a.orders?.status === 'in_progress'
      ).length || 0;

      console.log('Calculated metrics:', {
        assignedOrders,
        completedOrders, 
        activeOrders
      });

      // Calculate pending units (not approved) for active orders
      const { data: pendingUnitsData, error: pendingUnitsError } = await supabase
        .from('order_items')
        .select(`
          quantity,
          delivery_items!left(quantity_approved)
        `)
        .in('order_id', assignments?.filter(a => 
          a.orders?.status === 'assigned' || a.orders?.status === 'in_progress'
        ).map(a => a.orders?.id) || []);

      if (pendingUnitsError) throw pendingUnitsError;

      // Calculate total pending units (ordered - approved)
      let pendingUnits = 0;
      pendingUnitsData?.forEach(item => {
        const totalOrdered = item.quantity || 0;
        const totalApproved = item.delivery_items?.reduce((sum: number, di: any) => 
          sum + (di.quantity_approved || 0), 0) || 0;
        pendingUnits += Math.max(0, totalOrdered - totalApproved);
      });

      // Determine urgency level for traffic light system
      const getUrgencyLevel = (units: number): 'excellent' | 'warning' | 'urgent' | 'critical' => {
        if (units <= 50) return 'excellent';
        if (units <= 150) return 'warning';
        if (units <= 300) return 'urgent';
        return 'critical';
      };

      const pendingUnitsUrgency = getUrgencyLevel(pendingUnits);

      // Fetch pending deliveries for this workshop (include in_quality as pending)
      const { count: pendingDeliveriesCount, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .in('status', ['pending', 'in_quality']);

      if (deliveriesError) throw deliveriesError;

      // Calculate completion rate
      const completionRate = assignedOrders > 0 ? Math.round((completedOrders / assignedOrders) * 100) : 0;

      // Fetch deliveries for quality and on-time metrics
      const { data: deliveries, error: deliveriesDataError } = await supabase
        .from('deliveries')
        .select(`
          *,
          orders!inner(due_date),
          delivery_items(quantity_delivered, quantity_approved)
        `)
        .eq('workshop_id', workshopId);

      if (deliveriesDataError) throw deliveriesDataError;

      let onTimeDeliveryRate = 0;
      let qualityScore = 0;

      if (deliveries && deliveries.length > 0) {
        // Calculate on-time delivery rate
        const onTimeDeliveries = deliveries.filter(delivery => {
          if (!delivery.delivery_date || !delivery.orders?.due_date) return false;
          return new Date(delivery.delivery_date) <= new Date(delivery.orders.due_date);
        }).length;

        onTimeDeliveryRate = Math.round((onTimeDeliveries / deliveries.length) * 100);

        // Calculate quality score using new delivery_items structure
        let totalDelivered = 0;
        let totalApproved = 0;
        
        deliveries.forEach(delivery => {
          delivery.delivery_items?.forEach((item: any) => {
            totalDelivered += item.quantity_delivered || 0;
            totalApproved += item.quantity_approved || 0;
          });
        });

        if (totalDelivered > 0) {
          qualityScore = Math.round((totalApproved / totalDelivered) * 100);
        }
      }

      // Calculate max due date from active orders
      let maxDueDate: string | undefined;
      const activeDueDates = assignments
        ?.filter(a => a.orders?.status === 'assigned' || a.orders?.status === 'in_progress')
        .map(a => a.orders?.due_date)
        .filter(date => date !== null && date !== undefined) || [];
      
      if (activeDueDates.length > 0) {
        const latestDate = activeDueDates.reduce((latest, current) => {
          return new Date(current) > new Date(latest) ? current : latest;
        });
        maxDueDate = new Date(latestDate).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }

      const finalStats = {
        assignedOrders,
        completedOrders,
        activeOrders,
        pendingDeliveries: pendingDeliveriesCount || 0,
        pendingUnits,
        pendingUnitsUrgency,
        completionRate,
        onTimeDeliveryRate,
        qualityScore,
        maxDueDate
      };

      console.log('Final stats:', finalStats);
      setStats(finalStats);

    } catch (error) {
      console.error('Error fetching workshop stats:', error);
      toast({
        title: "Error al cargar estadísticas",
        description: "No se pudieron cargar las estadísticas del taller.",
        variant: "destructive",
      });
    }
  };

  const fetchProgressData = async () => {
    if (!workshopId) return;

    try {
      // Get delivery data with items for progress view
      const { data: deliveries, error } = await supabase
        .from('deliveries')
        .select(`
          delivery_date,
          delivery_items!inner(
            quantity_delivered,
            quantity_approved
          )
        `)
        .eq('workshop_id', workshopId)
        .gte('delivery_date', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('delivery_date');

      if (error) throw error;

      if (viewMode === 'weekly') {
        // Group by week and calculate delivered vs approved units
        const weeklyStats: { [key: string]: { delivered: number; approved: number } } = {};
        
        deliveries?.forEach(delivery => {
          const date = new Date(delivery.delivery_date);
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
          
          const monthName = weekStart.toLocaleDateString('es-ES', { month: 'short' });
          const weekNumber = Math.ceil(weekStart.getDate() / 7);
          const weekKey = `${monthName} S${weekNumber}`;
          
          if (!weeklyStats[weekKey]) {
            weeklyStats[weekKey] = { delivered: 0, approved: 0 };
          }
          
          delivery.delivery_items.forEach((item) => {
            weeklyStats[weekKey].delivered += item.quantity_delivered || 0;
            weeklyStats[weekKey].approved += item.quantity_approved || 0;
          });
        });

        // Sort by date and return last 8 weeks
        const chartData = Object.entries(weeklyStats)
          .map(([name, stats]) => ({
            name,
            delivered: stats.delivered,
            approved: stats.approved
          }))
          .slice(-8); // Show last 8 weeks

        setMonthlyData(chartData);

      } else {
        // Group by month for monthly view
        const monthlyStats: { [key: string]: { delivered: number; approved: number } } = {};
        const allMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const currentMonth = new Date().getMonth();
        const monthsToShow = allMonths.slice(0, currentMonth + 1); // Show from January to current month
        
        monthsToShow.forEach(month => {
          monthlyStats[month] = { delivered: 0, approved: 0 };
        });

        deliveries?.forEach(delivery => {
          const date = new Date(delivery.delivery_date);
          const monthIndex = date.getMonth();
          const monthName = allMonths[monthIndex];
          if (monthName && monthsToShow.includes(monthName)) {
            delivery.delivery_items.forEach((item) => {
              monthlyStats[monthName].delivered += item.quantity_delivered || 0;
              monthlyStats[monthName].approved += item.quantity_approved || 0;
            });
          }
        });

        const chartData = monthsToShow.map(month => ({
          name: month,
          delivered: monthlyStats[month].delivered,
          approved: monthlyStats[month].approved
        }));

        setMonthlyData(chartData);
      }

    } catch (error) {
      console.error('Error fetching progress data:', error);
    }
  };

  const fetchOrderStatusData = async () => {
    if (!workshopId) return;

    try {
      // Use real order status instead of assignment status
      const { data: assignments, error } = await supabase
        .from('workshop_assignments')
        .select(`
          orders!inner(status)
        `)
        .eq('workshop_id', workshopId);

      if (error) throw error;

      const statusCounts = {
        assigned: 0,
        in_progress: 0,
        completed: 0
      };

      assignments?.forEach(assignment => {
        const orderStatus = assignment.orders?.status;
        if (orderStatus === 'assigned') {
          statusCounts.assigned++;
        } else if (orderStatus === 'in_progress') {
          statusCounts.in_progress++;
        } else if (orderStatus === 'completed') {
          statusCounts.completed++;
        }
      });

      const total = statusCounts.assigned + statusCounts.in_progress + statusCounts.completed;
      
      if (total > 0) {
        const statusChartData = [
          {
            name: 'Asignadas',
            value: Math.round((statusCounts.assigned / total) * 100),
            color: '#FF9500'
          },
          {
            name: 'En Progreso',
            value: Math.round((statusCounts.in_progress / total) * 100),
            color: '#007AFF'
          },
          {
            name: 'Completadas',
            value: Math.round((statusCounts.completed / total) * 100),
            color: '#34C759'
          }
        ];

        setStatusData(statusChartData);
      }

    } catch (error) {
      console.error('Error fetching order status data:', error);
    }
  };

  const fetchRecentActivity = async () => {
    if (!workshopId) return;

    try {
      const { data: deliveries, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          orders (order_number)
        `)
        .eq('workshop_id', workshopId)
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) throw error;

      const activities = deliveries?.map(delivery => ({
        id: delivery.id,
        icon: 'CheckCircle',
        color: delivery.status === 'approved' ? 'text-green-600' : 
              delivery.status === 'pending' ? 'text-orange-600' : 'text-blue-600',
        title: `Entrega ${delivery.tracking_number || 'Sin número'}`,
        description: `Orden ${delivery.orders?.order_number || 'Sin número'}`,
        time: getTimeAgo(delivery.created_at)
      })) || [];

      setRecentActivity(activities);

    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) {
      return `Hace ${days} día${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    } else {
      return 'Hace unos minutos';
    }
  };

  const loadAllData = async () => {
    if (!workshopId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    await Promise.all([
      fetchWorkshopStats(),
      fetchProgressData(),
      fetchOrderStatusData(),
      fetchRecentActivity()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [workshopId, viewMode]);

  return {
    stats,
    monthlyData,
    statusData,
    recentActivity,
    loading,
    refreshData: loadAllData
  };
};
