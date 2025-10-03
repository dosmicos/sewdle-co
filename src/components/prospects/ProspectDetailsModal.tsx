import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkshopProspect, STAGE_LABELS, ProspectStage } from '@/types/prospects';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProspectActivities } from '@/hooks/useProspectActivities';
import { ActivityForm } from './ActivityForm';
import { ActivityTimeline } from './ActivityTimeline';
import { Building2, Phone, Mail, MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProspectDetailsModalProps {
  prospect: WorkshopProspect | null;
  open: boolean;
  onClose: () => void;
  onUpdateStage: (id: string, stage: ProspectStage) => Promise<void>;
}

export const ProspectDetailsModal = ({ prospect, open, onClose, onUpdateStage }: ProspectDetailsModalProps) => {
  const { activities, createActivity, refetch } = useProspectActivities(prospect?.id);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);

  if (!prospect) return null;

  const handleStageChange = async (newStage: string) => {
    setUpdatingStage(true);
    try {
      await onUpdateStage(prospect.id, newStage as ProspectStage);
      await createActivity({
        prospect_id: prospect.id,
        organization_id: prospect.organization_id,
        activity_type: 'stage_change',
        title: `Cambio de etapa a: ${STAGE_LABELS[newStage as ProspectStage]}`,
        status: 'completed',
        completed_date: new Date().toISOString(),
      });
      refetch();
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleActivitySubmit = async (data: any) => {
    if (!prospect?.organization_id) return;
    await createActivity({
      prospect_id: prospect.id,
      organization_id: prospect.organization_id,
      ...data,
    });
    setShowActivityForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <DialogTitle className="text-2xl">{prospect.name}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Section */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              {prospect.contact_person && (
                <p><strong>Contacto:</strong> {prospect.contact_person}</p>
              )}
              {prospect.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{prospect.phone}</span>
                </div>
              )}
              {prospect.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{prospect.email}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {prospect.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{prospect.city}</span>
                </div>
              )}
              {prospect.source && (
                <p><strong>Origen:</strong> {prospect.source}</p>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">
                  Creado: {format(new Date(prospect.created_at), 'dd MMM yyyy', { locale: es })}
                </span>
              </div>
            </div>
          </div>

          {/* Stage Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Etapa Actual</label>
            <Select value={prospect.stage} onValueChange={handleStageChange} disabled={updatingStage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STAGE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="activities" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="activities">Actividades</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
            </TabsList>

            <TabsContent value="activities" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowActivityForm(!showActivityForm)}>
                  {showActivityForm ? 'Cancelar' : 'Nueva Actividad'}
                </Button>
              </div>

              {showActivityForm && (
                <ActivityForm onSubmit={handleActivitySubmit} onCancel={() => setShowActivityForm(false)} />
              )}

              <ActivityTimeline activities={activities} />
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg min-h-[200px]">
                {prospect.notes || 'No hay notas'}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
