import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { CAMPAIGN_STATUS_CONFIG, KANBAN_COLUMNS } from '@/types/ugc';
import type { UgcCampaign, CampaignStatus } from '@/types/ugc';
import { UgcKanbanCard } from './UgcKanbanCard';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tag } from 'lucide-react';
import type { UgcCreatorTag } from '@/hooks/useUgcCreatorTags';
import { useUgcCreatorTags } from '@/hooks/useUgcCreatorTags';

interface UgcKanbanBoardProps {
  campaigns: UgcCampaign[];
  onCampaignClick: (campaign: UgcCampaign) => void;
  onStatusChange: (campaignId: string, newStatus: CampaignStatus) => void;
  onOrderClick?: (orderNumber: string) => void;
  getTagsForCreator?: (creatorId: string) => UgcCreatorTag[];
}

export const UgcKanbanBoard: React.FC<UgcKanbanBoardProps> = ({
  campaigns,
  onCampaignClick,
  onStatusChange,
  onOrderClick,
  getTagsForCreator,
}) => {
  const [draggedCampaign, setDraggedCampaign] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<CampaignStatus | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  const { tags: allTags } = useUgcCreatorTags();

  // Count how many active campaigns each tag has
  const tagCounts = useMemo(() => {
    const activeCampaigns = campaigns.filter((c) => c.status !== 'cancelado');
    return allTags.map((tag) => ({
      ...tag,
      count: activeCampaigns.filter((c) =>
        (getTagsForCreator?.(c.creator_id) ?? []).some((t) => t.id === tag.id)
      ).length,
    }));
  }, [allTags, campaigns, getTagsForCreator]);

  const matchesTagFilter = (campaign: UgcCampaign) => {
    if (!selectedTagId) return true;
    return (getTagsForCreator?.(campaign.creator_id) ?? []).some(
      (t) => t.id === selectedTagId
    );
  };

  const getCampaignsForColumn = (status: CampaignStatus) =>
    campaigns.filter((c) => c.status === status && matchesTagFilter(c));

  const totalActiveCampaigns = campaigns.filter(
    (c) => c.status !== 'cancelado' && matchesTagFilter(c)
  ).length;

  const handleDragStart = (e: React.DragEvent, campaignId: string) => {
    setDraggedCampaign(campaignId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', campaignId);
  };

  const handleDragOver = (e: React.DragEvent, status: CampaignStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = (e: React.DragEvent, status: CampaignStatus) => {
    e.preventDefault();
    const campaignId = e.dataTransfer.getData('text/plain');
    if (campaignId) onStatusChange(campaignId, status);
    setDraggedCampaign(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedCampaign(null);
    setDragOverColumn(null);
  };

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
              {totalActiveCampaigns}
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

      {/* ── Campaign columns ── */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4 min-w-max px-1">
          {KANBAN_COLUMNS.map((status) => {
            const config = CAMPAIGN_STATUS_CONFIG[status];
            const columnCampaigns = getCampaignsForColumn(status);
            const isDragOver = dragOverColumn === status;

            return (
              <div
                key={status}
                className={`flex flex-col w-[260px] rounded-lg border transition-colors ${
                  isDragOver ? 'border-primary bg-accent/50' : 'border-border bg-muted/30'
                }`}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, status)}
              >
                {/* Column Header */}
                <div className="p-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{config.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {columnCampaigns.length}
                    </Badge>
                  </div>
                </div>

                {/* Column Body */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-440px)]">
                  {columnCampaigns.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-xs text-muted-foreground italic">
                      Sin campañas
                    </div>
                  ) : (
                    columnCampaigns.map((campaign) => (
                      <UgcKanbanCard
                        key={campaign.id}
                        campaign={campaign}
                        isDragging={draggedCampaign === campaign.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onClick={() => onCampaignClick(campaign)}
                        onOrderClick={onOrderClick}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
