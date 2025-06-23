
import { useState, useEffect } from 'react';
import { useOrderDeliveryStats } from '@/hooks/useOrderDeliveryStats';

interface OrderStats {
  totalOrdered: number;
  totalApproved: number;
  totalPending: number;
  completionPercentage: number;
}

export const useOrderStats = (orderId: string) => {
  const [stats, setStats] = useState<OrderStats>({
    totalOrdered: 0,
    totalApproved: 0,
    totalPending: 0,
    completionPercentage: 0
  });
  const [loading, setLoading] = useState(true);
  const { getOrderStats } = useOrderDeliveryStats();

  useEffect(() => {
    const fetchStats = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const orderStats = await getOrderStats(orderId);
        
        if (orderStats) {
          setStats({
            totalOrdered: orderStats.total_ordered,
            totalApproved: orderStats.total_approved,
            totalPending: orderStats.total_pending,
            completionPercentage: orderStats.completion_percentage
          });
        }
      } catch (error) {
        console.error('Error fetching order stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [orderId, getOrderStats]);

  return { stats, loading };
};
