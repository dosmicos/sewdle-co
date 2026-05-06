import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, ExternalLink, Lightbulb, Loader2, Plus, Trash2, Power, PowerOff, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { UgcCampaign } from '@/types/ugc';
import { useUgcToolkitAssignments, type UgcToolkitAssignment } from '@/hooks/useUgcToolkitAssignments';

interface UgcToolkitAssignmentsManagerProps {
  creatorId: string;
  campaigns: UgcCampaign[];
  compact?: boolean;
  title?: string;
  showCampaignQuickActions?: boolean;
  draftCampaignId?: string | null;
  onDraftCampaignHandled?: () => void;
}

const buildEmptyForm = (campaignId = '') => ({
  id: undefined as string | undefined,
  campaign_id: campaignId,
  label: 'Idea de contenido',
  toolkit_url: '',
  sort_order: 0,
  is_active: true,
});

const copyToClipboard = async (text: string) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
};

export const UgcToolkitAssignmentsManager: React.FC<UgcToolkitAssignmentsManagerProps> = ({
  creatorId,
  campaigns,
  compact = false,
  title = 'Ideas de contenido',
  showCampaignQuickActions = true,
  draftCampaignId,
  onDraftCampaignHandled,
}) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(buildEmptyForm());
  const { assignments, isLoading, upsertAssignment, setActive, deleteAssignment } = useUgcToolkitAssignments(creatorId);

  const campaignNameById = useMemo(() => {
    return new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));
  }, [campaigns]);

  const activeCount = assignments.filter((assignment) => assignment.is_active).length;

  const resetForm = () => setForm(buildEmptyForm());

  const openCreate = (campaignId?: string | null) => {
    setForm(buildEmptyForm(campaignId || ''));
    setOpen(true);
  };

  useEffect(() => {
    if (!draftCampaignId) return;
    openCreate(draftCampaignId);
    onDraftCampaignHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftCampaignId]);

  const openEdit = (assignment: UgcToolkitAssignment) => {
    setForm({
      id: assignment.id,
      campaign_id: assignment.campaign_id || '',
      label: assignment.label || 'Idea de contenido',
      toolkit_url: assignment.toolkit_url,
      sort_order: assignment.sort_order || 0,
      is_active: assignment.is_active,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    upsertAssignment.mutate(
      {
        id: form.id,
        campaign_id: form.campaign_id || null,
        label: form.label,
        toolkit_url: form.toolkit_url,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      }
    );
  };

  const copyUrl = async (url: string) => {
    const copied = await copyToClipboard(url);
    if (copied) toast.success('Link de idea copiado');
    else toast.error('No se pudo copiar el link');
  };

  const orderedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [campaigns]
  );

  return (
    <Card className="border border-amber-100 bg-amber-50/35">
      <CardContent className={compact ? 'p-3 space-y-2.5' : 'p-4 space-y-3'}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" /> {title}
              <Badge variant="outline" className="bg-white text-amber-700 border-amber-200 text-[10px]">
                {activeCount} activa{activeCount === 1 ? '' : 's'}
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Se sincronizan con Club Dosmicos porque usan la misma tabla de ideas.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 bg-white" onClick={() => openCreate()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar idea
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-amber-200 bg-white/70 p-3 text-center text-xs text-muted-foreground">
            Sin ideas asignadas. En Club la creadora no verá botón de “Idea de contenido” hasta que agregues una.
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="rounded-lg border border-amber-100 bg-white p-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium truncate">{assignment.label || 'Idea de contenido'}</p>
                      <Badge variant="outline" className={assignment.is_active ? 'bg-green-50 text-green-700 border-green-200 text-[10px]' : 'bg-gray-100 text-gray-500 text-[10px]'}>
                        {assignment.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-100 text-amber-700">
                        {assignment.campaign_id ? campaignNameById.get(assignment.campaign_id) || 'Campaña' : 'Extra'}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(assignment)}
                      className="text-xs text-muted-foreground hover:text-foreground truncate max-w-full block mt-1 underline underline-offset-2"
                    >
                      {assignment.toolkit_url}
                    </button>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(assignment)} title="Editar idea">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyUrl(assignment.toolkit_url)} title="Copiar link">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(assignment.toolkit_url, '_blank', 'noopener,noreferrer')} title="Abrir link">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title={assignment.is_active ? 'Desactivar idea' : 'Activar idea'}
                      onClick={() => setActive.mutate({ id: assignment.id, is_active: !assignment.is_active })}
                    >
                      {assignment.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      title="Eliminar idea"
                      onClick={() => {
                        if (window.confirm('¿Eliminar esta idea? También dejará de verse en Club.')) deleteAssignment.mutate(assignment.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCampaignQuickActions && orderedCampaigns.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {orderedCampaigns.slice(0, 5).map((campaign) => (
              <Button key={campaign.id} type="button" variant="ghost" size="sm" className="h-7 text-xs bg-white/70" onClick={() => openCreate(campaign.id)}>
                <Plus className="h-3 w-3 mr-1" /> Idea para {campaign.name}
              </Button>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar idea' : 'Agregar idea'}</DialogTitle>
            <DialogDescription>
              Esta idea se guarda en la fuente compartida y se verá también en Club Dosmicos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Campaña</Label>
              <select
                value={form.campaign_id}
                onChange={(event) => setForm((prev) => ({ ...prev, campaign_id: event.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Extra / sin campaña</option>
                {orderedCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Texto del botón</Label>
              <Input
                value={form.label}
                onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                placeholder="Idea de contenido"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Link del toolkit / idea</Label>
              <Input
                value={form.toolkit_url}
                onChange={(event) => setForm((prev) => ({ ...prev, toolkit_url: event.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Orden</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(event) => setForm((prev) => ({ ...prev, sort_order: Number(event.target.value) }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleSubmit} disabled={upsertAssignment.isPending || !form.toolkit_url.trim()}>
              {upsertAssignment.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar idea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
