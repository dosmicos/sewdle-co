
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  activeOrders: number;
  workshops: number;
  products: number;
  pendingDeliveries: number;
}

interface MonthlyOrderData {
  name: string;
  orders: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

interface RecentActivity {
  id: string;
  icon: any;
  color: string;
  title: string;
  description: string;
  time: string;
}

export const useDashboardData = () => {
  const [stats, setStats] = useState<DashboardStats>({
    activeOrders: 0,
    workshops: 0,
    products: 0,
    pendingDeliveries: 0
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyOrderData[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDashboardStats = async () => {
    try {
      // Fetch active orders count
      const { count: activeOrdersCount, error: ordersError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'assigned', 'in_progress']);

      if (ordersError) throw ordersError;

      // Fetch workshops count
      const { count: workshopsCount, error: workshopsError } = await supabase
        .from('workshops')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      if (workshopsError) throw workshopsError;

      // Fetch products count
      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      if (productsError) throw productsError;

      // Fetch pending deliveries count
      const { count: pendingDeliveriesCount, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (deliveriesError) throw deliveriesError;

      setStats({
        activeOrders: activeOrdersCount || 0,
        workshops: workshopsCount || 0,
        products: productsCount || 0,
        pendingDeliveries: pendingDeliveriesCount || 0
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

  const fetchMonthlyOrderData = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('created_at')
        .gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group orders by month
      const monthlyStats: { [key: string]: number } = {};
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      
      // Initialize all months with 0
      months.forEach((month, index) => {
        monthlyStats[month] = 0;
      });

      data?.forEach(order => {
        const date = new Date(order.created_at);
        const monthName = months[date.getMonth()];
        monthlyStats[monthName]++;
      });

      const chartData = months.slice(0, 6).map(month => ({
        name: month,
        orders: monthlyStats[month]
      }));

      setMonthlyData(chartData);

    } catch (error) {
      console.error('Error fetching monthly order data:', error);
    }
  };

  const fetchOrderStatusData = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('status');

      if (error) throw error;

      const statusCounts = {
        pending: 0,
        in_progress: 0,
        completed: 0
      };

      data?.forEach(order => {
        if (order.status === 'pending' || order.status === 'assigned') {
          statusCounts.pending++;
        } else if (order.status === 'in_progress') {
          statusCounts.in_progress++;
        } else if (order.status === 'completed') {
          statusCounts.completed++;
        }
      });

      const total = statusCounts.pending + statusCounts.in_progress + statusCounts.completed;
      
      if (total > 0) {
        const statusChartData = [
          {
            name: 'Pendientes',
            value: Math.round((statusCounts.pending / total) * 100),
            color: '#FF9500'
          },
          {
            name: 'En Producción',
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
    try {
      // Fetch recent deliveries
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select(`
          *,
          orders (order_number),
          workshops (name)
        `)
        .order('created_at', { ascending: false })
        .limit(4);

      if (deliveriesError) throw deliveriesError;

      const activities = deliveries?.map(delivery => ({
        id: delivery.id,
        icon: 'CheckCircle',
        color: delivery.status === 'approved' ? 'text-green-600' : 
              delivery.status === 'pending' ? 'text-orange-600' : 'text-blue-600',
        title: `Entrega ${delivery.tracking_number}`,
        description: `${delivery.workshops?.name || 'Taller'} - ${delivery.orders?.order_number || 'Orden'}`,
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
    setLoading(true);
    await Promise.all([
      fetchDashboardStats(),
      fetchMonthlyOrderData(),
      fetchOrderStatusData(),
      fetchRecentActivity()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  return {
    stats,
    monthlyData,
    statusData,
    recentActivity,
    loading,
    refreshData: loadAllData
  };
};
