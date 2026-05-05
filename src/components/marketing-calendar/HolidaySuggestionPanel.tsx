import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sparkles,
  Check,
  X,
  RotateCcw,
  Plus,
  Flame,
  Target,
  Mountain,
  Zap,
  RefreshCw,
  Lightbulb,
  Filter,
  Calendar,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useHolidaySuggestions,
  type HolidaySuggestion,
  type SuggestionFilters,
} from '@/hooks/useHolidaySuggestions';

// ─── Config ─────────────────────────────────────────────
const QUARTER_CONFIG = {
  q1: { label: 'Q1', fullLabel: 'Q1 Hot Days', icon: Flame, iconColor: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
  q2: { label: 'Q2', fullLabel: 'Q2 Dia Madre', icon: Target, iconColor: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-200' },
  q3: { label: 'Q3', fullLabel: 'Q3 Frio', icon: Mountain, iconColor: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
  q4: { label: 'Q4', fullLabel: 'Q4 BF+Nav', icon: Zap, iconColor: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200' },
} as const;

const IMPACT_BADGE = {
  high: { label: 'Alto', className: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Medio', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  low: { label: 'Bajo', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const MARKET_FLAG: Record<string, string> = {
  co: '\u{1F1E8}\u{1F1F4}',
  us: '\u{1F1FA}\u{1F1F8}',
  both: '\u{1F1E8}\u{1F1F4}\u{1F1FA}\u{1F1F8}',
};

const CATEGORY_LABEL: Record<string, string> = {
  cultural: 'Cultural',
  commercial: 'Comercial',
  brand: 'Marca',
  seasonal: 'Temporal',
};

// ─── Detail Popover for a suggestion ────────────────────
const SuggestionDetailDialog: React.FC<{
  suggestion: HolidaySuggestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ suggestion, open, onOpenChange }) => {
  if (!suggestion) return null;
  const quarter = suggestion.quarter_peak ? QUARTER_CONFIG[suggestion.quarter_peak] : null;
  const QuarterIcon = quarter?.icon || Calendar;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{MARKET_FLAG[suggestion.market]}</span>
            {suggestion.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="text-xs">
              {format(new Date(suggestion.date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}
            </Badge>
            <Badge variant="secondary" className={cn('text-xs border', IMPACT_BADGE[suggestion.expected_impact].className)}>
              {IMPACT_BADGE[suggestion.expected_impact].label}
            </Badge>
            {quarter && (
              <Badge variant="outline" className="text-xs gap-1">
                <QuarterIcon className={cn('h-3 w-3', quarter.iconColor)} />
                {quarter.fullLabel}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABEL[suggestion.category] || suggestion.category}
            </Badge>
            {suggestion.is_ai_generated ? (
              <Badge variant="outline" className="text-xs gap-1 border-violet-200 text-violet-600">
                <Bot className="h-3 w-3" /> IA
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1">
                <User className="h-3 w-3" /> Manual
              </Badge>
            )}
          </div>
          {suggestion.why_now && (
            <div className="bg-indigo-50 rounded-md p-3">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                <Target className="h-3 w-3" />
                Por que ahora
              </div>
              <p className="text-sm text-indigo-800 leading-relaxed">{suggestion.why_now}</p>
            </div>
          )}
          {suggestion.campaign_idea && (
            <div className="bg-amber-50 rounded-md p-3">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">
                <Lightbulb className="h-3 w-3" />
                Idea de campana
              </div>
              <p className="text-sm text-amber-800 leading-relaxed">{suggestion.campaign_idea}</p>
            </div>
          )}
          <div className="flex gap-2 text-xs text-gray-400 pt-1">
            <span>Tipo sugerido: {suggestion.suggested_event_type}</span>
            {suggestion.source_model && (
              <>
                <span>|</span>
                <span>Modelo: {suggestion.source_model}</span>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Manual Suggestion Dialog ───────────────────────────
const ManualSuggestionDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  year: number;
}> = ({ open, onOpenChange, onSave, year }) => {
  const [form, setForm] = useState({
    name: '',
    date: '',
    market: 'both' as 'co' | 'us' | 'both',
    category: 'commercial' as 'cultural' | 'commercial' | 'brand' | 'seasonal',
    expected_impact: 'medium' as 'high' | 'medium' | 'low',
    why_now: '',
    quarter_peak: 'q1' as 'q1' | 'q2' | 'q3' | 'q4',
    suggested_event_type: 'promotion',
    campaign_idea: '',
    status: 'suggested' as const,
    year,
  });

  const handleSave = () => {
    if (!form.name.trim() || !form.date) {
      toast.error('Nombre y fecha son obligatorios');
      return;
    }
    onSave(form);
    onOpenChange(false);
    setForm({ ...form, name: '', date: '', why_now: '', campaign_idea: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Fecha Manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Nombre</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Aniversario Dosmicos" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Fecha</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Mercado</Label>
              <select value={form.market} onChange={e => setForm({ ...form, market: e.target.value as any })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="co">Colombia</option>
                <option value="us">USA</option>
                <option value="both">Ambos</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Categoria</Label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as any })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="cultural">Cultural</option>
                <option value="commercial">Comercial</option>
                <option value="brand">Marca</option>
                <option value="seasonal">Temporal</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Impacto</Label>
              <select value={form.expected_impact} onChange={e => setForm({ ...form, expected_impact: e.target.value as any })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="high">Alto</option>
                <option value="medium">Medio</option>
                <option value="low">Bajo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Quarter</Label>
              <select value={form.quarter_peak} onChange={e => setForm({ ...form, quarter_peak: e.target.value as any })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="q1">Q1 - Hot Days</option>
                <option value="q2">Q2 - Dia Madre</option>
                <option value="q3">Q3 - Frio</option>
                <option value="q4">Q4 - BF+Nav</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo</Label>
              <select value={form.suggested_event_type} onChange={e => setForm({ ...form, suggested_event_type: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="promotion">Promocion</option>
                <option value="cultural_moment">Momento Cultural</option>
                <option value="product_launch">Lanzamiento</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Por que ahora?</Label>
            <Textarea value={form.why_now} onChange={e => setForm({ ...form, why_now: e.target.value })} placeholder="Justificacion estrategica..." className="text-sm min-h-[50px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Idea de campana</Label>
            <Textarea value={form.campaign_idea} onChange={e => setForm({ ...form, campaign_idea: e.target.value })} placeholder="Idea breve de campana..." className="text-sm min-h-[50px]" />
          </div>
          <Button onClick={handleSave} className="w-full">Agregar Fecha</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Panel ─────────────────────────────────────────
const HolidaySuggestionPanel: React.FC = () => {
  const [showFilters, setShowFilters] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [detailSuggestion, setDetailSuggestion] = useState<HolidaySuggestion | null>(null);
  const [filters, setFilters] = useState<SuggestionFilters>({});

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const {
    suggestions,
    isLoading,
    suggestedCount,
    acceptedCount,
    dismissedCount,
    generateSuggestions,
    isGenerating,
    acceptSuggestion,
    isAccepting,
    dismissSuggestion,
    restoreSuggestion,
    addManualSuggestion,
  } = useHolidaySuggestions({ ...filters, year: selectedYear });

  // Group by quarter for compact counters
  const byQuarter = useMemo(() => {
    const grouped: Record<string, number> = { q1: 0, q2: 0, q3: 0, q4: 0 };
    for (const s of suggestions) {
      const key = s.quarter_peak || 'q1';
      if (grouped[key] !== undefined) grouped[key]++;
    }
    return grouped;
  }, [suggestions]);

  const handleGenerate = async () => {
    try {
      const result = await generateSuggestions(selectedYear);
      toast.success(`${result.new_inserts} nuevas fechas sugeridas por Gemini`);
    } catch {
      toast.error('Error al generar sugerencias');
    }
  };

  const handleAccept = async (suggestion: HolidaySuggestion) => {
    try {
      await acceptSuggestion(suggestion);
      toast.success(`"${suggestion.name}" agregado al calendario`);
    } catch {
      toast.error('Error al agregar al calendario');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissSuggestion(id);
    } catch {
      toast.error('Error al descartar');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreSuggestion(id);
      toast.success('Sugerencia restaurada');
    } catch {
      toast.error('Error al restaurar');
    }
  };

  const handleAddManual = async (data: any) => {
    try {
      await addManualSuggestion(data);
      toast.success('Fecha manual agregada');
    } catch {
      toast.error('Error al agregar fecha manual');
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Sugerencias IA
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{suggestedCount} pendientes</span>
                  <span className="text-gray-300">|</span>
                  <span>{acceptedCount} aceptadas</span>
                  <span className="text-gray-300">|</span>
                  <span>{dismissedCount} descartadas</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Compact quarter counters */}
              <div className="hidden sm:flex items-center gap-1">
                {(Object.entries(QUARTER_CONFIG) as [string, typeof QUARTER_CONFIG['q1']][]).map(([key, config]) => {
                  const QuIcon = config.icon;
                  const count = byQuarter[key] || 0;
                  const isActive = filters.quarter_peak === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setFilters(prev => ({ ...prev, quarter_peak: prev.quarter_peak === key ? null : key }))}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all border',
                        isActive
                          ? `${config.bg} ${config.border} font-medium`
                          : 'border-transparent hover:bg-gray-50 text-gray-500',
                      )}
                    >
                      <QuIcon className={cn('h-3 w-3', config.iconColor)} />
                      <span>{config.label}</span>
                      <span className="text-[10px] text-gray-400">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="h-4 w-px bg-gray-200 hidden sm:block" />

              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value={currentYear}>{currentYear}</option>
                <option value={currentYear + 1}>{currentYear + 1}</option>
              </select>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowFilters(!showFilters)}
                className={cn('h-8', showFilters && 'bg-gray-100')}
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">Filtros</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setManualDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">Manual</span>
              </Button>

              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="h-8 bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isGenerating ? (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                <span className="text-xs">{isGenerating ? 'Generando...' : 'Generar IA'}</span>
              </Button>
            </div>
          </div>

          {/* Filters row (collapsible) */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg border">
              {/* Quarter filter (mobile) */}
              <select
                value={filters.quarter_peak || ''}
                onChange={e => setFilters({ ...filters, quarter_peak: e.target.value || null })}
                className="h-7 rounded-md border border-input bg-white px-2 text-xs sm:hidden"
              >
                <option value="">Todos Q</option>
                <option value="q1">Q1 Hot Days</option>
                <option value="q2">Q2 Dia Madre</option>
                <option value="q3">Q3 Frio</option>
                <option value="q4">Q4 BF+Nav</option>
              </select>
              <select
                value={filters.market || ''}
                onChange={e => setFilters({ ...filters, market: (e.target.value || null) as any })}
                className="h-7 rounded-md border border-input bg-white px-2 text-xs"
              >
                <option value="">Todos mercados</option>
                <option value="co">Colombia</option>
                <option value="us">USA</option>
                <option value="both">Ambos</option>
              </select>
              <select
                value={filters.status || ''}
                onChange={e => setFilters({ ...filters, status: (e.target.value || null) as any })}
                className="h-7 rounded-md border border-input bg-white px-2 text-xs"
              >
                <option value="">Todos estados</option>
                <option value="suggested">Pendientes</option>
                <option value="accepted">Aceptadas</option>
                <option value="dismissed">Descartadas</option>
              </select>
              <select
                value={filters.category || ''}
                onChange={e => setFilters({ ...filters, category: e.target.value || null })}
                className="h-7 rounded-md border border-input bg-white px-2 text-xs"
              >
                <option value="">Todas categorias</option>
                <option value="cultural">Cultural</option>
                <option value="commercial">Comercial</option>
                <option value="brand">Marca</option>
                <option value="seasonal">Temporal</option>
              </select>
              <select
                value={filters.is_ai_generated === null || filters.is_ai_generated === undefined ? '' : String(filters.is_ai_generated)}
                onChange={e => setFilters({ ...filters, is_ai_generated: e.target.value === '' ? null : e.target.value === 'true' })}
                className="h-7 rounded-md border border-input bg-white px-2 text-xs"
              >
                <option value="">Todas fuentes</option>
                <option value="true">IA</option>
                <option value="false">Manual</option>
              </select>
              {(filters.quarter_peak || filters.market || filters.status || filters.category || (filters.is_ai_generated !== null && filters.is_ai_generated !== undefined)) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-gray-500"
                  onClick={() => setFilters({})}
                >
                  Limpiar
                </Button>
              )}
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="py-8 text-center">
              <Sparkles className="h-10 w-10 text-violet-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-1">No hay sugerencias para {selectedYear}</p>
              <p className="text-xs text-gray-400 mb-4">
                Genera sugerencias con IA para descubrir las mejores fechas de campana
              </p>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Generar ahora
              </Button>
            </div>
          ) : (
            <>
              {/* Compact table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead className="h-9 px-3 text-xs font-semibold w-[110px]">Fecha</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold">Evento</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold w-[60px] text-center">Mercado</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold w-[70px] text-center">Impacto</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold w-[80px] text-center hidden md:table-cell">Categoria</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold w-[50px] text-center hidden md:table-cell">Q</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold w-[120px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestions.map((s) => {
                      const impact = IMPACT_BADGE[s.expected_impact];
                      const quarter = s.quarter_peak ? QUARTER_CONFIG[s.quarter_peak] : null;
                      const QuIcon = quarter?.icon;

                      return (
                        <TableRow
                          key={s.id}
                          className={cn(
                            'transition-colors',
                            s.status === 'dismissed' && 'opacity-50',
                            s.status === 'accepted' && 'bg-green-50/30',
                          )}
                        >
                          <TableCell className="py-2 px-3 text-xs text-gray-600">
                            {format(new Date(s.date + 'T12:00:00'), 'd MMM yyyy', { locale: es })}
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-gray-900 truncate">{s.name}</span>
                              {s.is_ai_generated ? (
                                <Bot className="h-3 w-3 text-violet-500 flex-shrink-0" />
                              ) : (
                                <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              )}
                              {s.status === 'accepted' && (
                                <Badge className="text-[9px] px-1 py-0 bg-green-100 text-green-700 border-green-200 flex-shrink-0">
                                  Agregado
                                </Badge>
                              )}
                              {s.status === 'dismissed' && (
                                <Badge className="text-[9px] px-1 py-0 bg-gray-100 text-gray-500 border-gray-200 flex-shrink-0">
                                  Descartado
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 px-3 text-center text-sm">
                            {MARKET_FLAG[s.market]}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-center">
                            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 border', impact.className)}>
                              {impact.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 px-3 text-center hidden md:table-cell">
                            <span className="text-xs text-gray-500">
                              {CATEGORY_LABEL[s.category] || s.category}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 px-3 text-center hidden md:table-cell">
                            {quarter && QuIcon && (
                              <span className={cn('inline-flex items-center gap-0.5 text-xs', quarter.iconColor)}>
                                <QuIcon className="h-3 w-3" />
                                {quarter.label}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            <div className="flex items-center gap-1 justify-end">
                              {/* Info button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
                                onClick={() => setDetailSuggestion(s)}
                                title="Ver detalle"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </Button>

                              {s.status === 'suggested' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleAccept(s)}
                                    disabled={isAccepting}
                                    title="Agregar al calendario"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                                    onClick={() => handleDismiss(s.id)}
                                    title="Descartar"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {s.status === 'dismissed' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-gray-500 hover:text-blue-600"
                                  onClick={() => handleRestore(s.id)}
                                  title="Restaurar"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Stats footer */}
              <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 mt-2">
                <span>
                  {suggestions.length} sugerencia{suggestions.length !== 1 && 's'} total
                </span>
                {suggestions.some(s => s.is_ai_generated) && (
                  <span className="flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    Generado con Gemini
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ManualSuggestionDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        onSave={handleAddManual}
        year={selectedYear}
      />

      <SuggestionDetailDialog
        suggestion={detailSuggestion}
        open={!!detailSuggestion}
        onOpenChange={(open) => { if (!open) setDetailSuggestion(null); }}
      />
    </>
  );
};

export default HolidaySuggestionPanel;
