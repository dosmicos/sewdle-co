import React, { useState, useMemo, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
  isFuture,
  getISOWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import ActivityRevenueChart from '@/components/finance-dashboard/ActivityRevenueChart';
import MarketingCalendarView from '@/components/marketing-calendar/MarketingCalendarView';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import { useMarketingActivity } from '@/hooks/useMarketingActivity';
import { useHolidaySuggestions } from '@/hooks/useHolidaySuggestions';
import type { MarketingEvent, MarketingEventInput, EventType, ImpactLevel, PeakPhase, ContentType, Platform, EventStatus } from '@/hooks/useMarketingEvents';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  Megaphone,
  Rocket,
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
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  RefreshCw,
  Mountain,
  Sparkles,
  CalendarClock,
  ListChecks,
  Clock,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import HolidaySuggestionPanel from '@/components/marketing-calendar/HolidaySuggestionPanel';

// ─── Event type configuration ─────────────────────────────
const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; color: string; dot: string; icon: React.ReactNode }
> = {
  product_launch: {
    label: 'Lanzamiento',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    icon: <Rocket className="h-3 w-3" />,
  },
  promotion: {
    label: 'Promocion',
    color: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
    icon: <Megaphone className="h-3 w-3" />,
  },
  email_campaign: {
    label: 'Email',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    icon: <Mail className="h-3 w-3" />,
  },
  sms_blast: {
    label: 'SMS',
    color: 'bg-green-50 text-green-700 border-green-200',
    dot: 'bg-green-500',
    icon: <MessageSquare className="h-3 w-3" />,
  },
  influencer_collab: {
    label: 'Influencer',
    color: 'bg-pink-50 text-pink-700 border-pink-200',
    dot: 'bg-pink-500',
    icon: <Users className="h-3 w-3" />,
  },
  pr_hit: {
    label: 'PR',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    dot: 'bg-yellow-500',
    icon: <Newspaper className="h-3 w-3" />,
  },
  organic_viral: {
    label: 'Viral',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    icon: <Flame className="h-3 w-3" />,
  },
  cultural_moment: {
    label: 'Cultural',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
    icon: <Globe className="h-3 w-3" />,
  },
  price_change: {
    label: 'Precio',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    icon: <Tag className="h-3 w-3" />,
  },
  new_creative_batch: {
    label: 'Creativo',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    dot: 'bg-cyan-500',
    icon: <Palette className="h-3 w-3" />,
  },
  channel_expansion: {
    label: 'Canal',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    dot: 'bg-teal-500',
    icon: <Radio className="h-3 w-3" />,
  },
  other: {
    label: 'Otro',
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    dot: 'bg-gray-500',
    icon: <MoreHorizontal className="h-3 w-3" />,
  },
};

const IMPACT_CONFIG: Record<ImpactLevel, { label: string; color: string }> = {
  high: { label: 'Alto', color: 'bg-red-100 text-red-700' },
  medium: { label: 'Medio', color: 'bg-yellow-100 text-yellow-700' },
  low: { label: 'Bajo', color: 'bg-green-100 text-green-700' },
};

const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'product_launch', label: 'Lanzamiento de producto' },
  { value: 'promotion', label: 'Promocion / Sale' },
  { value: 'email_campaign', label: 'Campana de email' },
  { value: 'sms_blast', label: 'SMS Blast' },
  { value: 'influencer_collab', label: 'Colaboracion influencer' },
  { value: 'pr_hit', label: 'PR / Prensa' },
  { value: 'organic_viral', label: 'Organico viral' },
  { value: 'cultural_moment', label: 'Momento cultural' },
  { value: 'price_change', label: 'Cambio de precio' },
  { value: 'new_creative_batch', label: 'Batch de creativos' },
  { value: 'channel_expansion', label: 'Expansion de canal' },
  { value: 'other', label: 'Otro' },
];

const IMPACT_OPTIONS: { value: ImpactLevel; label: string }[] = [
  { value: 'high', label: 'Alto' },
  { value: 'medium', label: 'Medio' },
  { value: 'low', label: 'Bajo' },
];

const PEAK_PHASE_OPTIONS: { value: PeakPhase; label: string }[] = [
  { value: 'concept', label: 'Concepto' },
  { value: 'creative', label: 'Creativo' },
  { value: 'teaser', label: 'Teaser' },
  { value: 'peak', label: 'Peak' },
  { value: 'analysis', label: 'Analisis' },
];

const PEAK_PHASE_CONFIG: Record<PeakPhase, { label: string; color: string }> = {
  concept: { label: 'Concepto', color: 'bg-slate-100 text-slate-700' },
  creative: { label: 'Creativo', color: 'bg-violet-100 text-violet-700' },
  teaser: { label: 'Teaser', color: 'bg-amber-100 text-amber-700' },
  peak: { label: 'Peak', color: 'bg-red-100 text-red-700' },
  analysis: { label: 'Analisis', color: 'bg-blue-100 text-blue-700' },
};

// ─── Content Type & Platform ─────────────────────────────
const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Historia' },
  { value: 'post', label: 'Post' },
  { value: 'carousel', label: 'Carrusel' },
  { value: 'live', label: 'Live' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'email', label: 'Email' },
  { value: 'blog', label: 'Blog' },
  { value: 'ugc', label: 'UGC' },
  { value: 'other', label: 'Otro' },
];

const CONTENT_TYPE_CONFIG: Record<ContentType, { label: string; color: string }> = {
  reel: { label: 'Reel', color: 'bg-pink-100 text-pink-700' },
  story: { label: 'Historia', color: 'bg-violet-100 text-violet-700' },
  post: { label: 'Post', color: 'bg-blue-100 text-blue-700' },
  carousel: { label: 'Carrusel', color: 'bg-cyan-100 text-cyan-700' },
  live: { label: 'Live', color: 'bg-red-100 text-red-700' },
  tiktok: { label: 'TikTok', color: 'bg-gray-900 text-white' },
  email: { label: 'Email', color: 'bg-emerald-100 text-emerald-700' },
  blog: { label: 'Blog', color: 'bg-amber-100 text-amber-700' },
  ugc: { label: 'UGC', color: 'bg-orange-100 text-orange-700' },
  other: { label: 'Otro', color: 'bg-gray-100 text-gray-700' },
};

const PLATFORM_OPTIONS: { value: Platform; label: string; emoji: string }[] = [
  { value: 'instagram', label: 'Instagram', emoji: '📸' },
  { value: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { value: 'facebook', label: 'Facebook', emoji: '📘' },
  { value: 'whatsapp', label: 'WhatsApp', emoji: '💬' },
  { value: 'email', label: 'Email', emoji: '📧' },
  { value: 'blog', label: 'Blog', emoji: '📝' },
];

const EVENT_STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'planned', label: 'Planeado' },
  { value: 'in_production', label: 'En produccion' },
  { value: 'ready', label: 'Listo' },
  { value: 'published', label: 'Publicado' },
  { value: 'done', label: 'Hecho' },
];

const EVENT_STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  idea: { label: 'Idea', color: 'bg-gray-100 text-gray-600' },
  planned: { label: 'Planeado', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'En produccion', color: 'bg-yellow-100 text-yellow-700' },
  ready: { label: 'Listo', color: 'bg-emerald-100 text-emerald-700' },
  published: { label: 'Publicado', color: 'bg-purple-100 text-purple-700' },
  done: { label: 'Hecho', color: 'bg-green-100 text-green-700' },
};

// ─── Quarterly Peaks ────────────────────────────────────
interface QuarterlyPeak {
  quarter: string;
  name: string;
  months: string;
  monthNumbers: number[];
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const QUARTERLY_PEAKS: QuarterlyPeak[] = [
  {
    quarter: 'Q1',
    name: 'Hot Days',
    months: 'Marzo',
    monthNumbers: [3],
    icon: <Flame className="h-3.5 w-3.5" />,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
  },
  {
    quarter: 'Q2',
    name: 'Dia de la Madre',
    months: 'Mayo',
    monthNumbers: [5],
    icon: <Target className="h-3.5 w-3.5" />,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 border-pink-200',
  },
  {
    quarter: 'Q3',
    name: 'Temporada de Frio',
    months: 'Jul - Ago',
    monthNumbers: [7, 8],
    icon: <Mountain className="h-3.5 w-3.5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  {
    quarter: 'Q4',
    name: 'BF + Navidad',
    months: 'Nov - Dic',
    monthNumbers: [11, 12],
    icon: <Zap className="h-3.5 w-3.5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
  },
];

const formatCOP = (amount: number) =>
  `COP ${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount))}`;

const formatCOPShort = (amount: number) => {
  if (amount >= 1_000_000) return `COP ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `COP ${(amount / 1_000).toFixed(0)}K`;
  return formatCOP(amount);
};

// ─── Delta Badge Component ──────────────────────────────
const DeltaBadge: React.FC<{ expected: number; actual: number }> = ({
  expected,
  actual,
}) => {
  if (!expected || expected === 0) return null;
  const delta = ((actual - expected) / expected) * 100;
  const isPositive = delta >= 0;
  return (
    <Badge
      variant="secondary"
      className={cn(
        'text-[10px] px-1.5 gap-0.5',
        isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      {isPositive ? '+' : ''}{delta.toFixed(0)}%
    </Badge>
  );
};

// ─── Expected vs Actual Display ─────────────────────────
const ExpectedVsActual: React.FC<{
  expected: number | null;
  actual: number | null;
  label?: string;
}> = ({ expected, actual, label }) => {
  if (!expected && !actual) return null;
  return (
    <div className="text-xs">
      {label && <span className="text-gray-400 mr-1">{label}:</span>}
      {expected != null && (
        <span className="text-gray-500">
          Esperado {formatCOPShort(expected)}
        </span>
      )}
      {expected != null && actual != null && (
        <span className="text-gray-400 mx-1">&rarr;</span>
      )}
      {actual != null && (
        <span className="font-medium text-gray-700">
          Actual {formatCOPShort(actual)}
        </span>
      )}
      {expected != null && actual != null && (
        <span className="ml-1">
          <DeltaBadge expected={expected} actual={actual} />
        </span>
      )}
    </div>
  );
};

// ─── Default form ─────────────────────────────────────────
const defaultForm: MarketingEventInput = {
  event_date: new Date().toISOString().split('T')[0],
  event_type: 'promotion',
  title: '',
  description: '',
  expected_impact: 'medium',
  actual_revenue_impact: null,
  expected_revenue: null,
  expected_new_customers: null,
  attribution_window_days: 7,
  why_now: null,
  is_peak: false,
  peak_name: null,
  peak_phase: null,
  learnings: null,
  content_type: null,
  platform: null,
  status: 'idea',
  assigned_to: null,
  scheduled_time: null,
  copy_text: null,
  hashtags: null,
  assets_needed: null,
  assets_url: null,
  approval_notes: null,
};

// ─── Page Component ───────────────────────────────────────
const MarketingCalendarPage: React.FC = () => {
  const { events, isLoading, addEvent, updateEvent, deleteEvent, calculateAttribution } =
    useMarketingEvents();
  const { suggestions, suggestedCount: pendingSuggestions } = useHolidaySuggestions();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [weekRef, setWeekRef] = useState(new Date());

  // Week view helpers
  const weekStart = useMemo(() => startOfWeek(weekRef, { weekStartsOn: 1 }), [weekRef]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekNumber = useMemo(() => getISOWeek(weekStart), [weekStart]);

  const weekEvents = useMemo(() => {
    const weekEnd = addDays(weekStart, 6);
    return events.filter((e) => {
      const d = new Date(e.event_date + 'T12:00:00');
      return d >= weekStart && d <= weekEnd;
    });
  }, [events, weekStart]);

  const weekEventsByDay = useMemo(() => {
    const map = new Map<string, MarketingEvent[]>();
    for (const day of weekDays) {
      const key = format(day, 'yyyy-MM-dd');
      map.set(key, []);
    }
    for (const ev of weekEvents) {
      const list = map.get(ev.event_date);
      if (list) list.push(ev);
    }
    return map;
  }, [weekEvents, weekDays]);

  // Activity vs Revenue data for the current month
  const activityStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const activityEnd = useMemo(() => {
    const monthEnd = endOfMonth(currentMonth);
    const today = new Date();
    return monthEnd < today ? monthEnd : today;
  }, [currentMonth]);
  const activity = useMarketingActivity(activityStart, activityEnd);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [form, setForm] = useState<MarketingEventInput>(defaultForm);
  const [calculatingId, setCalculatingId] = useState<string | null>(null);
  const [hashtagInput, setHashtagInput] = useState('');

  // ─── Events indexed by date ──────────────────────────
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

  // Events for current month
  const monthEvents = useMemo(() => {
    return events
      .filter((e) => {
        const d = new Date(e.event_date + 'T12:00:00');
        return isSameMonth(d, currentMonth);
      })
      .sort(
        (a, b) =>
          new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      );
  }, [events, currentMonth]);

  // Events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return eventsByDate.get(key) || [];
  }, [selectedDate, eventsByDate]);

  // ─── KPI Summaries ──────────────────────────────────
  const kpiData = useMemo(() => {
    const thisMonthCount = monthEvents.length;

    // Next upcoming event
    const today = new Date().toISOString().slice(0, 10);
    const nextEvent = events
      .filter(e => e.event_date >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];

    // Peak events this year
    const currentYear = new Date().getFullYear();
    const peakCount = events.filter(
      e => e.is_peak && new Date(e.event_date + 'T12:00:00').getFullYear() === currentYear
    ).length;

    return {
      thisMonthCount,
      pendingSuggestions,
      nextEvent,
      peakCount,
    };
  }, [monthEvents, events, pendingSuggestions]);

  // ─── Quarterly peak data ──────────────────────────────
  const currentYear = new Date().getFullYear();

  const peakData = useMemo(() => {
    return QUARTERLY_PEAKS.map((peak) => {
      const peakEvents = events.filter(
        (e) =>
          e.is_peak &&
          peak.monthNumbers.includes(
            new Date(e.event_date + 'T12:00:00').getMonth() + 1
          ) &&
          new Date(e.event_date + 'T12:00:00').getFullYear() === currentYear
      );

      const totalExpected = peakEvents.reduce(
        (sum, e) => sum + (e.expected_revenue || 0),
        0
      );
      const totalActual = peakEvents.reduce(
        (sum, e) => sum + (e.attributed_revenue || 0),
        0
      );
      const eventCount = peakEvents.length;

      const now = new Date();
      const peakMonthsInPast = peak.monthNumbers.every(
        (m) => new Date(currentYear, m - 1, 28) < now
      );
      const peakMonthsInFuture = peak.monthNumbers.every(
        (m) => new Date(currentYear, m - 1, 1) > now
      );

      let status: 'planned' | 'in-progress' | 'completed' = 'planned';
      if (peakMonthsInPast) status = 'completed';
      else if (!peakMonthsInFuture) status = 'in-progress';

      return {
        ...peak,
        peakEvents,
        totalExpected,
        totalActual,
        eventCount,
        status,
      };
    });
  }, [events, currentYear]);

  // ─── Handlers ────────────────────────────────────────
  const openAddDialog = (date?: Date) => {
    setEditingId(null);
    setHashtagInput('');
    setForm({
      ...defaultForm,
      event_date: format(date || new Date(), 'yyyy-MM-dd'),
    });
    setDialogOpen(true);
  };

  const openEditDialog = (event: MarketingEvent) => {
    setEditingId(event.id);
    setHashtagInput('');
    setForm({
      event_date: event.event_date,
      event_type: event.event_type,
      title: event.title,
      description: event.description || '',
      expected_impact: event.expected_impact,
      actual_revenue_impact: event.actual_revenue_impact,
      expected_revenue: event.expected_revenue,
      expected_new_customers: event.expected_new_customers,
      attribution_window_days: event.attribution_window_days || 7,
      why_now: event.why_now,
      is_peak: event.is_peak || false,
      peak_name: event.peak_name,
      peak_phase: event.peak_phase,
      learnings: event.learnings,
      content_type: event.content_type || null,
      platform: event.platform || null,
      status: event.status || 'idea',
      assigned_to: event.assigned_to || null,
      scheduled_time: event.scheduled_time || null,
      copy_text: event.copy_text || null,
      hashtags: event.hashtags || null,
      assets_needed: event.assets_needed || null,
      assets_url: event.assets_url || null,
      approval_notes: event.approval_notes || null,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('El titulo es obligatorio');
      return;
    }
    try {
      if (editingId) {
        await updateEvent({ id: editingId, updates: form });
        toast.success('Evento actualizado');
      } else {
        await addEvent(form);
        toast.success('Evento creado');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Error al guardar el evento');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent(id);
      toast.success('Evento eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleCalculateAttribution = useCallback(
    async (event: MarketingEvent) => {
      setCalculatingId(event.id);
      try {
        const result = await calculateAttribution(event);
        toast.success(
          `Atribucion calculada: ${formatCOP(result.attributed_revenue)} (${result.attributed_orders} ordenes)`
        );
      } catch {
        toast.error('Error al calcular atribucion');
      } finally {
        setCalculatingId(null);
      }
    },
    [calculateAttribution]
  );

  const updateForm = <K extends keyof MarketingEventInput>(
    key: K,
    value: MarketingEventInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const STATUS_CONFIG = {
    planned: { label: 'Planeado', color: 'bg-gray-100 text-gray-600' },
    'in-progress': { label: 'En curso', color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Completado', color: 'bg-green-100 text-green-700' },
  };

  return (
    <FinanceDashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-5">

        {/* ─── 1. HEADER ──────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Marketing Calendar
              </h1>
              <p className="text-sm text-gray-500">
                Registra cada accion para entender que crea resultados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingSuggestions > 0 && (
              <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                {pendingSuggestions} sugerencias IA
              </Badge>
            )}
            <Button onClick={() => openAddDialog()} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo Evento
            </Button>
          </div>
        </div>

        {/* ─── 2. TABS: Calendario | Sugerencias IA | Peaks ── */}
        <Tabs defaultValue="calendario" className="w-full">
          <TabsList className="w-full justify-start bg-white border rounded-lg p-1 h-auto">
            <TabsTrigger value="calendario" className="text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Calendario
            </TabsTrigger>
            <TabsTrigger value="semana" className="text-sm data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
              Semana
            </TabsTrigger>
            <TabsTrigger value="peaks" className="text-sm data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700">
              <Mountain className="h-3.5 w-3.5 mr-1.5" />
              Peaks & Actividad
            </TabsTrigger>
            <TabsTrigger value="sugerencias" className="text-sm data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Sugerencias IA
              {pendingSuggestions > 0 && (
                <Badge className="ml-1.5 bg-violet-100 text-violet-700 border-0 text-[10px] px-1.5 py-0">{pendingSuggestions}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── Tab: Calendario ──────────────────────────────── */}
          <TabsContent value="calendario" className="mt-4 space-y-4">
            <MarketingCalendarView
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              events={events}
              suggestions={suggestions}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onDoubleClickDate={(date) => openAddDialog(date)}
              onEventClick={(event) => openEditDialog(event)}
              onSuggestionClick={(suggestion) => {
                toast.info(
                  `${suggestion.name} — ${suggestion.why_now || suggestion.campaign_idea || 'Sugerencia IA'}`,
                  { duration: 5000 }
                );
              }}
            />

        {/* ─── KPI SUMMARY ROW ──────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <CalendarClock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{kpiData.thisMonthCount}</div>
                <div className="text-xs text-gray-500">Eventos este mes</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{kpiData.pendingSuggestions}</div>
                <div className="text-xs text-gray-500">Sugerencias pendientes</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <Clock className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900 truncate">
                  {kpiData.nextEvent
                    ? format(new Date(kpiData.nextEvent.event_date + 'T12:00:00'), 'd MMM', { locale: es })
                    : '---'}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {kpiData.nextEvent ? kpiData.nextEvent.title : 'Proximo evento'}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Mountain className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{kpiData.peakCount}</div>
                <div className="text-xs text-gray-500">Peaks {currentYear}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Selected date events (inline panel) ─────────── */}
        {selectedDate && selectedDateEvents.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Eventos del{' '}
                  {format(selectedDate, "d 'de' MMMM", { locale: es })}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openAddDialog(selectedDate)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {selectedDateEvents.map((ev) => {
                  const cfg = EVENT_TYPE_CONFIG[ev.event_type];
                  const isExpanded = expandedEventId === ev.id;
                  const eventDate = new Date(ev.event_date + 'T12:00:00');
                  const isEventPast = isPast(addDays(eventDate, ev.attribution_window_days || 7));

                  return (
                    <div
                      key={ev.id}
                      className="border rounded-lg bg-white hover:shadow-sm transition-shadow"
                    >
                      <div
                        className="flex items-start gap-3 p-3 cursor-pointer"
                        onClick={() =>
                          setExpandedEventId(isExpanded ? null : ev.id)
                        }
                      >
                        <div
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                            cfg.color
                          )}
                        >
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm truncate">
                              {ev.title}
                            </span>
                            {ev.is_peak && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 bg-amber-100 text-amber-700"
                              >
                                <Mountain className="h-2.5 w-2.5 mr-0.5" />
                                Peak
                              </Badge>
                            )}
                            {ev.peak_phase && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-[10px] px-1.5',
                                  PEAK_PHASE_CONFIG[ev.peak_phase].color
                                )}
                              >
                                {PEAK_PHASE_CONFIG[ev.peak_phase].label}
                              </Badge>
                            )}
                            {ev.content_type && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-[10px] px-1.5',
                                  CONTENT_TYPE_CONFIG[ev.content_type].color
                                )}
                              >
                                {CONTENT_TYPE_CONFIG[ev.content_type].label}
                              </Badge>
                            )}
                            {ev.status && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-[10px] px-1.5',
                                  EVENT_STATUS_CONFIG[ev.status].color
                                )}
                              >
                                {EVENT_STATUS_CONFIG[ev.status].label}
                              </Badge>
                            )}
                          </div>
                          {ev.platform && ev.platform.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {ev.platform.map((p) => {
                                const plat = PLATFORM_OPTIONS.find((o) => o.value === p);
                                return plat ? (
                                  <span key={p} className="text-[10px] text-gray-500">
                                    {plat.emoji} {plat.label}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}
                          {ev.description && (
                            <p className="text-xs text-gray-500 line-clamp-2">
                              {ev.description}
                            </p>
                          )}
                          {ev.why_now && (
                            <div className="mt-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-block">
                              <strong>Por que ahora:</strong> {ev.why_now}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(ev);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(ev.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && ev.learnings && (
                        <div className="border-t px-4 py-3 bg-gray-50/50">
                          <div className="bg-white border rounded-lg p-3">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                              Aprendizajes
                            </div>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap">
                              {ev.learnings}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

          </TabsContent>

          {/* ─── Tab: Semana ───────────────────────────────────── */}
          <TabsContent value="semana" className="mt-4 space-y-4">
            {/* Week navigation */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setWeekRef((prev) => subWeeks(prev, 1))}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Semana anterior
              </Button>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">S{weekNumber}</div>
                <div className="text-xs text-gray-500">
                  {format(weekDays[0], "d MMM", { locale: es })} – {format(weekDays[6], "d MMM yyyy", { locale: es })}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setWeekRef((prev) => addWeeks(prev, 1))}>
                Semana siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Today button */}
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" className="text-xs text-blue-600" onClick={() => setWeekRef(new Date())}>
                Ir a hoy
              </Button>
            </div>

            {/* 7-column grid */}
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayEvents = weekEventsByDay.get(key) || [];
                const dayIsToday = isToday(day);

                return (
                  <div
                    key={key}
                    className={cn(
                      'border rounded-lg min-h-[200px] flex flex-col',
                      dayIsToday ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200 bg-white'
                    )}
                  >
                    {/* Day header */}
                    <div className={cn(
                      'px-2 py-1.5 border-b text-center',
                      dayIsToday ? 'bg-blue-100 border-blue-200' : 'bg-gray-50 border-gray-100'
                    )}>
                      <div className="text-[10px] font-medium text-gray-500 uppercase">
                        {format(day, 'EEE', { locale: es })}
                      </div>
                      <div className={cn(
                        'text-sm font-bold',
                        dayIsToday ? 'text-blue-700' : 'text-gray-800'
                      )}>
                        {format(day, 'd')}
                      </div>
                    </div>

                    {/* Events */}
                    <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
                      {dayEvents.map((ev) => {
                        const ctCfg = ev.content_type ? CONTENT_TYPE_CONFIG[ev.content_type] : null;
                        const statusCfg = ev.status ? EVENT_STATUS_CONFIG[ev.status] : null;
                        return (
                          <div
                            key={ev.id}
                            onClick={() => openEditDialog(ev)}
                            className="border rounded-md p-1.5 bg-white hover:shadow-sm cursor-pointer transition-shadow space-y-1"
                          >
                            <div className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight">
                              {ev.title}
                            </div>
                            <div className="flex flex-wrap gap-0.5">
                              {ctCfg && (
                                <Badge variant="secondary" className={cn('text-[9px] px-1 py-0', ctCfg.color)}>
                                  {ctCfg.label}
                                </Badge>
                              )}
                              {statusCfg && (
                                <Badge variant="secondary" className={cn('text-[9px] px-1 py-0', statusCfg.color)}>
                                  {statusCfg.label}
                                </Badge>
                              )}
                            </div>
                            {ev.platform && ev.platform.length > 0 && (
                              <div className="flex gap-0.5">
                                {ev.platform.map((p) => {
                                  const plat = PLATFORM_OPTIONS.find((o) => o.value === p);
                                  return plat ? (
                                    <span key={p} className="text-[10px]">{plat.emoji}</span>
                                  ) : null;
                                })}
                              </div>
                            )}
                            {ev.assigned_to && (
                              <div className="text-[9px] text-gray-400 truncate">
                                {ev.assigned_to}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Add button */}
                    <div className="px-1.5 pb-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-6 text-[10px] text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => openAddDialog(day)}
                      >
                        <Plus className="h-3 w-3 mr-0.5" />
                        Agregar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ─── Tab: Sugerencias IA ──────────────────────────── */}
          <TabsContent value="sugerencias" className="mt-4">
            <HolidaySuggestionPanel />
          </TabsContent>

          {/* ─── Tab: Peaks del Año ──────────────────────────── */}
          <TabsContent value="peaks" className="mt-4 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Mountain className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Peaks del Ano — {currentYear}
              </h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {peakData.map((peak) => {
                const statusCfg = STATUS_CONFIG[peak.status];
                return (
                  <div
                    key={peak.quarter}
                    className={cn(
                      'rounded-lg border p-3 flex items-start gap-2.5',
                      peak.bgColor
                    )}
                  >
                    <span className={cn('mt-0.5', peak.color)}>{peak.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {peak.quarter} {peak.name}
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn('text-[9px] px-1 flex-shrink-0', statusCfg.color)}
                        >
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-gray-500">{peak.months}</div>
                      {peak.eventCount > 0 ? (
                        <div className="mt-1 space-y-0.5">
                          {peak.totalExpected > 0 && (
                            <div className="text-[10px] text-gray-600">
                              Esp: {formatCOPShort(peak.totalExpected)}
                            </div>
                          )}
                          {peak.totalActual > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-medium text-gray-800">
                                Act: {formatCOPShort(peak.totalActual)}
                              </span>
                              {peak.totalExpected > 0 && (
                                <DeltaBadge
                                  expected={peak.totalExpected}
                                  actual={peak.totalActual}
                                />
                              )}
                            </div>
                          )}
                          <div className="text-[9px] text-gray-400">
                            {peak.eventCount} evento{peak.eventCount !== 1 && 's'}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-gray-400 italic mt-1">
                          Sin eventos peak
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ─── Activity vs Revenue ─────────────────────────── */}
        <ActivityRevenueChart
          dailyData={activity.dailyData}
          summary={activity.summary}
          isLoading={activity.isLoading}
        />

        {/* ─── All month events table ──────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Todos los eventos —{' '}
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </h3>
              <span className="text-xs text-gray-400">
                {monthEvents.length} evento{monthEvents.length !== 1 && 's'}
              </span>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-sm text-gray-400">
                Cargando eventos...
              </div>
            ) : monthEvents.length === 0 ? (
              <div className="py-8 text-center">
                <CalendarDays className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400 mb-3">
                  No hay eventos este mes
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openAddDialog()}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Crear primer evento
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">
                        Fecha
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 w-28">
                        Tipo
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">
                        Evento
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 w-28">
                        Estado
                      </th>
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {monthEvents.map((ev) => {
                      const cfg = EVENT_TYPE_CONFIG[ev.event_type];
                      return (
                        <tr key={ev.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500 text-xs">
                            {format(
                              new Date(ev.event_date + 'T12:00:00'),
                              'd MMM',
                              { locale: es }
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div
                              className={cn(
                                'inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border',
                                cfg.color
                              )}
                            >
                              {cfg.icon}
                              {cfg.label}
                            </div>
                            {ev.is_peak && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1 ml-1 bg-amber-100 text-amber-700"
                              >
                                Peak
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{ev.title}</span>
                              {ev.content_type && (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'text-[9px] px-1',
                                    CONTENT_TYPE_CONFIG[ev.content_type].color
                                  )}
                                >
                                  {CONTENT_TYPE_CONFIG[ev.content_type].label}
                                </Badge>
                              )}
                            </div>
                            {ev.assigned_to && (
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                Responsable: {ev.assigned_to}
                              </div>
                            )}
                            {ev.platform && ev.platform.length > 0 && (
                              <div className="flex gap-1 mt-0.5">
                                {ev.platform.map((p) => {
                                  const plat = PLATFORM_OPTIONS.find((o) => o.value === p);
                                  return plat ? (
                                    <span key={p} className="text-[10px] text-gray-400">
                                      {plat.emoji}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                            {ev.description && (
                              <div className="text-xs text-gray-400 truncate max-w-[300px]">
                                {ev.description}
                              </div>
                            )}
                            {ev.why_now && (
                              <div className="text-[10px] text-indigo-500 truncate max-w-[300px]">
                                Por que ahora: {ev.why_now}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {ev.status && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-[10px] px-1.5',
                                  EVENT_STATUS_CONFIG[ev.status].color
                                )}
                              >
                                {EVENT_STATUS_CONFIG[ev.status].label}
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => openEditDialog(ev)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                onClick={() => handleDelete(ev.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Dialog — Redesigned with sections, hierarchy, and polish */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[520px] max-h-[90vh] overflow-y-auto p-0 gap-0">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold tracking-tight text-slate-900">
                {editingId ? 'Editar Contenido' : 'Nuevo Contenido'}
              </DialogTitle>
              {!editingId && (
                <p className="text-xs text-slate-400 mt-0.5">Planea y documenta cada pieza de contenido</p>
              )}
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* ── Section 1: Esencial ──────────────────────── */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-slate-700">
                  Titulo <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={form.title}
                  onChange={(e) => updateForm('title', e.target.value)}
                  placeholder="Ej: Reel de lanzamiento coleccion verano"
                  className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-slate-700">Formato</Label>
                  <select
                    value={form.content_type || ''}
                    onChange={(e) =>
                      updateForm('content_type', (e.target.value as ContentType) || null)
                    }
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-colors cursor-pointer"
                  >
                    <option value="">Sin especificar</option>
                    {CONTENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-slate-700">Estado</Label>
                  <select
                    value={form.status || 'idea'}
                    onChange={(e) =>
                      updateForm('status', e.target.value as EventStatus)
                    }
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-colors cursor-pointer"
                  >
                    {EVENT_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-slate-700">Plataformas</Label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map((opt) => {
                    const selected = form.platform?.includes(opt.value) || false;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          const current = form.platform || [];
                          const updated = selected
                            ? current.filter((p) => p !== opt.value)
                            : [...current, opt.value];
                          updateForm('platform', updated.length > 0 ? updated : null);
                        }}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer',
                          selected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                        )}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <span className="text-sm leading-none">{opt.emoji}</span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-slate-700">Fecha</Label>
                  <Input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => updateForm('event_date', e.target.value)}
                    className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-slate-700">Hora</Label>
                  <Input
                    type="time"
                    value={form.scheduled_time || ''}
                    onChange={(e) => updateForm('scheduled_time', e.target.value || null)}
                    className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-slate-700">Responsable</Label>
                  <Input
                    value={form.assigned_to || ''}
                    onChange={(e) => updateForm('assigned_to', e.target.value || null)}
                    placeholder="Nombre"
                    className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* ── Divider ──────────────────────────────────── */}
            <div className="border-t border-slate-100" />

            {/* ── Section 2: Contenido ─────────────────────── */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Contenido</h3>

              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-slate-700">Brief / Instrucciones</Label>
                <Textarea
                  value={form.description || ''}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="Describe el contenido, objetivo, audiencia..."
                  className="text-sm min-h-[56px] border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 resize-y transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[13px] font-medium text-slate-700">Copy / Caption</Label>
                  <span className={cn(
                    'text-[11px] tabular-nums',
                    (form.copy_text || '').length > 2000 ? 'text-amber-500 font-medium' : 'text-slate-300'
                  )}>
                    {(form.copy_text || '').length}/2200
                  </span>
                </div>
                <Textarea
                  value={form.copy_text || ''}
                  onChange={(e) => {
                    if (e.target.value.length <= 2200) {
                      updateForm('copy_text', e.target.value || null);
                    }
                  }}
                  placeholder="Texto del post, caption, copy del email..."
                  className="text-sm min-h-[72px] border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 resize-y transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-slate-700">Hashtags</Label>
                <div className="flex gap-2">
                  <Input
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const tag = hashtagInput.trim().replace(/^#/, '');
                        if (tag) {
                          const current = form.hashtags || [];
                          if (!current.includes(`#${tag}`)) {
                            updateForm('hashtags', [...current, `#${tag}`]);
                          }
                          setHashtagInput('');
                        }
                      }
                    }}
                    placeholder="Escribe y presiona Enter..."
                    className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-10 w-10 p-0 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                    onClick={() => {
                      const tag = hashtagInput.trim().replace(/^#/, '');
                      if (tag) {
                        const current = form.hashtags || [];
                        if (!current.includes(`#${tag}`)) {
                          updateForm('hashtags', [...current, `#${tag}`]);
                        }
                        setHashtagInput('');
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 text-slate-500" />
                  </Button>
                </div>
                {form.hashtags && form.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.hashtags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 cursor-pointer hover:bg-red-50 hover:text-red-500 transition-colors duration-150 group"
                        onClick={() => {
                          const updated = form.hashtags!.filter((_, i) => i !== idx);
                          updateForm('hashtags', updated.length > 0 ? updated : null);
                        }}
                      >
                        {tag}
                        <X className="h-3 w-3 text-slate-400 group-hover:text-red-400 transition-colors" />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Divider ──────────────────────────────────── */}
            <div className="border-t border-slate-100" />

            {/* ── Section 3: Assets & Produccion ───────────── */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assets & Produccion</h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-slate-700">Assets necesarios</Label>
                  <Input
                    value={form.assets_needed || ''}
                    onChange={(e) => updateForm('assets_needed', e.target.value || null)}
                    placeholder="Fotos, video, diseño..."
                    className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-slate-700">Link de assets</Label>
                  <Input
                    value={form.assets_url || ''}
                    onChange={(e) => updateForm('assets_url', e.target.value || null)}
                    placeholder="Drive, Figma, Canva..."
                    className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-slate-700">Notas de Aprobacion</Label>
                <Textarea
                  value={form.approval_notes || ''}
                  onChange={(e) => updateForm('approval_notes', e.target.value || null)}
                  placeholder="Feedback del equipo, cambios requeridos..."
                  className="text-sm min-h-[56px] border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 resize-y transition-colors"
                />
              </div>
            </div>

            {/* ── Divider ──────────────────────────────────── */}
            <div className="border-t border-slate-100" />

            {/* ── Section 4: Estrategia (collapsible feel) ── */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estrategia</h3>

              <div className="space-y-1.5 bg-gradient-to-br from-indigo-50/80 to-blue-50/40 border border-indigo-100 rounded-xl p-4">
                <Label className="text-[13px] font-semibold text-indigo-700">
                  Por que ahora?
                </Label>
                <Textarea
                  value={form.why_now || ''}
                  onChange={(e) => updateForm('why_now', e.target.value)}
                  placeholder="Que hace que ESTE momento sea el correcto?"
                  className="bg-white/80 text-sm min-h-[56px] border-indigo-200/60 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-300 resize-y transition-colors"
                />
                <p className="text-[10px] text-indigo-400/80 mt-1">
                  Prophit System — registra la razon estrategica de cada accion
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is-peak"
                    checked={form.is_peak || false}
                    onCheckedChange={(checked) =>
                      updateForm('is_peak', checked === true)
                    }
                  />
                  <Label htmlFor="is-peak" className="text-[13px] font-medium text-slate-700 cursor-pointer">
                    Evento Peak
                  </Label>
                  <Mountain className="h-3.5 w-3.5 text-amber-500" />
                </div>

                {form.is_peak && (
                  <div className="grid grid-cols-2 gap-3 pl-6 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700">Nombre</Label>
                      <Input
                        value={form.peak_name || ''}
                        onChange={(e) => updateForm('peak_name', e.target.value)}
                        placeholder="Ej: Hot Days 2026"
                        className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-slate-700">Fase</Label>
                      <select
                        value={form.peak_phase || ''}
                        onChange={(e) =>
                          updateForm(
                            'peak_phase',
                            (e.target.value as PeakPhase) || null
                          )
                        }
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-colors cursor-pointer"
                      >
                        <option value="">Seleccionar</option>
                        {PEAK_PHASE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {editingId && (
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-slate-700">Aprendizajes</Label>
                  <Textarea
                    value={form.learnings || ''}
                    onChange={(e) => updateForm('learnings', e.target.value)}
                    placeholder="Que aprendimos? Que hariamos diferente?"
                    className="text-sm min-h-[56px] border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 resize-y transition-colors"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Sticky Footer ──────────────────────────────── */}
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center gap-3">
            {editingId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Eliminar este contenido?')) {
                    handleDelete(editingId);
                    setDialogOpen(false);
                  }
                }}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Eliminar
              </Button>
            )}
            <div className="flex-1" />
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 transition-all duration-150 active:scale-[0.97] cursor-pointer"
            >
              {editingId ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </FinanceDashboardLayout>
  );
};

export default MarketingCalendarPage;
