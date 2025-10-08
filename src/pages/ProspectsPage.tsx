import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { Button } from '@/components/ui/button';
import { Plus, Grid, Table as TableIcon } from 'lucide-react';
import { useProspects } from '@/hooks/useProspects';
import { ProspectCard } from '@/components/prospects/ProspectCard';
import { ProspectForm } from '@/components/prospects/ProspectForm';
import { ProspectDetailsModal } from '@/components/prospects/ProspectDetailsModal';
import { WorkshopProspect, STAGE_LABELS, ProspectStage } from '@/types/prospects';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useIsDosmicos } from '@/hooks/useIsDosmicos';
import { ProspectsTableView } from '@/components/prospects/table/ProspectsTableView';

export default function ProspectsPage() {
  const { currentOrganization } = useOrganization();
  const { prospects, loading, createProspect, updateProspect, deleteProspect } = useProspects();
  const { isDosmicos } = useIsDosmicos();
  const [showForm, setShowForm] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<WorkshopProspect | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>(isDosmicos ? 'table' : 'kanban');

  const handleCreateProspect = async (data: Partial<WorkshopProspect>) => {
    if (!currentOrganization?.id) return;
    await createProspect({
      ...data,
      name: data.name!,
      organization_id: currentOrganization.id,
    });
    setShowForm(false);
  };

  const handleUpdateStage = async (id: string, stage: ProspectStage) => {
    await updateProspect(id, { stage });
  };

  const prospectsByStage = prospects.reduce((acc, prospect) => {
    if (!acc[prospect.stage]) {
      acc[prospect.stage] = [];
    }
    acc[prospect.stage].push(prospect);
    return acc;
  }, {} as Record<ProspectStage, WorkshopProspect[]>);

  // Stages for pipeline view
  const pipelineStages: ProspectStage[] = [
    'lead',
    'videocall_scheduled',
    'visit_scheduled',
    'sample_in_progress',
    'trial_production',
  ];

  return (
    <>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Reclutamiento de Talleres</h1>
            <p className="text-muted-foreground">Gestiona el pipeline de prospectos de nuevos talleres aliados</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMode('kanban')}
              className={viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : ''}
            >
              <Grid className="h-4 w-4" />
            </Button>
            {isDosmicos && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setViewMode('table')}
                className={viewMode === 'table' ? 'bg-primary text-primary-foreground' : ''}
                title="Vista Notion"
              >
                <TableIcon className="h-4 w-4" />
              </Button>
            )}
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Prospecto
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Prospectos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{prospects.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                En Proceso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {prospects.filter(p => !['approved_workshop', 'rejected'].includes(p.stage)).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Talleres Aprobados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {prospects.filter(p => p.stage === 'approved_workshop').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rechazados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">
                {prospects.filter(p => p.stage === 'rejected').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">Cargando prospectos...</div>
        ) : viewMode === 'table' ? (
          /* Table View - Notion Style */
          <ProspectsTableView
            prospects={prospects}
            onUpdate={updateProspect}
            onDelete={deleteProspect}
          />
        ) : (
          /* Kanban View */
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto">
            {pipelineStages.map((stage) => (
              <div key={stage} className="space-y-4">
                <div className="sticky top-0 bg-background pb-2">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                    {STAGE_LABELS[stage]}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {prospectsByStage[stage]?.length || 0} prospectos
                  </p>
                </div>
                <div className="space-y-3">
                  {prospectsByStage[stage]?.map((prospect) => (
                    <ProspectCard
                      key={prospect.id}
                      prospect={prospect}
                      onClick={() => setSelectedProspect(prospect)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Prospect Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo Prospecto de Taller</DialogTitle>
          </DialogHeader>
          <ProspectForm
            onSubmit={handleCreateProspect}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Prospect Details Modal */}
      <ProspectDetailsModal
        prospect={selectedProspect}
        open={!!selectedProspect}
        onClose={() => setSelectedProspect(null)}
        onUpdateStage={handleUpdateStage}
      />
    </>
  );
}
