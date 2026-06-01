export type FinanceDatePreset = 'today' | 'yesterday' | '7d' | 'mtd' | 'last-month' | '30d' | '90d' | 'custom';

export interface FinanceDateRangeValue {
  start: Date;
  end: Date;
}

export interface FinanceDateRangePair {
  current: FinanceDateRangeValue;
  previous: FinanceDateRangeValue;
}

export interface BogotaCalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

const BOGOTA_UTC_OFFSET_HOURS = 5; // America/Bogota is UTC-5 year-round.

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toBogotaDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getBogotaCalendarDate(date: Date): BogotaCalendarDate {
  const [year, month, day] = toBogotaDateString(date).split('-').map(Number);
  return { year, month, day };
}

function makeBogotaStartOfDay(parts: BogotaCalendarDate): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, BOGOTA_UTC_OFFSET_HOURS, 0, 0, 0));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function endOfBogotaDay(startOfBogotaDay: Date): Date {
  return new Date(addDays(startOfBogotaDay, 1).getTime() - 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(parts: BogotaCalendarDate, delta: number): BogotaCalendarDate {
  const date = new Date(Date.UTC(parts.year, parts.month - 1 + delta, 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: 1,
  };
}

function calendarDateFromLocalDate(date: Date): BogotaCalendarDate {
  // react-day-picker returns a Date for the selected calendar day. Interpret the
  // visible calendar date as the intended Bogotá calendar date instead of as a
  // UTC instant; this keeps custom ranges stable even if the browser is outside Colombia.
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function diffBogotaCalendarDays(later: Date, earlier: Date): number {
  const a = toBogotaDateString(later);
  const b = toBogotaDateString(earlier);
  const ams = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const bms = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((ams - bms) / 86_400_000);
}

export function getPreviousFinancePeriod(current: FinanceDateRangeValue): FinanceDateRangeValue {
  const inclusiveDays = diffBogotaCalendarDays(current.end, current.start) + 1;
  const previousStart = addDays(current.start, -inclusiveDays);
  const previousEndStart = addDays(current.start, -1);
  return {
    start: previousStart,
    end: endOfBogotaDay(previousEndStart),
  };
}

export function buildFinanceDateRanges(
  preset: FinanceDatePreset,
  now: Date = new Date(),
  customStart?: Date,
  customEnd?: Date,
): FinanceDateRangePair {
  const todayParts = getBogotaCalendarDate(now);
  const todayStart = makeBogotaStartOfDay(todayParts);

  let current: FinanceDateRangeValue;

  switch (preset) {
    case 'today':
      current = { start: todayStart, end: endOfBogotaDay(todayStart) };
      break;
    case 'yesterday': {
      const start = addDays(todayStart, -1);
      current = { start, end: endOfBogotaDay(start) };
      break;
    }
    case '7d': {
      const start = addDays(todayStart, -6);
      current = { start, end: endOfBogotaDay(todayStart) };
      break;
    }
    case 'mtd': {
      const start = makeBogotaStartOfDay({ year: todayParts.year, month: todayParts.month, day: 1 });
      current = { start, end: endOfBogotaDay(todayStart) };
      break;
    }
    case 'last-month': {
      const lastMonth = addMonths(todayParts, -1);
      const start = makeBogotaStartOfDay({ ...lastMonth, day: 1 });
      const endStart = makeBogotaStartOfDay({
        year: lastMonth.year,
        month: lastMonth.month,
        day: daysInMonth(lastMonth.year, lastMonth.month),
      });
      current = { start, end: endOfBogotaDay(endStart) };
      break;
    }
    case '30d': {
      const start = addDays(todayStart, -29);
      current = { start, end: endOfBogotaDay(todayStart) };
      break;
    }
    case '90d': {
      const start = addDays(todayStart, -89);
      current = { start, end: endOfBogotaDay(todayStart) };
      break;
    }
    case 'custom': {
      const startParts = calendarDateFromLocalDate(customStart ?? now);
      const endParts = calendarDateFromLocalDate(customEnd ?? customStart ?? now);
      const start = makeBogotaStartOfDay(startParts);
      const endStart = makeBogotaStartOfDay(endParts);
      current = { start, end: endOfBogotaDay(endStart) };
      break;
    }
    default:
      current = { start: todayStart, end: endOfBogotaDay(todayStart) };
  }

  return {
    current,
    previous: getPreviousFinancePeriod(current),
  };
}

export function formatBogotaDateForQuery(date: Date): string {
  return toBogotaDateString(date);
}

export function formatBogotaDateLabel(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    ...options,
  }).format(date);
}
