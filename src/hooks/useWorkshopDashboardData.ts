
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface WorkshopDashboardStats {
  assignedOrders: number;
  completedOrders: number;
  activeOrders: number;
  pendingDeliveries: number;
  completionRate: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
}

interface MonthlyProgressData {
  name: string;
  completed: number;
  assigned: number;
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

export const useWorkshopDashboardData = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<WorkshopDashboardStats>({
    assignedOrders: 0,
    completedOrders: 0,
    activeOrders: 0,
    pendingDeliveries: 0,
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
      // Fetch workshop assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('workshop_assignments')
        .select('*')
        .eq('workshop_id', workshopId);

      if (assignmentsError) throw assignmentsError;

      const assignedOrders = assignments?.length || 0;
      const completedOrders = assignments?.filter(a => a.status === 'completed').length || 0;
      const activeOrders = assignments?.filter(a => a.status === 'in_progress').length || 0;

      // Fetch pending deliveries for this workshop
      const { count: pendingDeliveriesCount, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('status', 'pending');

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

        // Calculate quality score
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

      setStats({
        assignedOrders,
        completedOrders,
        activeOrders,
        pendingDeliveries: pendingDeliveriesCount || 0,
        completionRate,
        onTimeDeliveryRate,
        qualityScore
      });

    } catch (error) {
      console.error('Error fetching workshop stats:', error);
      toast({
        title: "Error al cargar estadísticas",
        description: "No se pudieron cargar las estadísticas del taller.",
        variant: "destructive",
      });
    }
  };

  const fetchMonthlyProgress = async () => {
    if (!workshopId) return;

    try {
      const { data: assignments, error } = await supabase
        .from('workshop_assignments')
        .select('created_at, status')
        .eq('workshop_id', workshopId)
        .gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const monthlyStats: { [key: string]: { assigned: number; completed: number } } = {};
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
      
      months.forEach(month => {
        monthlyStats[month] = { assigned: 0, completed: 0 };
      });

      assignments?.forEach(assignment => {
        const date = new Date(assignment.created_at);
        const monthName = months[date.getMonth()];
        if (monthName) {
          monthlyStats[monthName].assigned++;
          if (assignment.status === 'completed') {
            monthlyStats[monthName].completed++;
          }
        }
      });

      const chartData = months.map(month => ({
        name: month,
        assigned: monthlyStats[month].assigned,
        completed: monthlyStats[month].completed
      }));

      setMonthlyData(chartData);

    } catch (error) {
      console.error('Error fetching monthly progress:', error);
    }
  };

  const fetchOrderStatusData = async () => {
    if (!workshopId) return;

    try {
      const { data: assignments, error } = await supabase
        .from('workshop_assignments')
        .select('status')
        .eq('workshop_id', workshopId);

      if (error) throw error;

      const statusCounts = {
        assigned: 0,
        in_progress: 0,
        completed: 0
      };

      assignments?.forEach(assignment => {
        if (assignment.status === 'assigned') {
          statusCounts.assigned++;
        } else if (assignment.status === 'in_progress') {
          statusCounts.in_progress++;
        } else if (assignment.status === 'completed') {
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
      fetchMonthlyProgress(),
      fetchOrderStatusData(),
      fetchRecentActivity()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [workshopId]);

  return {
    stats,
    monthlyData,
    statusData,
    recentActivity,
    loading,
    refreshData: loadAllData
  };
};
