import React, { useState, useMemo } from 'react';
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
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import type { MarketingEvent, MarketingEventInput, EventType, ImpactLevel } from '@/hooks/useMarketingEvents';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
    label: 'Promoción',
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
  { value: 'promotion', label: 'Promoción / Sale' },
  { value: 'email_campaign', label: 'Campaña de email' },
  { value: 'sms_blast', label: 'SMS Blast' },
  { value: 'influencer_collab', label: 'Colaboración influencer' },
  { value: 'pr_hit', label: 'PR / Prensa' },
  { value: 'organic_viral', label: 'Orgánico viral' },
  { value: 'cultural_moment', label: 'Momento cultural' },
  { value: 'price_change', label: 'Cambio de precio' },
  { value: 'new_creative_batch', label: 'Batch de creativos' },
  { value: 'channel_expansion', label: 'Expansión de canal' },
  { value: 'other', label: 'Otro' },
];

const IMPACT_OPTIONS: { value: ImpactLevel; label: string }[] = [
  { value: 'high', label: 'Alto' },
  { value: 'medium', label: 'Medio' },
  { value: 'low', label: 'Bajo' },
];

const formatCOP = (amount: number) =>
  `COP ${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount))}`;

// ─── Default form ─────────────────────────────────────────
const defaultForm: MarketingEventInput = {
  event_date: new Date().toISOString().split('T')[0],
  event_type: 'promotion',
  title: '',
  description: '',
  expected_impact: 'medium',
  actual_revenue_impact: null,
};

// ─── Page Component ───────────────────────────────────────
const MarketingCalendarPage: React.FC = () => {
  const { events, isLoading, addEvent, updateEvent, deleteEvent } =
    useMarketingEvents();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MarketingEventInput>(defaultForm);

  // ─── Calendar grid ───────────────────────────────────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = gridStart;
    while (day <= gridEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

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
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('El título es obligatorio');
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

  const updateForm = <K extends keyof MarketingEventInput>(
    key: K,
    value: MarketingEventInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Day names ───────────────────────────────────────
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <FinanceDashboardLayout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Marketing Calendar
              </h1>
              <p className="text-sm text-gray-500">
                Registra cada acción de marketing para entender qué acciones
                crean qué resultados
              </p>
            </div>
          </div>
          <Button onClick={() => openAddDialog()}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo Evento
          </Button>
        </div>

        {/* Month navigation + Calendar */}
        <Card>
          <CardContent className="p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px mb-1">
              {dayNames.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-gray-500 py-2"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {calendarDays.map((day, idx) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate.get(dateKey) || [];
                const inMonth = isSameMonth(day, currentMonth);
                const today = isToday(day);
                const isSelected =
                  selectedDate && isSameDay(day, selectedDate);

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(day)}
                    onDoubleClick={() => openAddDialog(day)}
                    className={cn(
                      'min-h-[80px] p-1.5 text-left transition-colors flex flex-col',
                      inMonth ? 'bg-white' : 'bg-gray-50',
                      isSelected && 'ring-2 ring-blue-500 ring-inset',
                      !isSelected && 'hover:bg-blue-50/50'
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                        !inMonth && 'text-gray-300',
                        inMonth && !today && 'text-gray-700',
                        today && 'bg-blue-600 text-white'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const cfg = EVENT_TYPE_CONFIG[ev.event_type];
                        return (
                          <div
                            key={ev.id}
                            className={cn(
                              'text-[10px] leading-tight px-1 py-0.5 rounded truncate border',
                              cfg.color
                            )}
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-gray-400 px-1">
                          +{dayEvents.length - 3} más
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected date events */}
        {selectedDate && selectedDateEvents.length > 0 && (
          <Card>
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
                  return (
                    <div
                      key={ev.id}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50"
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
                        </div>
                        {ev.description && (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {ev.description}
                          </p>
                        )}
                        {ev.actual_revenue_impact != null && (
                          <p className="text-xs text-green-600 mt-1 font-medium">
                            Impacto real: {formatCOP(ev.actual_revenue_impact)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
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
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All month events list */}
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
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-36">
                        Revenue Real
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
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{ev.title}</div>
                            {ev.description && (
                              <div className="text-xs text-gray-400 truncate max-w-[300px]">
                                {ev.description}
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
                          <td className="px-3 py-2 text-right font-medium">
                            {ev.actual_revenue_impact != null
                              ? formatCOP(ev.actual_revenue_impact)
                              : '—'}
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

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                  <span className="text-[10px] text-gray-500">{cfg.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Evento' : 'Nuevo Evento de Marketing'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Título</Label>
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
              <Label className="text-sm">Descripción (opcional)</Label>
              <Input
                value={form.description || ''}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Detalles del evento, audiencia, canales..."
              />
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
                  placeholder="Después del evento"
                  min={0}
                  step={10000}
                />
              </div>
            </div>

            <Button onClick={handleSave} className="w-full">
              {editingId ? 'Guardar Cambios' : 'Crear Evento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </FinanceDashboardLayout>
  );
};

export default MarketingCalendarPage;
