import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CAMPAIGN_STATUS_CONFIG, KANBAN_COLUMNS } from '@/types/ugc';
import type { UgcCampaign, CampaignStatus } from '@/types/ugc';
import { UgcKanbanCard } from './UgcKanbanCard';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface UgcKanbanBoardProps {
  campaigns: UgcCampaign[];
  onCampaignClick: (campaign: UgcCampaign) => void;
  onStatusChange: (campaignId: string, newStatus: CampaignStatus) => void;
  onOrderClick?: (orderNumber: string) => void;
}

export const UgcKanbanBoard: React.FC<UgcKanbanBoardProps> = ({
  campaigns,
  onCampaignClick,
  onStatusChange,
  onOrderClick,
}) => {
  const [draggedCampaign, setDraggedCampaign] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<CampaignStatus | null>(null);

  const getCampaignsForColumn = (status: CampaignStatus) =>
    campaigns.filter((c) => c.status === status);

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

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, status: CampaignStatus) => {
    e.preventDefault();
    const campaignId = e.dataTransfer.getData('text/plain');
    if (campaignId && campaignId !== '') {
      onStatusChange(campaignId, status);
    }
    setDraggedCampaign(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedCampaign(null);
    setDragOverColumn(null);
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-4 min-w-max px-1">
        {KANBAN_COLUMNS.map((status) => {
          const config = CAMPAIGN_STATUS_CONFIG[status];
          const columnCampaigns = getCampaignsForColumn(status);
          const isDragOver = dragOverColumn === status;

          return (
            <div
              key={status}
              className={`flex flex-col w-[280px] rounded-lg border transition-colors ${
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
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-380px)]">
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
  );
};
