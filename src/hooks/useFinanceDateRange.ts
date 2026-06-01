import { useState, useMemo } from 'react';
import {
  buildFinanceDateRanges,
  formatBogotaDateForQuery,
  type FinanceDatePreset,
} from '@/lib/bogotaDateRange';

export type DatePreset = FinanceDatePreset;

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

export function useFinanceDateRange(): FinanceDateRange {
  const [preset, setPreset] = useState<DatePreset>('mtd');
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());

  const { current, previous } = useMemo(
    () => buildFinanceDateRanges(preset, new Date(), customStart, customEnd),
    [preset, customStart, customEnd]
  );

  const setCustomRange = (start: Date, end: Date) => {
    setCustomStart(start);
    setCustomEnd(end);
    setPreset('custom');
  };

  return {
    current,
    previous,
    preset,
    setPreset,
    setCustomRange,
    formatForQuery: formatBogotaDateForQuery,
  };
}
