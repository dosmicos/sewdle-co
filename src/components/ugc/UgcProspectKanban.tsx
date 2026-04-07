import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { MessageSquare, Plus, UserCheck, UserX, Megaphone, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { CREATOR_STATUS_CONFIG, PROSPECT_KANBAN_COLUMNS } from '@/types/ugc';
import type { UgcCreator, UgcCampaign, CreatorStatus } from '@/types/ugc';
import type { UgcCreatorTag } from '@/hooks/useUgcCreatorTags';
import { useUgcCreatorTags } from '@/hooks/useUgcCreatorTags';

interface UgcProspectKanbanProps {
  creators: UgcCreator[];
  campaigns: UgcCampaign[];
  onCreatorClick: (creator: UgcCreator) => void;
  onStatusChange: (creatorId: string, newStatus: CreatorStatus) => void;
  onCreateCampaign: (creator: UgcCreator) => void;
  getTagsForCreator?: (creatorId: string) => UgcCreatorTag[];
}

export const UgcProspectKanban: React.FC<UgcProspectKanbanProps> = ({
  creators,
  campaigns,
  onCreatorClick,
  onStatusChange,
  onCreateCampaign,
  getTagsForCreator,
}) => {
  const [draggedCreator, setDraggedCreator] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<CreatorStatus | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [showWithCampaigns, setShowWithCampaigns] = useState(false);

  const { tags: allTags } = useUgcCreatorTags();

  const getCampaignCount = (creatorId: string) =>
    campaigns.filter((c) => c.creator_id === creatorId).length;

  // Creators with ANY non-cancelled campaign (active OR completed) → excluded from prospect columns
  const creatorsWithAnyCampaign = useMemo(
    () =>
      new Set(
        campaigns
          .filter((c) => c.status !== 'cancelado')
          .map((c) => c.creator_id)
      ),
    [campaigns]
  );

  const matchesTagFilter = (creatorId: string) => {
    if (!selectedTagId) return true;
    return (getTagsForCreator?.(creatorId) ?? []).some((t) => t.id === selectedTagId);
  };

  // Tag counts — how many prospect creators (not yet in campaign) have each tag
  const tagCounts = useMemo(() => {
    const prospectCreators = creators.filter(
      (c) =>
        !creatorsWithAnyCampaign.has(c.id) &&
        (PROSPECT_KANBAN_COLUMNS as string[]).includes(c.status) ||
        c.status === 'respondio_si'
    );
    return allTags.map((tag) => ({
      ...tag,
      count: prospectCreators.filter((c) =>
        (getTagsForCreator?.(c.id) ?? []).some((t) => t.id === tag.id)
      ).length,
    }));
  }, [allTags, creators, creatorsWithAnyCampaign, getTagsForCreator]);

  const getCreatorsForColumn = (status: CreatorStatus) => {
    let result: UgcCreator[];
    if (status === 'negociando') {
      result = creators.filter(
        (c) =>
          (c.status === 'negociando' || c.status === 'respondio_si') &&
          !creatorsWithAnyCampaign.has(c.id)
      );
    } else {
      result = creators.filter(
        (c) => c.status === status && !creatorsWithAnyCampaign.has(c.id)
      );
    }
    if (selectedTagId) result = result.filter((c) => matchesTagFilter(c.id));
    return result;
  };

  // "Con campaña" creators — have any non-cancelled campaign,
  // shown in the collapsible section below
  const creatorsWithCampaignSection = useMemo(() => {
    const result = creators.filter(
      (c) =>
        creatorsWithAnyCampaign.has(c.id) &&
        c.status !== 'inactivo'
    );
    if (selectedTagId) return result.filter((c) => matchesTagFilter(c.id));
    return result;
  }, [creators, creatorsWithAnyCampaign, selectedTagId]);

  const handleDragStart = (e: React.DragEvent, creatorId: string) => {
    setDraggedCreator(creatorId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', creatorId);
  };

  const handleDragOver = (e: React.DragEvent, status: CreatorStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDrop = (e: React.DragEvent, status: CreatorStatus) => {
    e.preventDefault();
    const creatorId = e.dataTransfer.getData('text/plain');
    if (creatorId) onStatusChange(creatorId, status);
    setDraggedCreator(null);
    setDragOverColumn(null);
  };

  const getCampaignStatusLabel = (creatorId: string) => {
    const creatorCampaigns = campaigns.filter(
      (c) => c.creator_id === creatorId && c.status !== 'cancelado'
    );
    if (creatorCampaigns.length === 0) return null;
    const hasCompleted = creatorCampaigns.some((c) => c.status === 'completado');
    const hasActive = creatorCampaigns.some((c) => c.status !== 'completado');
    if (hasActive) return { label: 'Campaña activa', color: 'bg-green-100 text-green-700 border-green-200' };
    if (hasCompleted) return { label: 'Campaña completada', color: 'bg-gray-100 text-gray-600 border-gray-200' };
    return null;
  };

  const renderCreatorCard = (creator: UgcCreator, colStatus?: CreatorStatus) => {
    const avatarUrl = creator.instagram_handle
      ? `https://unavatar.io/instagram/${creator.instagram_handle}`
      : null;
    const creatorTags = getTagsForCreator?.(creator.id) ?? [];
    const campaignCount = getCampaignCount(creator.id);
    const campaignBadge = getCampaignStatusLabel(creator.id);

    return (
      <Card
        key={creator.id}
        draggable={!!colStatus}
        onDragStart={colStatus ? (e) => handleDragStart(e, creator.id) : undefined}
        onDragEnd={() => { setDraggedCreator(null); setDragOverColumn(null); }}
        onClick={() => onCreatorClick(creator)}
        className={`p-3 cursor-pointer hover:shadow-md transition-all border border-border ${
          draggedCreator === creator.id ? 'opacity-50 rotate-2 shadow-lg' : ''
        }`}
        style={{ backgroundColor: 'var(--card)' }}
      >
        <div className="flex items-start gap-2">
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-muted">
            {avatarUrl ? (
              <img src={avatarUrl} alt={creator.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-medium text-muted-foreground">
                {creator.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{creator.name}</p>
            {creator.instagram_handle && (
              <p className="text-xs text-muted-foreground truncate">@{creator.instagram_handle}</p>
            )}
            <p className="text-xs text-muted-foreground">{creator.instagram_followers?.toLocaleString() ?? 0} seguidores</p>
          </div>
        </div>

        {/* Tags, campaign count, and campaign status badge */}
        {(creatorTags.length > 0 || campaignCount > 0 || campaignBadge) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {creatorTags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-[10px] px-1.5 py-0"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
            {campaignCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                <Megaphone className="h-2.5 w-2.5" />
                {campaignCount}
              </Badge>
            )}
            {campaignBadge && (
              <span className={`inline-flex items-center text-[10px] px-1.5 py-0 rounded-full border ${campaignBadge.color}`}>
                {campaignBadge.label}
              </span>
            )}
          </div>
        )}

        {/* Quick actions — only in prospect columns */}
        {colStatus && (
          <div className="flex gap-1 mt-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
            {colStatus === 'prospecto' && (
              <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => onStatusChange(creator.id, 'contactado')}>
                <MessageSquare className="h-3 w-3 mr-1" /> Contactado
              </Button>
            )}
            {colStatus === 'contactado' && (
              <>
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => onStatusChange(creator.id, 'negociando')}>
                  <UserCheck className="h-3 w-3 mr-1" /> Sí
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => onStatusChange(creator.id, 'respondio_no')}>
                  <UserX className="h-3 w-3 mr-1" /> No
                </Button>
              </>
            )}
            {colStatus === 'negociando' && (
              <Button size="sm" variant="default" className="text-xs h-7 flex-1" onClick={() => onCreateCampaign(creator)}>
                <Plus className="h-3 w-3 mr-1" /> Campaña
              </Button>
            )}
          </div>
        )}
      </Card>
    );
  };

  const totalProspects = PROSPECT_KANBAN_COLUMNS.reduce(
    (sum, s) => sum + getCreatorsForColumn(s).length,
    0
  );

  return (
    <div className="space-y-4">
      {/* ── Tag filter bar ── */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Tag className="h-3.5 w-3.5" />
            Filtrar:
          </div>
          <button
            onClick={() => setSelectedTagId(null)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              selectedTagId === null
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
            }`}
          >
            Todas
            <span className={`ml-0.5 px-1 rounded text-[10px] ${
              selectedTagId === null ? 'bg-background/20' : 'bg-muted'
            }`}>
              {totalProspects}
            </span>
          </button>
          {tagCounts.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedTagId === tag.id
                  ? 'text-white border-transparent'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
              }`}
              style={
                selectedTagId === tag.id
                  ? { backgroundColor: tag.color, borderColor: tag.color }
                  : {}
              }
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
              <span className={`ml-0.5 px-1 rounded text-[10px] ${
                selectedTagId === tag.id ? 'bg-white/20' : 'bg-muted'
              }`}>
                {tag.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Prospect columns ── */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4 min-w-max px-1">
          {PROSPECT_KANBAN_COLUMNS.map((status) => {
            const config = CREATOR_STATUS_CONFIG[status];
            const columnCreators = getCreatorsForColumn(status);
            const isDragOver = dragOverColumn === status;

            return (
              <div
                key={status}
                className={`flex flex-col w-[280px] rounded-lg border transition-colors ${
                  isDragOver ? 'border-primary bg-accent/50' : 'border-border bg-muted/30'
                }`}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className="p-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{config.label}</span>
                    <Badge variant="secondary" className="text-xs">{columnCreators.length}</Badge>
                  </div>
                </div>

                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-440px)]">
                  {columnCreators.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-xs text-muted-foreground italic">
                      Sin prospectos
                    </div>
                  ) : (
                    columnCreators.map((creator) => renderCreatorCard(creator, status))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* ── "Con campaña" collapsible section ── */}
      {creatorsWithCampaignSection.length > 0 && (
        <div className="rounded-lg border border-border">
          <button
            onClick={() => setShowWithCampaigns((v) => !v)}
            className="w-full flex items-center justify-between p-3 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-2">
              {showWithCampaigns ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              Con campaña
              <Badge variant="secondary" className="text-xs">{creatorsWithCampaignSection.length}</Badge>
            </div>
            <span className="text-xs font-normal text-muted-foreground">
              {showWithCampaigns ? 'Ocultar' : 'Ver todas'}
            </span>
          </button>

          {showWithCampaigns && (
            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 border-t border-border pt-3">
              {creatorsWithCampaignSection.map((creator) => renderCreatorCard(creator))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
