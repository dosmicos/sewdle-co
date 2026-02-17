import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, format, eachDayOfInterval, differenceInSeconds } from 'date-fns';
import { es } from 'date-fns/locale';

export type DateRangeType = 'today' | '7days' | '30days' | 'week' | 'month';

interface DailyStats {
  date: string;
  label: string;
  received: number;
  packed: number;
}

interface HourlyStats {
  hour: number;
  label: string;
  packed: number;
}

interface ProductivityStats {
  avgTimeBetweenPacking: number | null; // segundos
  packingVelocity: number; // pedidos por hora
  fastestPacking: number | null; // segundos
  slowestPacking: number | null; // segundos
}

interface ShopifyOrderStats {
  ordersReceived: number;
  ordersPacked: number;
  dailyStats: DailyStats[];
  hourlyStats: HourlyStats[];
  productivity: ProductivityStats;
}

export const useShopifyOrderStats = (initialRange: DateRangeType = '7days') => {
  const { currentOrganization } = useOrganization();
  const [dateRange, setDateRange] = useState<DateRangeType>(initialRange);
  const [stats, setStats] = useState<ShopifyOrderStats>({
    ordersReceived: 0,
    ordersPacked: 0,
    dailyStats: [],
    hourlyStats: [],
    productivity: {
      avgTimeBetweenPacking: null,
      packingVelocity: 0,
      fastestPacking: null,
      slowestPacking: null
    }
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

      // Fetch orders packed with packed_at timestamp for productivity calculations
      const { data: packedData, error: packedError } = await supabase
        .from('picking_packing_orders')
        .select('id, packed_at')
        .eq('organization_id', currentOrganization.id)
        .not('packed_at', 'is', null)
        .gte('packed_at', startISO)
        .lte('packed_at', endISO)
        .order('packed_at', { ascending: true });

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

      // Calculate hourly stats (0-23 hours)
      const hourlyStats: HourlyStats[] = Array.from({ length: 24 }, (_, hour) => {
        const packed = (packedData || []).filter(order => {
          const packedDate = new Date(order.packed_at!);
          return packedDate.getHours() === hour;
        }).length;

        return {
          hour,
          label: `${hour.toString().padStart(2, '0')}:00`,
          packed
        };
      });

      // Calculate productivity metrics
      const packedTimestamps = (packedData || [])
        .map(order => new Date(order.packed_at!))
        .sort((a, b) => a.getTime() - b.getTime());

      let avgTimeBetweenPacking: number | null = null;
      let fastestPacking: number | null = null;
      let slowestPacking: number | null = null;

      if (packedTimestamps.length > 1) {
        const timeDifferences: number[] = [];
        
        for (let i = 1; i < packedTimestamps.length; i++) {
          const diff = differenceInSeconds(packedTimestamps[i], packedTimestamps[i - 1]);
          // Solo considerar diferencias menores a 2 horas (7200 segundos) para evitar pausas largas
          if (diff > 0 && diff < 7200) {
            timeDifferences.push(diff);
          }
        }

        if (timeDifferences.length > 0) {
          avgTimeBetweenPacking = Math.round(
            timeDifferences.reduce((sum, diff) => sum + diff, 0) / timeDifferences.length
          );
          fastestPacking = Math.min(...timeDifferences);
          slowestPacking = Math.max(...timeDifferences);
        }
      }

      // Calculate packing velocity (orders per hour)
      const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const packingVelocity = totalHours > 0 
        ? Math.round((packedData?.length || 0) / totalHours * 100) / 100
        : 0;

      setStats({
        ordersReceived: receivedData?.length || 0,
        ordersPacked: packedData?.length || 0,
        dailyStats,
        hourlyStats,
        productivity: {
          avgTimeBetweenPacking,
          packingVelocity,
          fastestPacking,
          slowestPacking
        }
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
