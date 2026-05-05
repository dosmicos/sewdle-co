import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Plus, Trash2 } from 'lucide-react';
import {
  ContentPiece,
  ContentPieceInput,
  ContentType,
  Platform,
  ContentStatus,
  TeamMember,
  PLATFORM_CONFIG,
  CONTENT_TYPE_CONFIG,
  STATUS_CONFIG,
  CHAR_LIMITS,
} from '@/hooks/useContentPlanner';
import { format } from 'date-fns';

interface ContentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece?: ContentPiece | null;
  defaultDate?: string;
  defaultWeek: number;
  defaultYear: number;
  teamMembers: TeamMember[];
  onSave: (input: ContentPieceInput) => Promise<void>;
  onUpdate?: (data: { id: string; updates: Partial<ContentPieceInput> }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isSaving: boolean;
}

const EMPTY_FORM: ContentPieceInput = {
  title: '',
  description: '',
  content_type: 'reel',
  platform: 'instagram',
  status: 'idea',
  assigned_to: null,
  scheduled_date: null,
  scheduled_time: null,
  copy_text: '',
  hashtags: [],
  assets_needed: '',
  assets_url: '',
  approval_notes: '',
  week_number: 0,
  year: 0,
};

export const ContentForm: React.FC<ContentFormProps> = ({
  open,
  onOpenChange,
  piece,
  defaultDate,
  defaultWeek,
  defaultYear,
  teamMembers,
  onSave,
  onUpdate,
  onDelete,
  isSaving,
}) => {
  const [form, setForm] = useState<ContentPieceInput>(EMPTY_FORM);
  const [hashtagInput, setHashtagInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (piece) {
      setForm({
        title: piece.title,
        description: piece.description || '',
        content_type: piece.content_type,
        platform: piece.platform,
        status: piece.status,
        assigned_to: piece.assigned_to,
        scheduled_date: piece.scheduled_date,
        scheduled_time: piece.scheduled_time,
        copy_text: piece.copy_text || '',
        hashtags: piece.hashtags || [],
        assets_needed: piece.assets_needed || '',
        assets_url: piece.assets_url || '',
        approval_notes: piece.approval_notes || '',
        week_number: piece.week_number,
        year: piece.year,
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        scheduled_date: defaultDate || null,
        week_number: defaultWeek,
        year: defaultYear,
      });
    }
  }, [piece, defaultDate, defaultWeek, defaultYear, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    if (piece && onUpdate) {
      await onUpdate({ id: piece.id, updates: form });
    } else {
      await onSave(form);
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!piece || !onDelete) return;
    setIsDeleting(true);
    await onDelete(piece.id);
    setIsDeleting(false);
    onOpenChange(false);
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !form.hashtags.includes(tag)) {
      setForm((f) => ({ ...f, hashtags: [...f.hashtags, tag] }));
      setHashtagInput('');
    }
  };

  const removeHashtag = (tag: string) => {
    setForm((f) => ({ ...f, hashtags: f.hashtags.filter((h) => h !== tag) }));
  };

  const charLimit = CHAR_LIMITS[form.platform];
  const copyLength = (form.copy_text || '').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {piece ? 'Editar Contenido' : 'Nuevo Contenido'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ej: Reel de lanzamiento colección verano"
              required
            />
          </div>

          {/* Platform + Content Type row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Plataforma</Label>
              <Select
                value={form.platform}
                onValueChange={(v: Platform) => setForm((f) => ({ ...f, platform: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PLATFORM_CONFIG) as [Platform, typeof PLATFORM_CONFIG[Platform]][]).map(
                    ([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: cfg.color }}
                          />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de Contenido</Label>
              <Select
                value={form.content_type}
                onValueChange={(v: ContentType) => setForm((f) => ({ ...f, content_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CONTENT_TYPE_CONFIG) as [ContentType, typeof CONTENT_TYPE_CONFIG[ContentType]][]).map(
                    ([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.icon} {cfg.label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status + Assigned To row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(v: ContentStatus) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(STATUS_CONFIG) as [ContentStatus, typeof STATUS_CONFIG[ContentStatus]][]).map(
                    ([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: cfg.dotColor }}
                          />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <Select
                value={form.assigned_to || 'unassigned'}
                onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v === 'unassigned' ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="scheduled_date">Fecha</Label>
              <Input
                id="scheduled_date"
                type="date"
                value={form.scheduled_date || ''}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value || null }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scheduled_time">Hora</Label>
              <Input
                id="scheduled_time"
                type="time"
                value={form.scheduled_time || ''}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_time: e.target.value || null }))}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción / Brief</Label>
            <Textarea
              id="description"
              value={form.description || ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descripción del contenido, instrucciones para el equipo..."
              rows={2}
            />
          </div>

          {/* Copy text with char counter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="copy_text">Copy / Caption</Label>
              {charLimit && (
                <span
                  className={`text-xs ${
                    copyLength > charLimit ? 'text-red-500 font-medium' : 'text-gray-400'
                  }`}
                >
                  {copyLength.toLocaleString()} / {charLimit.toLocaleString()}
                </span>
              )}
            </div>
            <Textarea
              id="copy_text"
              value={form.copy_text || ''}
              onChange={(e) => setForm((f) => ({ ...f, copy_text: e.target.value }))}
              placeholder="Texto del post, caption, copy del email..."
              rows={4}
              className={charLimit && copyLength > charLimit ? 'border-red-300 focus:ring-red-400' : ''}
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-1.5">
            <Label>Hashtags</Label>
            <div className="flex gap-2">
              <Input
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                placeholder="Agregar hashtag..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addHashtag();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addHashtag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {form.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.hashtags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-red-100"
                    onClick={() => removeHashtag(tag)}
                  >
                    #{tag} <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Assets */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="assets_needed">Assets Necesarios</Label>
              <Input
                id="assets_needed"
                value={form.assets_needed || ''}
                onChange={(e) => setForm((f) => ({ ...f, assets_needed: e.target.value }))}
                placeholder="Fotos, video, diseño..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assets_url">Link de Assets</Label>
              <Input
                id="assets_url"
                value={form.assets_url || ''}
                onChange={(e) => setForm((f) => ({ ...f, assets_url: e.target.value }))}
                placeholder="Link a Drive, Figma..."
              />
            </div>
          </div>

          {/* Approval notes */}
          <div className="space-y-1.5">
            <Label htmlFor="approval_notes">Notas de Aprobación</Label>
            <Textarea
              id="approval_notes"
              value={form.approval_notes || ''}
              onChange={(e) => setForm((f) => ({ ...f, approval_notes: e.target.value }))}
              placeholder="Feedback, cambios requeridos..."
              rows={2}
            />
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            {piece && onDelete && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span className="ml-1.5">Eliminar</span>
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || !form.title.trim()}>
                {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {piece ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
