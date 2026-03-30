import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronDown,
  ChevronUp,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useHolidaySuggestions,
  type HolidaySuggestion,
  type SuggestionFilters,
} from '@/hooks/useHolidaySuggestions';

// ─── Quarter Config ─────────────────────────────────────
const QUARTER_CONFIG = {
  q1: { label: 'Q1 Hot Days', color: 'border-l-orange-500', bg: 'bg-orange-50', icon: Flame, iconColor: 'text-orange-500' },
  q2: { label: 'Q2 Dia de la Madre', color: 'border-l-pink-500', bg: 'bg-pink-50', icon: Target, iconColor: 'text-pink-500' },
  q3: { label: 'Q3 Temporada Frio', color: 'border-l-blue-500', bg: 'bg-blue-50', icon: Mountain, iconColor: 'text-blue-500' },
  q4: { label: 'Q4 BF + Navidad', color: 'border-l-yellow-500', bg: 'bg-yellow-50', icon: Zap, iconColor: 'text-yellow-500' },
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

// ─── Suggestion Card ────────────────────────────────────
const SuggestionCard: React.FC<{
  suggestion: HolidaySuggestion;
  onAccept: (s: HolidaySuggestion) => void;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
  isAccepting: boolean;
}> = ({ suggestion, onAccept, onDismiss, onRestore, isAccepting }) => {
  const [expanded, setExpanded] = useState(false);
  const quarter = suggestion.quarter_peak ? QUARTER_CONFIG[suggestion.quarter_peak] : null;
  const impact = IMPACT_BADGE[suggestion.expected_impact];
  const QuarterIcon = quarter?.icon || Calendar;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
    >
      <div
        className={cn(
          'rounded-lg border border-l-4 transition-shadow hover:shadow-sm',
          quarter?.color || 'border-l-gray-300',
          suggestion.status === 'dismissed' && 'opacity-50',
          suggestion.status === 'accepted' && 'bg-green-50/30 border-green-200',
        )}
      >
        <div className="p-3">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg leading-none">{MARKET_FLAG[suggestion.market]}</span>
                <span className="font-semibold text-sm text-gray-900 truncate">
                  {suggestion.name}
                </span>
                {suggestion.is_ai_generated ? (
                  <Badge variant="outline" className="text-[9px] px-1 gap-0.5 border-violet-200 text-violet-600">
                    <Bot className="h-2.5 w-2.5" /> IA
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] px-1 gap-0.5 border-gray-200 text-gray-500">
                    <User className="h-2.5 w-2.5" /> Manual
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{format(new Date(suggestion.date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</span>
                <Badge variant="secondary" className={cn('text-[10px] px-1.5 border', impact.className)}>
                  {impact.label}
                </Badge>
                {quarter && (
                  <span className={cn('flex items-center gap-0.5 text-[10px]', quarter.iconColor)}>
                    <QuarterIcon className="h-3 w-3" />
                    {suggestion.quarter_peak?.toUpperCase()}
                  </span>
                )}
                {suggestion.status === 'accepted' && (
                  <Badge className="text-[9px] px-1.5 bg-green-100 text-green-700 border-green-200">
                    Agregado
                  </Badge>
                )}
                {suggestion.status === 'dismissed' && (
                  <Badge className="text-[9px] px-1.5 bg-gray-100 text-gray-500 border-gray-200">
                    Descartado
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {suggestion.status === 'suggested' && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => onAccept(suggestion)}
                    disabled={isAccepting}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Agregar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                    onClick={() => onDismiss(suggestion.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              {suggestion.status === 'dismissed' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-gray-500 hover:text-blue-600"
                  onClick={() => onRestore(suggestion.id)}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  <span className="text-xs">Restaurar</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-gray-400"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Expandable content */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t space-y-2">
                  {suggestion.why_now && (
                    <div className="bg-indigo-50 rounded-md p-2.5">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                        <Target className="h-3 w-3" />
                        Por que ahora
                      </div>
                      <p className="text-xs text-indigo-800 leading-relaxed">{suggestion.why_now}</p>
                    </div>
                  )}
                  {suggestion.campaign_idea && (
                    <div className="bg-amber-50 rounded-md p-2.5">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">
                        <Lightbulb className="h-3 w-3" />
                        Idea de campana
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">{suggestion.campaign_idea}</p>
                    </div>
                  )}
                  <div className="flex gap-2 text-[10px] text-gray-400">
                    <span>Categoria: {suggestion.category}</span>
                    <span>|</span>
                    <span>Tipo sugerido: {suggestion.suggested_event_type}</span>
                    {suggestion.source_model && (
                      <>
                        <span>|</span>
                        <span>Modelo: {suggestion.source_model}</span>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
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
            <Textarea value={form.campaign_idea} onChange={e => setForm({ ...form, campaign_idea: e.target.value })} placeholder="Idea breve de campaña..." className="text-sm min-h-[50px]" />
          </div>
          <Button onClick={handleSave} className="w-full">Agregar Fecha</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Panel ─────────────────────────────────────────
const HolidaySuggestionPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
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

  // Group by quarter
  const byQuarter = useMemo(() => {
    const grouped: Record<string, HolidaySuggestion[]> = { q1: [], q2: [], q3: [], q4: [] };
    for (const s of suggestions) {
      const key = s.quarter_peak || 'q1';
      if (grouped[key]) grouped[key].push(s);
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
      <Card className="overflow-hidden">
        {/* Header - always visible */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-violet-600" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-gray-900">
                Fechas Sugeridas por IA
              </h3>
              <p className="text-xs text-gray-500">
                Campanas recomendadas para {selectedYear}
              </p>
            </div>
            {suggestedCount > 0 && (
              <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">
                {suggestedCount} pendientes
              </Badge>
            )}
            {acceptedCount > 0 && (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                {acceptedCount} aceptadas
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>

        {/* Collapsible content */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0 pb-4 px-4">
                {/* Controls */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      {isGenerating ? (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {isGenerating ? 'Generando...' : 'Generar sugerencias con IA'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setManualDialogOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Fecha manual
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowFilters(!showFilters)}
                      className={showFilters ? 'bg-gray-100' : ''}
                    >
                      <Filter className="h-3.5 w-3.5 mr-1" />
                      Filtros
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value={currentYear}>{currentYear}</option>
                      <option value={currentYear + 1}>{currentYear + 1}</option>
                    </select>
                  </div>
                </div>

                {/* Filters row */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                        <select
                          value={filters.quarter_peak || ''}
                          onChange={e => setFilters({ ...filters, quarter_peak: e.target.value || null })}
                          className="h-7 rounded-md border border-input bg-white px-2 text-xs"
                        >
                          <option value="">Todos los quarters</option>
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
                          <option value="">Todos los mercados</option>
                          <option value="co">Colombia</option>
                          <option value="us">USA</option>
                          <option value="both">Ambos</option>
                        </select>
                        <select
                          value={filters.status || ''}
                          onChange={e => setFilters({ ...filters, status: (e.target.value || null) as any })}
                          className="h-7 rounded-md border border-input bg-white px-2 text-xs"
                        >
                          <option value="">Todos los estados</option>
                          <option value="suggested">Pendientes</option>
                          <option value="accepted">Aceptadas</option>
                          <option value="dismissed">Descartadas</option>
                        </select>
                        <select
                          value={filters.is_ai_generated === null || filters.is_ai_generated === undefined ? '' : String(filters.is_ai_generated)}
                          onChange={e => setFilters({ ...filters, is_ai_generated: e.target.value === '' ? null : e.target.value === 'true' })}
                          className="h-7 rounded-md border border-input bg-white px-2 text-xs"
                        >
                          <option value="">Todas las fuentes</option>
                          <option value="true">IA</option>
                          <option value="false">Manual</option>
                        </select>
                        {(filters.quarter_peak || filters.market || filters.status || filters.is_ai_generated !== null && filters.is_ai_generated !== undefined) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-gray-500"
                            onClick={() => setFilters({})}
                          >
                            Limpiar filtros
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Content */}
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="py-8 text-center">
                    <Sparkles className="h-10 w-10 text-violet-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-1">
                      No hay sugerencias para {selectedYear}
                    </p>
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
                  <div className="space-y-5">
                    {/* Quarter timeline */}
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.entries(QUARTER_CONFIG) as [string, typeof QUARTER_CONFIG['q1']][]).map(([key, config]) => {
                        const count = byQuarter[key]?.length || 0;
                        const suggestedInQ = byQuarter[key]?.filter(s => s.status === 'suggested').length || 0;
                        const QuIcon = config.icon;
                        return (
                          <button
                            key={key}
                            onClick={() => setFilters(prev => ({ ...prev, quarter_peak: prev.quarter_peak === key ? null : key }))}
                            className={cn(
                              'rounded-lg border p-2 text-center transition-all',
                              filters.quarter_peak === key ? `${config.bg} border-current shadow-sm` : 'hover:bg-gray-50',
                            )}
                          >
                            <QuIcon className={cn('h-4 w-4 mx-auto mb-1', config.iconColor)} />
                            <div className="text-[10px] font-medium text-gray-700">{key.toUpperCase()}</div>
                            <div className="text-[10px] text-gray-400">
                              {count} fecha{count !== 1 && 's'}
                              {suggestedInQ > 0 && (
                                <span className="text-violet-500 ml-0.5">({suggestedInQ} nuevas)</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Suggestions list */}
                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {suggestions.map((suggestion) => (
                          <SuggestionCard
                            key={suggestion.id}
                            suggestion={suggestion}
                            onAccept={handleAccept}
                            onDismiss={handleDismiss}
                            onRestore={handleRestore}
                            isAccepting={isAccepting}
                          />
                        ))}
                      </AnimatePresence>
                    </div>

                    {/* Stats footer */}
                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t">
                      <span>
                        {suggestions.length} sugerencia{suggestions.length !== 1 && 's'} total
                        {suggestedCount > 0 && ` · ${suggestedCount} pendientes`}
                        {acceptedCount > 0 && ` · ${acceptedCount} aceptadas`}
                        {dismissedCount > 0 && ` · ${dismissedCount} descartadas`}
                      </span>
                      {suggestions.some(s => s.is_ai_generated) && (
                        <span className="flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          Generado con Gemini
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <ManualSuggestionDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        onSave={handleAddManual}
        year={selectedYear}
      />
    </>
  );
};

export default HolidaySuggestionPanel;
