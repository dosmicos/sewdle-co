import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, startOfMonth, subDays, subMonths, format, getHours, getDate } from 'date-fns';

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

export interface SyncStatsData {
  todayStats: TodayStats;
  hourlyData: HourlyBucket[];
  dailyData: DailyBucket[];
  monthComparison: MonthDayBucket[];
  avgItemsPerDay: number;
}

const EMPTY_STATS: SyncStatsData = {
  todayStats: { itemsToday: 0, errorsToday: 0, ordersToday: 0, syncsToday: 0, avgMinsBetweenSyncs: null },
  hourlyData: Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${String(h).padStart(2, '0')}h`, items: 0, errors: 0 })),
  dailyData: [],
  monthComparison: [],
  avgItemsPerDay: 0,
};

export const useSyncStats = () => {
  const [data, setData] = useState<SyncStatsData>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const sixtyDaysAgo = subDays(startOfDay(now), 59).toISOString();

      // Query all sync logs for last 60 days
      const { data: logs, error } = await supabase
        .from('inventory_sync_logs' as any)
        .select('synced_at, success_count, error_count, delivery_id')
        .not('synced_at', 'is', null)
        .gte('synced_at', sixtyDaysAgo)
        .order('synced_at', { ascending: true });

      if (error) throw error;

      const entries = (logs || []) as Array<{
        synced_at: string;
        success_count: number | null;
        error_count: number | null;
        delivery_id: string | null;
      }>;

      const todayIso = format(now, 'yyyy-MM-dd');
      const thisMonthStart = startOfMonth(now);
      const prevMonthStart = startOfMonth(subMonths(now, 1));
      const prevMonthEnd = subDays(thisMonthStart, 1);

      // ── Hourly (today) ────────────────────────────────────────────────────
      const hourlyMap = new Map<number, { items: number; errors: number }>();
      for (let h = 0; h < 24; h++) hourlyMap.set(h, { items: 0, errors: 0 });

      // ── Daily (last 30 days) ──────────────────────────────────────────────
      const dailyMap = new Map<string, { items: number; errors: number; orders: Set<string> }>();

      // ── Month comparison ──────────────────────────────────────────────────
      const thisMonthMap = new Map<number, number>();   // day → items
      const prevMonthMap = new Map<number, number>();

      // ── Today stats ───────────────────────────────────────────────────────
      let itemsToday = 0;
      let errorsToday = 0;
      const ordersToday = new Set<string>();
      let syncsToday = 0;
      const syncTimesToday: Date[] = [];

      for (const entry of entries) {
        const dt = new Date(entry.synced_at);
        const items = entry.success_count ?? 0;
        const errors = entry.error_count ?? 0;
        const iso = format(dt, 'yyyy-MM-dd');
        const orderId = entry.delivery_id ?? '';

        // Today
        if (iso === todayIso) {
          const h = getHours(dt);
          const bucket = hourlyMap.get(h)!;
          bucket.items += items;
          bucket.errors += errors;
          itemsToday += items;
          errorsToday += errors;
          if (orderId) ordersToday.add(orderId);
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
          if (orderId) d.orders.add(orderId);
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

      // Build hourlyData array
      const hourlyData: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => {
        const b = hourlyMap.get(h)!;
        return { hour: h, label: `${String(h).padStart(2, '0')}h`, items: b.items, errors: b.errors };
      });

      // Build dailyData (last 30 days, sorted ascending)
      const dailyData: DailyBucket[] = [];
      for (let d = 29; d >= 0; d--) {
        const date = subDays(startOfDay(now), d);
        const iso = format(date, 'yyyy-MM-dd');
        const entry = dailyMap.get(iso);
        dailyData.push({
          date: format(date, 'dd/MM'),
          isoDate: iso,
          items: entry?.items ?? 0,
          errors: entry?.errors ?? 0,
          orders: entry?.orders.size ?? 0,
        });
      }

      // Avg items per day (days that had at least 1 item)
      const activeDays = dailyData.filter(d => d.items > 0);
      const avgItemsPerDay = activeDays.length > 0
        ? Math.round(activeDays.reduce((sum, d) => sum + d.items, 0) / activeDays.length)
        : 0;

      // Build month comparison (days 1-31)
      const maxDay = 31;
      const monthComparison: MonthDayBucket[] = Array.from({ length: maxDay }, (_, i) => ({
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
