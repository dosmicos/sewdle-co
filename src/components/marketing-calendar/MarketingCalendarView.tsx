import React, { useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Rocket,
  Megaphone,
  Mail,
  MessageSquare,
  Users,
  Newspaper,
  Flame,
  Globe,
  Tag,
  Palette,
  Radio,
  MoreHorizontal,
  Mountain,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketingEvent, EventType } from '@/hooks/useMarketingEvents';
import type { HolidaySuggestion } from '@/hooks/useHolidaySuggestions';

// ─── Event type dot colors ──────────────────────────────
const EVENT_DOT_COLOR: Record<EventType, string> = {
  product_launch: 'bg-purple-500',
  promotion: 'bg-red-500',
  email_campaign: 'bg-blue-500',
  sms_blast: 'bg-green-500',
  influencer_collab: 'bg-pink-500',
  pr_hit: 'bg-yellow-500',
  organic_viral: 'bg-emerald-500',
  cultural_moment: 'bg-orange-500',
  price_change: 'bg-indigo-500',
  new_creative_batch: 'bg-cyan-500',
  channel_expansion: 'bg-teal-500',
  other: 'bg-gray-500',
};

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  product_launch: 'Lanzamiento',
  promotion: 'Promocion',
  email_campaign: 'Email',
  sms_blast: 'SMS',
  influencer_collab: 'Influencer',
  pr_hit: 'PR',
  organic_viral: 'Viral',
  cultural_moment: 'Cultural',
  price_change: 'Precio',
  new_creative_batch: 'Creativo',
  channel_expansion: 'Canal',
  other: 'Otro',
};

interface MarketingCalendarViewProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  events: MarketingEvent[];
  suggestions: HolidaySuggestion[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onDoubleClickDate: (date: Date) => void;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

const MarketingCalendarView: React.FC<MarketingCalendarViewProps> = ({
  currentMonth,
  onMonthChange,
  events,
  suggestions,
  selectedDate,
  onSelectDate,
  onDoubleClickDate,
}) => {
  // Calendar grid days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = gridStart;
    while (day <= gridEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  // Events indexed by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, MarketingEvent[]>();
    for (const event of events) {
      const key = event.event_date;
      const list = map.get(key) || [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  // Suggestions indexed by date (only suggested status)
  const suggestionsByDate = useMemo(() => {
    const map = new Map<string, HolidaySuggestion[]>();
    for (const s of suggestions) {
      if (s.status !== 'suggested') continue;
      const key = s.date;
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [suggestions]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-white">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <h2 className="text-lg font-semibold capitalize text-gray-900">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h2>
            <button
              className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
              onClick={() => onMonthChange(new Date())}
            >
              Ir a hoy
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider py-2.5"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
          {calendarDays.map((day, idx) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateKey) || [];
            const daySuggestions = suggestionsByDate.get(dateKey) || [];
            const inMonth = isSameMonth(day, currentMonth);
            const todayFlag = isToday(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const hasPeakEvent = dayEvents.some((e) => e.is_peak);
            const hasItems = dayEvents.length > 0 || daySuggestions.length > 0;

            return (
              <button
                key={idx}
                onClick={() => onSelectDate(day)}
                onDoubleClick={() => onDoubleClickDate(day)}
                className={cn(
                  'min-h-[90px] md:min-h-[100px] p-1.5 text-left transition-all flex flex-col relative',
                  inMonth ? 'bg-white' : 'bg-gray-50/60',
                  isSelected && 'ring-2 ring-blue-500 ring-inset bg-blue-50/30',
                  !isSelected && inMonth && 'hover:bg-gray-50',
                  hasPeakEvent && !isSelected && 'bg-amber-50/40',
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors',
                      !inMonth && 'text-gray-300',
                      inMonth && !todayFlag && 'text-gray-700',
                      todayFlag && 'bg-blue-600 text-white font-bold',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {hasPeakEvent && (
                    <Mountain className="h-3 w-3 text-amber-500" />
                  )}
                </div>

                {/* Event pills (max 2) */}
                <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div
                      key={ev.id}
                      className={cn(
                        'flex items-center gap-1 text-[10px] leading-tight px-1 py-0.5 rounded truncate',
                        ev.is_peak
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-700',
                      )}
                      title={ev.title}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full flex-shrink-0',
                          EVENT_DOT_COLOR[ev.event_type],
                        )}
                      />
                      <span className="truncate">{ev.title}</span>
                    </div>
                  ))}

                  {/* AI suggestion dots */}
                  {daySuggestions.length > 0 && dayEvents.length < 2 && (
                    <div className="flex items-center gap-1 text-[10px] leading-tight px-1 py-0.5 rounded truncate bg-violet-50 text-violet-700">
                      <Sparkles className="h-2.5 w-2.5 flex-shrink-0" />
                      <span className="truncate">
                        {daySuggestions.length === 1
                          ? daySuggestions[0].name
                          : `${daySuggestions.length} sugerencias`}
                      </span>
                    </div>
                  )}

                  {/* Overflow indicator */}
                  {(dayEvents.length > 2 || (dayEvents.length === 2 && daySuggestions.length > 0)) && (
                    <span className="text-[9px] text-gray-400 px-1">
                      +{dayEvents.length - 2 + daySuggestions.length} mas
                    </span>
                  )}
                </div>

                {/* Dot indicators at bottom for compact view on small days */}
                {hasItems && dayEvents.length === 0 && daySuggestions.length > 0 && (
                  <div className="absolute bottom-1 right-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 block" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-t bg-gray-50/50 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(EVENT_DOT_COLOR).map(([key, dotColor]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={cn('w-2 h-2 rounded-full', dotColor)} />
              <span className="text-[10px] text-gray-500">
                {EVENT_TYPE_LABEL[key as EventType]}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5 text-violet-500" />
            <span className="text-[10px] text-violet-500">Sugerencia IA</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketingCalendarView;
