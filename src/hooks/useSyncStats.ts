import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  startOfDay, startOfMonth, subDays, subMonths,
  format, getHours, getDate, getDay, parseISO,
} from 'date-fns';

export interface HourlyBucket {
  hour: number;
  label: string;
  items: number;
  errors: number;
}

export interface DailyBucket {
  date: string;       // 'dd/MM'
  isoDate: string;    // 'YYYY-MM-DD'
  items: number;
  errors: number;
  orders: number;
  isSunday: boolean;
}

export interface MonthDayBucket {
  day: number;        // 1-31
  thisMonth: number;
  prevMonth: number;
}

export interface TodayStats {
  itemsToday: number;
  errorsToday: number;
  ordersToday: number;
  syncsToday: number;
  avgMinsBetweenSyncs: number | null;
}

export interface SyncedOrder {
  syncedAt: string;         // ISO timestamp of the sync operation
  dateLabel: string;        // formatted 'dd/MM HH:mm'
  deliveryId: string;
  trackingNumber: string | null;
  orderNumber: string | null;
  itemsSynced: number;
  errors: number;
}

export interface SyncStatsData {
  todayStats: TodayStats;
  hourlyData: HourlyBucket[];
  dailyData: DailyBucket[];
  monthComparison: MonthDayBucket[];
  /** Average items/day Mon–Sat only (Sundays excluded) */
  avgItemsPerDay: number;
  /** Flat list of all sync operations in last 30 days, newest first */
  syncedOrders: SyncedOrder[];
}

const EMPTY_STATS: SyncStatsData = {
  todayStats: { itemsToday: 0, errorsToday: 0, ordersToday: 0, syncsToday: 0, avgMinsBetweenSyncs: null },
  hourlyData: Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${String(h).padStart(2, '0')}h`, items: 0, errors: 0 })),
  dailyData: [],
  monthComparison: [],
  avgItemsPerDay: 0,
  syncedOrders: [],
};

export const useSyncStats = () => {
  const [data, setData] = useState<SyncStatsData>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const sixtyDaysAgo = subDays(startOfDay(now), 59).toISOString();
      const thirtyDaysAgo = subDays(startOfDay(now), 29).toISOString();

      // 1) All sync logs for last 60 days
      const { data: logs, error: logsError } = await supabase
        .from('inventory_sync_logs' as any)
        .select('synced_at, success_count, error_count, delivery_id')
        .not('synced_at', 'is', null)
        .gte('synced_at', sixtyDaysAgo)
        .order('synced_at', { ascending: true });

      if (logsError) throw logsError;

      const entries = (logs || []) as Array<{
        synced_at: string;
        success_count: number | null;
        error_count: number | null;
        delivery_id: string | null;
      }>;

      // 2) Fetch delivery details for unique IDs in last 30 days (for orders list)
      const recentDeliveryIds = [
        ...new Set(
          entries
            .filter(e => e.delivery_id && e.synced_at >= thirtyDaysAgo)
            .map(e => e.delivery_id as string)
        ),
      ];

      const deliveryMap = new Map<string, { tracking_number: string | null; order_number: string | null }>();

      if (recentDeliveryIds.length > 0) {
        const { data: deliveries } = await supabase
          .from('deliveries' as any)
          .select('id, tracking_number, order_number')
          .in('id', recentDeliveryIds);

        for (const d of (deliveries || []) as Array<{ id: string; tracking_number: string | null; order_number: string | null }>) {
          deliveryMap.set(d.id, { tracking_number: d.tracking_number, order_number: d.order_number });
        }
      }

      // ── Aggregation maps ──────────────────────────────────────────────────
      const todayIso = format(now, 'yyyy-MM-dd');
      const thisMonthStart = startOfMonth(now);
      const prevMonthStart = startOfMonth(subMonths(now, 1));
      const prevMonthEnd = subDays(thisMonthStart, 1);

      const hourlyMap = new Map<number, { items: number; errors: number }>();
      for (let h = 0; h < 24; h++) hourlyMap.set(h, { items: 0, errors: 0 });

      const dailyMap = new Map<string, { items: number; errors: number; orders: Set<string> }>();
      const thisMonthMap = new Map<number, number>();
      const prevMonthMap = new Map<number, number>();

      let itemsToday = 0;
      let errorsToday = 0;
      const ordersToday = new Set<string>();
      let syncsToday = 0;
      const syncTimesToday: Date[] = [];

      // Synced orders list (last 30 days), newest first
      const syncedOrders: SyncedOrder[] = [];

      for (const entry of entries) {
        const dt = new Date(entry.synced_at);
        const items = entry.success_count ?? 0;
        const errors = entry.error_count ?? 0;
        const iso = format(dt, 'yyyy-MM-dd');
        const deliveryId = entry.delivery_id ?? '';

        // Today
        if (iso === todayIso) {
          const h = getHours(dt);
          const bucket = hourlyMap.get(h)!;
          bucket.items += items;
          bucket.errors += errors;
          itemsToday += items;
          errorsToday += errors;
          if (deliveryId) ordersToday.add(deliveryId);
          syncsToday++;
          syncTimesToday.push(dt);
        }

        // Daily (last 30 days)
        const daysAgo = Math.floor((now.getTime() - dt.getTime()) / 86400000);
        if (daysAgo < 30) {
          if (!dailyMap.has(iso)) dailyMap.set(iso, { items: 0, errors: 0, orders: new Set() });
          const d = dailyMap.get(iso)!;
          d.items += items;
          d.errors += errors;
          if (deliveryId) d.orders.add(deliveryId);

          // Build orders list entry (only when delivery is known)
          if (deliveryId) {
            const info = deliveryMap.get(deliveryId);
            syncedOrders.push({
              syncedAt: entry.synced_at,
              dateLabel: format(dt, 'dd/MM HH:mm'),
              deliveryId,
              trackingNumber: info?.tracking_number ?? null,
              orderNumber: info?.order_number ?? null,
              itemsSynced: items,
              errors,
            });
          }
        }

        // This month
        if (dt >= thisMonthStart) {
          const day = getDate(dt);
          thisMonthMap.set(day, (thisMonthMap.get(day) ?? 0) + items);
        }

        // Previous month
        if (dt >= prevMonthStart && dt <= prevMonthEnd) {
          const day = getDate(dt);
          prevMonthMap.set(day, (prevMonthMap.get(day) ?? 0) + items);
        }
      }

      // Sort orders newest first
      syncedOrders.sort((a, b) => b.syncedAt.localeCompare(a.syncedAt));

      // Avg minutes between syncs today
      let avgMinsBetweenSyncs: number | null = null;
      if (syncTimesToday.length >= 2) {
        const sorted = syncTimesToday.sort((a, b) => a.getTime() - b.getTime());
        const gaps: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          gaps.push((sorted[i].getTime() - sorted[i - 1].getTime()) / 60000);
        }
        avgMinsBetweenSyncs = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
      }

      // Build hourlyData
      const hourlyData: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => {
        const b = hourlyMap.get(h)!;
        return { hour: h, label: `${String(h).padStart(2, '0')}h`, items: b.items, errors: b.errors };
      });

      // Build dailyData (last 30 days, ascending)
      const dailyData: DailyBucket[] = [];
      for (let d = 29; d >= 0; d--) {
        const date = subDays(startOfDay(now), d);
        const iso = format(date, 'yyyy-MM-dd');
        const entry = dailyMap.get(iso);
        const dayOfWeek = getDay(date); // 0 = Sunday
        dailyData.push({
          date: format(date, 'dd/MM'),
          isoDate: iso,
          items: entry?.items ?? 0,
          errors: entry?.errors ?? 0,
          orders: entry?.orders.size ?? 0,
          isSunday: dayOfWeek === 0,
        });
      }

      // Avg items per day — Mon–Sat ONLY (Sundays excluded from numerator and denominator)
      const workingDaysWithActivity = dailyData.filter(d => !d.isSunday && d.items > 0);
      const avgItemsPerDay = workingDaysWithActivity.length > 0
        ? Math.round(workingDaysWithActivity.reduce((sum, d) => sum + d.items, 0) / workingDaysWithActivity.length)
        : 0;

      // Build month comparison (days 1-31)
      const monthComparison: MonthDayBucket[] = Array.from({ length: 31 }, (_, i) => ({
        day: i + 1,
        thisMonth: thisMonthMap.get(i + 1) ?? 0,
        prevMonth: prevMonthMap.get(i + 1) ?? 0,
      }));

      setData({
        todayStats: {
          itemsToday,
          errorsToday,
          ordersToday: ordersToday.size,
          syncsToday,
          avgMinsBetweenSyncs,
        },
        hourlyData,
        dailyData,
        monthComparison,
        avgItemsPerDay,
        syncedOrders,
      });
    } catch (err) {
      console.error('[useSyncStats] error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { ...data, loading, refetch: fetch };
};
