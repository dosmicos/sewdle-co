import React, { useState, useMemo, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
  isFuture,
} from 'date-fns';
import { es } from 'date-fns/locale';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import ActivityRevenueChart from '@/components/finance-dashboard/ActivityRevenueChart';
import MarketingCalendarView from '@/components/marketing-calendar/MarketingCalendarView';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import { useMarketingActivity } from '@/hooks/useMarketingActivity';
import { useHolidaySuggestions } from '@/hooks/useHolidaySuggestions';
import type { MarketingEvent, MarketingEventInput, EventType, ImpactLevel, PeakPhase, ContentType, Platform } from '@/hooks/useMarketingEvents';
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
};

// ─── Page Component ───────────────────────────────────────
const MarketingCalendarPage: React.FC = () => {
  const { events, isLoading, addEvent, updateEvent, deleteEvent, calculateAttribution } =
    useMarketingEvents();
  const { suggestions, suggestedCount: pendingSuggestions } = useHolidaySuggestions();

  const [currentMonth, setCurrentMonth] = useState(new Date());

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
    setForm({
      ...defaultForm,
      event_date: format(date || new Date(), 'yyyy-MM-dd'),
    });
    setDialogOpen(true);
  };

  const openEditDialog = (event: MarketingEvent) => {
    setEditingId(event.id);
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
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('El titulo es obligatorio');
      return;
    }
    if (form.expected_impact === 'high' && !form.why_now?.trim()) {
      toast.error('"Por que ahora?" es obligatorio para eventos de alto impacto');
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
                  const impact = IMPACT_CONFIG[ev.expected_impact];
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
                            <Badge
                              variant="secondary"
                              className={cn('text-[10px] px-1.5', impact.color)}
                            >
                              {impact.label}
                            </Badge>
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
                          <div className="mt-1">
                            <ExpectedVsActual
                              expected={ev.expected_revenue}
                              actual={ev.attributed_revenue}
                            />
                          </div>
                          {ev.ad_spend_during != null &&
                            ev.ad_spend_during > 0 &&
                            ev.roas_during != null && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                Ad Spend: {formatCOPShort(ev.ad_spend_during)} | ROAS:{' '}
                                {ev.roas_during.toFixed(1)}x
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

                      {/* Expanded Impact Section */}
                      {isExpanded && (
                        <div className="border-t px-4 py-3 bg-gray-50/50 space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="h-4 w-4 text-gray-600" />
                            <h4 className="text-sm font-semibold text-gray-700">
                              Impacto del Evento
                            </h4>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-white rounded-lg border p-2.5">
                              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                                Revenue Atribuido
                              </div>
                              <div className="text-sm font-semibold">
                                {ev.attributed_revenue != null
                                  ? formatCOP(ev.attributed_revenue)
                                  : '---'}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg border p-2.5">
                              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                                Ordenes Atribuidas
                              </div>
                              <div className="text-sm font-semibold">
                                {ev.attributed_orders != null
                                  ? ev.attributed_orders
                                  : '---'}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg border p-2.5">
                              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                                Delta vs Esperado
                              </div>
                              <div className="text-sm font-semibold">
                                {ev.expected_revenue != null &&
                                ev.attributed_revenue != null ? (
                                  <DeltaBadge
                                    expected={ev.expected_revenue}
                                    actual={ev.attributed_revenue}
                                  />
                                ) : (
                                  '---'
                                )}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg border p-2.5">
                              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                                ROI
                              </div>
                              <div className="text-sm font-semibold">
                                {ev.roi_percent != null ? (
                                  <span
                                    className={
                                      ev.roi_percent >= 0
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }
                                  >
                                    {ev.roi_percent.toFixed(0)}%
                                  </span>
                                ) : (
                                  '---'
                                )}
                              </div>
                            </div>
                          </div>

                          {isEventPast && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled={calculatingId === ev.id}
                              onClick={() => handleCalculateAttribution(ev)}
                            >
                              <RefreshCw
                                className={cn(
                                  'h-3 w-3 mr-1',
                                  calculatingId === ev.id && 'animate-spin'
                                )}
                              />
                              {calculatingId === ev.id
                                ? 'Calculando...'
                                : 'Calcular Atribucion'}
                            </Button>
                          )}

                          {ev.learnings && (
                            <div className="bg-white border rounded-lg p-3">
                              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                                Aprendizajes
                              </div>
                              <p className="text-xs text-gray-700 whitespace-pre-wrap">
                                {ev.learnings}
                              </p>
                            </div>
                          )}
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
                      <th className="text-center px-3 py-2 font-medium text-gray-600 w-20">
                        Impacto
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-48">
                        Esperado vs Actual
                      </th>
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {monthEvents.map((ev) => {
                      const cfg = EVENT_TYPE_CONFIG[ev.event_type];
                      const impact = IMPACT_CONFIG[ev.expected_impact];
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
                          <td className="px-3 py-2 text-center">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] px-1.5',
                                impact.color
                              )}
                            >
                              {impact.label}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {ev.expected_revenue != null ||
                            ev.attributed_revenue != null ? (
                              <div className="space-y-0.5">
                                <ExpectedVsActual
                                  expected={ev.expected_revenue}
                                  actual={ev.attributed_revenue}
                                />
                                {ev.ad_spend_during != null &&
                                  ev.roas_during != null && (
                                    <div className="text-[10px] text-gray-400">
                                      ROAS: {ev.roas_during.toFixed(1)}x
                                    </div>
                                  )}
                              </div>
                            ) : ev.actual_revenue_impact != null ? (
                              formatCOP(ev.actual_revenue_impact)
                            ) : (
                              <span className="text-gray-300">---</span>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Evento' : 'Nuevo Evento de Marketing'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Titulo</Label>
              <Input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="Ej: Lanzamiento Ruana Premium, Hot Days -30%"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Fecha</Label>
                <Input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => updateForm('event_date', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Tipo de evento</Label>
                <select
                  value={form.event_type}
                  onChange={(e) =>
                    updateForm('event_type', e.target.value as EventType)
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Descripcion (opcional)</Label>
              <Input
                value={form.description || ''}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Detalles del evento, audiencia, canales..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Tipo de contenido</Label>
                <select
                  value={form.content_type || ''}
                  onChange={(e) =>
                    updateForm('content_type', (e.target.value as ContentType) || null)
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                <Label className="text-sm">Plataformas</Label>
                <div className="flex flex-wrap gap-1.5">
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
                          'px-2 py-1 rounded-full text-xs font-medium border transition-colors',
                          selected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                        )}
                      >
                        {opt.emoji} {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <Label className="text-sm font-semibold text-indigo-700">
                Por que ahora?{' '}
                {form.expected_impact === 'high' && (
                  <span className="text-red-500">*</span>
                )}
              </Label>
              <Textarea
                value={form.why_now || ''}
                onChange={(e) => updateForm('why_now', e.target.value)}
                placeholder="Que hace que ESTE momento sea el correcto para esta accion?"
                className="bg-white text-sm min-h-[60px]"
              />
              <p className="text-[10px] text-indigo-400">
                Clave del Prophit System: documenta la razon estrategica
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Impacto esperado</Label>
                <select
                  value={form.expected_impact}
                  onChange={(e) =>
                    updateForm(
                      'expected_impact',
                      e.target.value as ImpactLevel
                    )
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {IMPACT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Revenue real (COP)</Label>
                <Input
                  type="number"
                  value={form.actual_revenue_impact ?? ''}
                  onChange={(e) =>
                    updateForm(
                      'actual_revenue_impact',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  placeholder="Despues del evento"
                  min={0}
                  step={10000}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Revenue Esperado (COP)</Label>
                <Input
                  type="number"
                  value={form.expected_revenue ?? ''}
                  onChange={(e) =>
                    updateForm(
                      'expected_revenue',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  placeholder="Meta de ventas"
                  min={0}
                  step={100000}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Nuevos Clientes Esperados</Label>
                <Input
                  type="number"
                  value={form.expected_new_customers ?? ''}
                  onChange={(e) =>
                    updateForm(
                      'expected_new_customers',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  placeholder="# clientes nuevos"
                  min={0}
                  step={1}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Ventana de atribucion (dias)</Label>
              <Input
                type="number"
                value={form.attribution_window_days ?? 7}
                onChange={(e) =>
                  updateForm(
                    'attribution_window_days',
                    e.target.value ? Number(e.target.value) : 7
                  )
                }
                min={1}
                max={30}
                step={1}
              />
              <p className="text-[10px] text-gray-400">
                Ordenes de Shopify entre la fecha del evento y +N dias se atribuyen a este evento
              </p>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-peak"
                  checked={form.is_peak || false}
                  onCheckedChange={(checked) =>
                    updateForm('is_peak', checked === true)
                  }
                />
                <Label htmlFor="is-peak" className="text-sm font-medium cursor-pointer">
                  Es un evento Peak
                </Label>
                <Mountain className="h-3.5 w-3.5 text-amber-500" />
              </div>

              {form.is_peak && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Nombre del Peak</Label>
                    <Input
                      value={form.peak_name || ''}
                      onChange={(e) => updateForm('peak_name', e.target.value)}
                      placeholder="Ej: Hot Days 2026"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Fase</Label>
                    <select
                      value={form.peak_phase || ''}
                      onChange={(e) =>
                        updateForm(
                          'peak_phase',
                          (e.target.value as PeakPhase) || null
                        )
                      }
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Seleccionar fase</option>
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
                <Label className="text-sm">Aprendizajes</Label>
                <Textarea
                  value={form.learnings || ''}
                  onChange={(e) => updateForm('learnings', e.target.value)}
                  placeholder="Que aprendimos de este evento? Que hariamos diferente?"
                  className="text-sm min-h-[60px]"
                />
              </div>
            )}

            <div className={cn('flex gap-2', editingId ? 'flex-row' : '')}>
              {editingId && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm('¿Eliminar este evento?')) {
                      handleDelete(editingId);
                      setDialogOpen(false);
                    }
                  }}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Eliminar
                </Button>
              )}
              <Button onClick={handleSave} className="flex-1">
                {editingId ? 'Guardar Cambios' : 'Crear Evento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </FinanceDashboardLayout>
  );
};

export default MarketingCalendarPage;
