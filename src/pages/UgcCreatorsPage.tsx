import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUgcCreators } from '@/hooks/useUgcCreators';
import { useUgcCampaigns } from '@/hooks/useUgcCampaigns';
import { useUgcVideos } from '@/hooks/useUgcVideos';
import { useAllUgcCreatorTagAssignments } from '@/hooks/useUgcCreatorTags';
import { UgcStatsCards } from '@/components/ugc/UgcStatsCards';
import { UgcKanbanBoard } from '@/components/ugc/UgcKanbanBoard';
import { UgcProspectKanban } from '@/components/ugc/UgcProspectKanban';
import { UgcTableView } from '@/components/ugc/UgcTableView';
import { UgcCreatorForm } from '@/components/ugc/UgcCreatorForm';
import { UgcCampaignForm } from '@/components/ugc/UgcCampaignForm';
import { UgcVideoForm } from '@/components/ugc/UgcVideoForm';
import { UgcCreatorDetailModal } from '@/components/ugc/UgcCreatorDetailModal';
import type { UgcCreator, UgcCampaign, CampaignStatus, CreatorStatus } from '@/types/ugc';

const UgcCreatorsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [kanbanTab, setKanbanTab] = useState<'prospectos' | 'campanas'>('prospectos');
  const [creatorFormOpen, setCreatorFormOpen] = useState(false);
  const [editingCreator, setEditingCreator] = useState<UgcCreator | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<UgcCreator | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);
  const [campaignCreatorId, setCampaignCreatorId] = useState<string | null>(null);
  const [videoFormOpen, setVideoFormOpen] = useState(false);
  const [videoCampaignId, setVideoCampaignId] = useState<string | null>(null);

  const { creators, isLoading: creatorsLoading, createCreator, updateCreator, updateCreatorStatus, deleteCreator } = useUgcCreators();
  const { campaigns, isLoading: campaignsLoading, createCampaign, updateCampaignStatus } = useUgcCampaigns();
  const { createVideo, updateVideoStatus } = useUgcVideos();
  const { getTagsForCreator } = useAllUgcCreatorTagAssignments();

  const handleCreatorSubmit = (data: any) => {
    if (editingCreator) {
      updateCreator.mutate({ ...data, id: editingCreator.id }, {
        onSuccess: () => { setCreatorFormOpen(false); setEditingCreator(null); },
      });
    } else {
      createCreator.mutate(data, {
        onSuccess: () => setCreatorFormOpen(false),
      });
    }
  };

  const handleCampaignClick = (campaign: UgcCampaign) => {
    const creator = creators.find((c) => c.id === campaign.creator_id);
    if (creator) { setSelectedCreator(creator); setDetailOpen(true); }
  };

  const handleCreatorClick = (creator: UgcCreator) => {
    setSelectedCreator(creator); setDetailOpen(true);
  };

  const handleCampaignStatusChange = (campaignId: string, status: CampaignStatus, extra?: Record<string, any>) => {
    updateCampaignStatus.mutate({ id: campaignId, status, extra });
  };

  const handleCreatorStatusChange = (creatorId: string, newStatus: CreatorStatus) => {
    updateCreatorStatus.mutate({ id: creatorId, status: newStatus });
  };

  const handleDeleteCreator = () => {
    if (selectedCreator) {
      deleteCreator.mutate(selectedCreator.id, {
        onSuccess: () => {
          setDetailOpen(false);
          setSelectedCreator(null);
        },
      });
    }
  };

  const handleNewCampaign = () => {
    if (selectedCreator) { setCampaignCreatorId(selectedCreator.id); setCampaignFormOpen(true); }
  };

  const handleCreateCampaignForCreator = (creator: UgcCreator) => {
    setSelectedCreator(creator);
    setCampaignCreatorId(creator.id);
    setCampaignFormOpen(true);
  };

  const handleCampaignSubmit = (data: any) => {
    if (!campaignCreatorId) return;
    createCampaign.mutate({ ...data, creatorId: campaignCreatorId }, {
      onSuccess: () => { setCampaignFormOpen(false); setCampaignCreatorId(null); },
    });
  };

  const handleNewVideo = (campaignId: string) => {
    setVideoCampaignId(campaignId); setVideoFormOpen(true);
  };

  const handleVideoSubmit = (data: any) => {
    if (!videoCampaignId || !selectedCreator) return;
    createVideo.mutate({ ...data, campaignId: videoCampaignId, creatorId: selectedCreator.id }, {
      onSuccess: () => { setVideoFormOpen(false); setVideoCampaignId(null); },
    });
  };

  const handleVideoStatusChange = (videoId: string, status: string, feedback?: string) => {
    updateVideoStatus.mutate({ id: videoId, status, feedback });
  };

  const isLoading = creatorsLoading || campaignsLoading;
  const activeCampaign = videoCampaignId ? campaigns.find((c) => c.id === videoCampaignId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">UGC Creators</h1>
          <p className="text-sm text-muted-foreground">Gestiona creadores de contenido y campañas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className="h-8">
              <LayoutGrid className="h-4 w-4 mr-1" /> Kanban
            </Button>
            <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')} className="h-8">
              <TableIcon className="h-4 w-4 mr-1" /> Tabla
            </Button>
          </div>
          <Button onClick={() => { setEditingCreator(null); setCreatorFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo Creador
          </Button>
        </div>
      </div>

      {/* Stats */}
      <UgcStatsCards creators={creators} campaigns={campaigns} />

      {/* Main Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : viewMode === 'kanban' ? (
        <Tabs value={kanbanTab} onValueChange={(v) => setKanbanTab(v as 'prospectos' | 'campanas')}>
          <TabsList>
            <TabsTrigger value="prospectos">Prospectos</TabsTrigger>
            <TabsTrigger value="campanas">Campañas</TabsTrigger>
          </TabsList>
          <TabsContent value="prospectos" className="mt-4">
            <UgcProspectKanban
              creators={creators}
              onCreatorClick={handleCreatorClick}
              onStatusChange={handleCreatorStatusChange}
              onCreateCampaign={handleCreateCampaignForCreator}
              getTagsForCreator={getTagsForCreator}
            />
          </TabsContent>
          <TabsContent value="campanas" className="mt-4">
            <UgcKanbanBoard
              campaigns={campaigns}
              onCampaignClick={handleCampaignClick}
              onStatusChange={(id, status) => handleCampaignStatusChange(id, status)}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <UgcTableView
          creators={creators}
          campaigns={campaigns}
          onCreatorClick={handleCreatorClick}
          getTagsForCreator={getTagsForCreator}
        />
      )}

      {/* Modals */}
      <UgcCreatorForm
        open={creatorFormOpen}
        onOpenChange={setCreatorFormOpen}
        creator={editingCreator}
        onSubmit={handleCreatorSubmit}
        isLoading={createCreator.isPending || updateCreator.isPending}
      />

      <UgcCreatorDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        creator={selectedCreator}
        campaigns={campaigns}
        onEdit={() => { setEditingCreator(selectedCreator); setCreatorFormOpen(true); }}
        onNewCampaign={handleNewCampaign}
        onNewVideo={handleNewVideo}
        onCampaignStatusChange={handleCampaignStatusChange}
        onVideoStatusChange={handleVideoStatusChange}
        onDelete={handleDeleteCreator}
      />

      {campaignCreatorId && (
        <UgcCampaignForm
          open={campaignFormOpen}
          onOpenChange={setCampaignFormOpen}
          creatorName={selectedCreator?.name || creators.find(c => c.id === campaignCreatorId)?.name || ''}
          onSubmit={handleCampaignSubmit}
          isLoading={createCampaign.isPending}
        />
      )}

      {videoCampaignId && (
        <UgcVideoForm
          open={videoFormOpen}
          onOpenChange={setVideoFormOpen}
          campaignName={activeCampaign?.name || ''}
          onSubmit={handleVideoSubmit}
          isLoading={createVideo.isPending}
        />
      )}
    </div>
  );
};

export default UgcCreatorsPage;
