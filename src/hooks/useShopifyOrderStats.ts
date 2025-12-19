import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

export type DateRangeType = 'today' | '7days' | '30days' | 'week' | 'month';

interface DailyStats {
  date: string;
  label: string;
  received: number;
  packed: number;
}

interface ShopifyOrderStats {
  ordersReceived: number;
  ordersPacked: number;
  dailyStats: DailyStats[];
}

export const useShopifyOrderStats = (initialRange: DateRangeType = '7days') => {
  const { currentOrganization } = useOrganization();
  const [dateRange, setDateRange] = useState<DateRangeType>(initialRange);
  const [stats, setStats] = useState<ShopifyOrderStats>({
    ordersReceived: 0,
    ordersPacked: 0,
    dailyStats: []
  });
  const [loading, setLoading] = useState(true);

  const dateRangeValues = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    switch (dateRange) {
      case 'today':
        start = startOfDay(now);
        break;
      case '7days':
        start = startOfDay(subDays(now, 6));
        break;
      case '30days':
        start = startOfDay(subDays(now, 29));
        break;
      case 'week':
        start = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        start = startOfMonth(now);
        break;
      default:
        start = startOfDay(subDays(now, 6));
    }

    return { start, end };
  }, [dateRange]);

  const fetchStats = async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
      const { start, end } = dateRangeValues;
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      // Fetch orders received (from shopify_orders based on created_at_shopify)
      const { data: receivedData, error: receivedError } = await supabase
        .from('shopify_orders')
        .select('id, created_at_shopify')
        .eq('organization_id', currentOrganization.id)
        .gte('created_at_shopify', startISO)
        .lte('created_at_shopify', endISO);

      if (receivedError) throw receivedError;

      // Fetch orders packed (from picking_packing_orders based on packed_at)
      const { data: packedData, error: packedError } = await supabase
        .from('picking_packing_orders')
        .select('id, packed_at')
        .eq('organization_id', currentOrganization.id)
        .not('packed_at', 'is', null)
        .gte('packed_at', startISO)
        .lte('packed_at', endISO);

      if (packedError) throw packedError;

      // Calculate daily stats
      const days = eachDayOfInterval({ start, end });
      const dailyStats: DailyStats[] = days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);

        const received = (receivedData || []).filter(order => {
          const orderDate = new Date(order.created_at_shopify);
          return orderDate >= dayStart && orderDate <= dayEnd;
        }).length;

        const packed = (packedData || []).filter(order => {
          const packedDate = new Date(order.packed_at!);
          return packedDate >= dayStart && packedDate <= dayEnd;
        }).length;

        return {
          date: format(day, 'yyyy-MM-dd'),
          label: format(day, 'dd MMM', { locale: es }),
          received,
          packed
        };
      });

      setStats({
        ordersReceived: receivedData?.length || 0,
        ordersPacked: packedData?.length || 0,
        dailyStats
      });
    } catch (error) {
      console.error('Error fetching shopify order stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [currentOrganization?.id, dateRange, dateRangeValues]);

  return {
    stats,
    loading,
    dateRange,
    setDateRange,
    refreshStats: fetchStats
  };
};
