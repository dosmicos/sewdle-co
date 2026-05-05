import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, ExternalLink, Lightbulb, Loader2, Plus, Trash2, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import type { UgcCampaign } from '@/types/ugc';
import { useUgcToolkitAssignments, type UgcToolkitAssignment } from '@/hooks/useUgcToolkitAssignments';

interface UgcToolkitAssignmentsManagerProps {
  creatorId: string;
  campaigns: UgcCampaign[];
}

const emptyForm = {
  id: undefined as string | undefined,
  campaign_id: '',
  label: 'Idea de contenido',
  toolkit_url: '',
  sort_order: 0,
  is_active: true,
};

export const UgcToolkitAssignmentsManager: React.FC<UgcToolkitAssignmentsManagerProps> = ({ creatorId, campaigns }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { assignments, isLoading, upsertAssignment, setActive, deleteAssignment } = useUgcToolkitAssignments(creatorId);

  const campaignNameById = useMemo(() => {
    return new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));
  }, [campaigns]);

  const resetForm = () => setForm(emptyForm);

  const openCreate = (campaignId?: string) => {
    setForm({ ...emptyForm, campaign_id: campaignId || '' });
    setOpen(true);
  };

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
    await navigator.clipboard.writeText(url);
    toast.success('Link de toolkit copiado');
  };

  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" /> Ideas de contenido / Toolkits
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Asigna toolkits por campaña o agrega ideas extra sin crear una campaña nueva.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => openCreate()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center text-xs text-muted-foreground">
            Sin toolkits asignados. En Club la creadora no verá botón de “Idea de contenido” hasta que agregues uno.
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{assignment.label || 'Idea de contenido'}</p>
                      <Badge variant="outline" className={assignment.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500'}>
                        {assignment.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
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
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyUrl(assignment.toolkit_url)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(assignment.toolkit_url, '_blank', 'noopener,noreferrer')}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setActive.mutate({ id: assignment.id, is_active: !assignment.is_active })}
                    >
                      {assignment.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => {
                        if (window.confirm('¿Eliminar este toolkit?')) deleteAssignment.mutate(assignment.id);
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

        {campaigns.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {campaigns.slice(0, 4).map((campaign) => (
              <Button key={campaign.id} variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openCreate(campaign.id)}>
                <Plus className="h-3 w-3 mr-1" /> Toolkit para {campaign.name}
              </Button>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar toolkit' : 'Agregar toolkit'}</DialogTitle>
            <DialogDescription>
              La creadora solo verá un botón “Idea de contenido” que abre este link.
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
                {campaigns.map((campaign) => (
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
              <Label>Link del toolkit</Label>
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
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={upsertAssignment.isPending || !form.toolkit_url.trim()}>
              {upsertAssignment.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
