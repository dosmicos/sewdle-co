import React, { useState, useMemo } from 'react';
import { useContentIdeas } from '@/hooks/useContentIdeas';
import type { ContentIdea, ContentIdeaInput, IdeaStatus, IdeaPriority } from '@/hooks/useContentIdeas';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Lightbulb,
  Check,
  X,
  ExternalLink,
  Trash2,
  TrendingUp,
  Eye,
  ArrowRight,
  Search,
  RotateCcw,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Config ─────────────────────────────────────────────

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram', emoji: '\u{1F4F8}' },
  { value: 'tiktok', label: 'TikTok', emoji: '\u{1F3B5}' },
  { value: 'facebook', label: 'Facebook', emoji: '\u{1F4D8}' },
  { value: 'whatsapp', label: 'WhatsApp', emoji: '\u{1F4AC}' },
  { value: 'email', label: 'Email', emoji: '\u{1F4E7}' },
  { value: 'blog', label: 'Blog', emoji: '\u{1F4DD}' },
];

const CONTENT_TYPE_OPTIONS = [
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

const PRIORITY_CONFIG: Record<IdeaPriority, { label: string; color: string }> = {
  high: { label: 'Alta', color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Media', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  low: { label: 'Baja', color: 'bg-green-100 text-green-700 border-green-200' },
};

const STATUS_CONFIG: Record<IdeaStatus, { label: string; color: string }> = {
  new: { label: 'Nueva', color: 'bg-slate-100 text-slate-600' },
  approved: { label: 'Aprobada', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-600' },
  converted: { label: 'En calendario', color: 'bg-blue-100 text-blue-700' },
};

const STATUS_FILTERS: { value: IdeaStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'new', label: 'Nuevas' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'converted', label: 'Convertidas' },
];

const EMPTY_FORM: ContentIdeaInput = {
  title: '',
  description: null,
  source: null,
  reference_url: null,
  content_type: null,
  platform: null,
  suggested_date: null,
  priority: 'medium',
  submitted_by: null,
};

// ─── Component ──────────────────────────────────────────

export default function ContentIdeasPanel() {
  const {
    ideas,
    isLoading,
    newCount,
    approvedCount,
    convertedCount,
    addIdea,
    isAdding,
    updateIdea,
    isUpdating,
    deleteIdea,
    convertToEvent,
    isConverting,
  } = useContentIdeas();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState<ContentIdeaInput>({ ...EMPTY_FORM });

  const updateForm = <K extends keyof ContentIdeaInput>(key: K, value: ContentIdeaInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const filteredIdeas = useMemo(() => {
    let filtered = ideas;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.source?.toLowerCase().includes(q) ||
          i.submitted_by?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [ideas, statusFilter, searchQuery]);

  const openEditDialog = (idea: ContentIdea) => {
    setEditingId(idea.id);
    setForm({
      title: idea.title,
      description: idea.description,
      source: idea.source,
      reference_url: idea.reference_url,
      content_type: idea.content_type,
      platform: idea.platform,
      suggested_date: idea.suggested_date,
      priority: idea.priority,
      submitted_by: idea.submitted_by,
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
        await updateIdea({ id: editingId, updates: form as Partial<ContentIdea> });
        toast.success('Idea actualizada');
      } else {
        await addIdea(form);
        toast.success('Idea creada');
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
    } catch {
      toast.error(editingId ? 'Error al actualizar' : 'Error al crear la idea');
    }
  };

  const handleStatusChange = async (id: string, status: IdeaStatus) => {
    try {
      await updateIdea({ id, updates: { status } });
      const statusLabels: Record<string, string> = {
        approved: 'Idea aprobada',
        rejected: 'Idea rechazada',
        new: 'Idea restaurada',
      };
      toast.success(statusLabels[status] || 'Estado actualizado');
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleConvert = async (idea: ContentIdea) => {
    try {
      await convertToEvent(idea);
      toast.success('Idea convertida y agregada al calendario');
    } catch {
      toast.error('Error al convertir la idea');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta idea?')) return;
    try {
      await deleteIdea(id);
      toast.success('Idea eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">
            Ideas del equipo
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-400">
              <span className="font-medium text-slate-600">{newCount}</span> nuevas
            </span>
            <span className="text-xs text-slate-300">|</span>
            <span className="text-xs text-slate-400">
              <span className="font-medium text-emerald-600">{approvedCount}</span> aprobadas
            </span>
            <span className="text-xs text-slate-300">|</span>
            <span className="text-xs text-slate-400">
              <span className="font-medium text-blue-600">{convertedCount}</span> convertidas
            </span>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setForm({ ...EMPTY_FORM });
            setDialogOpen(true);
          }}
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-[0.97] transition-all duration-150 cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva Idea
        </Button>
      </div>

      {/* ── Search + Filter ─────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar ideas..."
            className="h-9 pl-9 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer',
                statusFilter === f.value
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ideas Grid ──────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : filteredIdeas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
            <Lightbulb className="h-6 w-6 text-amber-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            {ideas.length === 0
              ? 'No hay ideas registradas'
              : 'Sin resultados para este filtro'}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
            {ideas.length === 0
              ? 'Empieza a buscar oportunidades de contenido y tendencias.'
              : 'Intenta con otro filtro o busqueda.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onApprove={() => handleStatusChange(idea.id, 'approved')}
              onReject={() => handleStatusChange(idea.id, 'rejected')}
              onRestore={() => handleStatusChange(idea.id, 'new')}
              onConvert={() => handleConvert(idea)}
              onEdit={() => openEditDialog(idea)}
              onDelete={() => handleDelete(idea.id)}
              isUpdating={isUpdating}
              isConverting={isConverting}
            />
          ))}
        </div>
      )}

      {/* ── New Idea Dialog ─────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[520px] max-h-[90vh] overflow-y-auto p-0 gap-0">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold tracking-tight text-slate-900">
                {editingId ? 'Editar Idea' : 'Nueva Idea'}
              </DialogTitle>
              {!editingId && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Registra una oportunidad o tendencia de contenido
                </p>
              )}
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* ── Section 1: Esencial ──────────────────── */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Esencial
              </p>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-slate-700">
                  Titulo <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={form.title}
                  onChange={(e) => updateForm('title', e.target.value)}
                  placeholder="Ej: Trend de audio viral para reel"
                  className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-slate-700">
                  Descripcion / Contexto
                </Label>
                <Textarea
                  value={form.description || ''}
                  onChange={(e) => updateForm('description', e.target.value || null)}
                  placeholder="Describe la oportunidad, por que es relevante, como ejecutarla..."
                  rows={3}
                  className="text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* ── Section 2: Origen ────────────────────── */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Origen
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-slate-700">Fuente</Label>
                  <Input
                    value={form.source || ''}
                    onChange={(e) => updateForm('source', e.target.value || null)}
                    placeholder="TikTok trending, Competencia..."
                    className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-slate-700">Link de referencia</Label>
                  <Input
                    value={form.reference_url || ''}
                    onChange={(e) => updateForm('reference_url', e.target.value || null)}
                    placeholder="https://..."
                    className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-slate-700">Propuesto por</Label>
                <Input
                  value={form.submitted_by || ''}
                  onChange={(e) => updateForm('submitted_by', e.target.value || null)}
                  placeholder="Nombre del miembro del equipo"
                  className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors"
                />
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* ── Section 3: Formato ───────────────────── */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Formato y plataforma
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-slate-700">Tipo de contenido</Label>
                  <select
                    value={form.content_type || ''}
                    onChange={(e) => updateForm('content_type', e.target.value || null)}
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
                  <Label className="text-[13px] font-medium text-slate-700">Prioridad</Label>
                  <select
                    value={form.priority || 'medium'}
                    onChange={(e) => updateForm('priority', e.target.value as IdeaPriority)}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-colors cursor-pointer"
                  >
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
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
            </div>

            <div className="border-t border-slate-100" />

            {/* ── Section 4: Fecha ─────────────────────── */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Fecha sugerida
              </p>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-slate-700">
                  Fecha (opcional)
                </Label>
                <Input
                  type="date"
                  value={form.suggested_date || ''}
                  onChange={(e) => updateForm('suggested_date', e.target.value || null)}
                  className="h-10 text-sm border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-400 transition-colors cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* ── Sticky Footer ─────────────────────────── */}
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center gap-3">
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
              disabled={(isAdding || isUpdating) || !form.title.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-[0.97] transition-all duration-150 cursor-pointer disabled:opacity-50"
            >
              {(isAdding || isUpdating) ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
              ) : (
                <Lightbulb className="h-4 w-4 mr-1.5" />
              )}
              {editingId ? 'Guardar' : 'Crear Idea'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Idea Card ──────────────────────────────────────────

interface IdeaCardProps {
  idea: ContentIdea;
  onApprove: () => void;
  onReject: () => void;
  onRestore: () => void;
  onConvert: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isUpdating: boolean;
  isConverting: boolean;
}

function IdeaCard({
  idea,
  onApprove,
  onReject,
  onRestore,
  onConvert,
  onEdit,
  onDelete,
  isUpdating,
  isConverting,
}: IdeaCardProps) {
  const priorityCfg = PRIORITY_CONFIG[idea.priority];
  const statusCfg = STATUS_CONFIG[idea.status];
  const contentTypeLabel = CONTENT_TYPE_OPTIONS.find((o) => o.value === idea.content_type)?.label;

  return (
    <Card className="group relative border-slate-200 hover:border-slate-300 transition-all duration-150 hover:shadow-sm">
      <CardContent className="p-4 space-y-3">
        {/* Top row: status + priority badges */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className={cn('text-[10px] font-medium border px-2 py-0.5', statusCfg.color)}
          >
            {statusCfg.label}
          </Badge>
          <Badge
            variant="outline"
            className={cn('text-[10px] font-medium border px-2 py-0.5', priorityCfg.color)}
          >
            {priorityCfg.label}
          </Badge>
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-slate-800 leading-snug">{idea.title}</p>

        {/* Description truncated */}
        {idea.description && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {idea.description}
          </p>
        )}

        {/* Source + link */}
        {(idea.source || idea.reference_url) && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {idea.source && (
              <span className="truncate max-w-[160px]">
                {idea.source}
              </span>
            )}
            {idea.reference_url && (
              <a
                href={idea.reference_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 transition-colors flex-shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Content type + platform pills */}
        <div className="flex flex-wrap gap-1.5">
          {contentTypeLabel && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-150 text-[10px] font-medium text-slate-600">
              {contentTypeLabel}
            </span>
          )}
          {idea.platform?.map((p) => {
            const plat = PLATFORM_OPTIONS.find((o) => o.value === p);
            return plat ? (
              <span
                key={p}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-150 text-[10px] text-slate-500"
              >
                <span className="text-xs leading-none">{plat.emoji}</span>
                {plat.label}
              </span>
            ) : null;
          })}
        </div>

        {/* Meta: submitted by + date */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-100">
          {idea.submitted_by && <span>{idea.submitted_by}</span>}
          {idea.submitted_by && <span className="text-slate-300">·</span>}
          <span>{format(new Date(idea.created_at), "d MMM yyyy", { locale: es })}</span>
          {idea.suggested_date && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-amber-600">
                Para {format(new Date(idea.suggested_date + 'T12:00:00'), "d MMM", { locale: es })}
              </span>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 pt-1">
          {(idea.status === 'new' || idea.status === 'approved') && (
            <>
              {idea.status === 'new' && (
                <button
                  onClick={onApprove}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-[0.97] transition-all duration-150 cursor-pointer disabled:opacity-50"
                  title="Aprobar"
                >
                  <Check className="h-3.5 w-3.5" />
                  Aprobar
                </button>
              )}
              {idea.status === 'new' && (
                <button
                  onClick={onReject}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 active:scale-[0.97] transition-all duration-150 cursor-pointer disabled:opacity-50"
                  title="Rechazar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={onConvert}
                disabled={isConverting}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 active:scale-[0.97] transition-all duration-150 cursor-pointer disabled:opacity-50"
                title="Pasar al calendario"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Calendario
              </button>
            </>
          )}
          {idea.status === 'rejected' && (
            <button
              onClick={onRestore}
              disabled={isUpdating}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-[0.97] transition-all duration-150 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar
            </button>
          )}
          {idea.status === 'converted' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-100">
              <Check className="h-3.5 w-3.5" />
              En calendario
            </span>
          )}
          {/* Edit — available before conversion */}
          {idea.status !== 'converted' && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-[0.97] transition-all duration-150 cursor-pointer"
              title="Editar"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
