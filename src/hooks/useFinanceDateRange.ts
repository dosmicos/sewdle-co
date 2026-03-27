import { useState, useMemo } from 'react';
import { startOfDay, endOfDay, subDays, startOfMonth, subMonths, format } from 'date-fns';

export type DatePreset = 'today' | 'yesterday' | '7d' | 'mtd' | '30d' | '90d' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface FinanceDateRange {
  current: DateRange;
  previous: DateRange;
  preset: DatePreset;
  setPreset: (preset: DatePreset) => void;
  setCustomRange: (start: Date, end: Date) => void;
  formatForQuery: (date: Date) => string;
}

function getPreviousPeriod(current: DateRange): DateRange {
  const diffMs = current.end.getTime() - current.start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return {
    start: startOfDay(subDays(current.start, diffDays)),
    end: endOfDay(subDays(current.start, 1)),
  };
}

export function useFinanceDateRange(): FinanceDateRange {
  const [preset, setPreset] = useState<DatePreset>('mtd');
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());

  const current = useMemo<DateRange>(() => {
    const now = new Date();
    switch (preset) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday':
        return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
      case '7d':
        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
      case 'mtd':
        return { start: startOfDay(startOfMonth(now)), end: endOfDay(now) };
      case '30d':
        return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
      case '90d':
        return { start: startOfDay(subDays(now, 89)), end: endOfDay(now) };
      case 'custom':
        return { start: startOfDay(customStart), end: endOfDay(customEnd) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  }, [preset, customStart, customEnd]);

  const previous = useMemo(() => getPreviousPeriod(current), [current]);

  const setCustomRange = (start: Date, end: Date) => {
    setCustomStart(start);
    setCustomEnd(end);
    setPreset('custom');
  };

  const formatForQuery = (date: Date) => format(date, 'yyyy-MM-dd');

  return { current, previous, preset, setPreset, setCustomRange, formatForQuery };
}
