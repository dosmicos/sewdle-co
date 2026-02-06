import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { MessageSquare, Plus, UserCheck, UserX } from 'lucide-react';
import { CREATOR_STATUS_CONFIG, PROSPECT_KANBAN_COLUMNS } from '@/types/ugc';
import type { UgcCreator, CreatorStatus } from '@/types/ugc';
import type { UgcCreatorTag } from '@/hooks/useUgcCreatorTags';

interface UgcProspectKanbanProps {
  creators: UgcCreator[];
  onCreatorClick: (creator: UgcCreator) => void;
  onStatusChange: (creatorId: string, newStatus: CreatorStatus) => void;
  onCreateCampaign: (creator: UgcCreator) => void;
  getTagsForCreator?: (creatorId: string) => UgcCreatorTag[];
}

export const UgcProspectKanban: React.FC<UgcProspectKanbanProps> = ({
  creators,
  onCreatorClick,
  onStatusChange,
  onCreateCampaign,
  getTagsForCreator,
}) => {
  const [draggedCreator, setDraggedCreator] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<CreatorStatus | null>(null);

  const getCreatorsForColumn = (status: CreatorStatus) =>
    creators.filter((c) => c.status === status);

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

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-4 min-w-max px-1">
        {PROSPECT_KANBAN_COLUMNS.map((status) => {
          const config = CREATOR_STATUS_CONFIG[status];
          const columnCreators = getCreatorsForColumn(status);
          const isDragOver = dragOverColumn === status;

          return (
            <div
              key={status}
              className={`flex flex-col w-[280px] min-h-[500px] rounded-lg border transition-colors ${
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

              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
                {columnCreators.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-xs text-muted-foreground italic">
                    Sin prospectos
                  </div>
                ) : (
                  columnCreators.map((creator) => {
                    const avatarUrl = creator.instagram_handle
                      ? `https://unavatar.io/instagram/${creator.instagram_handle}`
                      : null;
                    const creatorTags = getTagsForCreator?.(creator.id) || [];

                    return (
                      <Card
                        key={creator.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, creator.id)}
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
                            <p className="text-xs text-muted-foreground">{creator.instagram_followers?.toLocaleString() || 0} seguidores</p>
                          </div>
                        </div>

                        {/* Tags */}
                        {creatorTags.length > 0 && (
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
                          </div>
                        )}

                        {/* Quick actions based on status */}
                        <div className="flex gap-1 mt-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                          {status === 'prospecto' && (
                            <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => onStatusChange(creator.id, 'contactado')}>
                              <MessageSquare className="h-3 w-3 mr-1" /> Contactado
                            </Button>
                          )}
                          {status === 'contactado' && (
                            <>
                              <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => onStatusChange(creator.id, 'respondio_si')}>
                                <UserCheck className="h-3 w-3 mr-1" /> Sí
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => onStatusChange(creator.id, 'respondio_no')}>
                                <UserX className="h-3 w-3 mr-1" /> No
                              </Button>
                            </>
                          )}
                          {status === 'respondio_si' && (
                            <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => onStatusChange(creator.id, 'negociando')}>
                              Negociando
                            </Button>
                          )}
                          {(status === 'respondio_si' || status === 'negociando') && (
                            <Button size="sm" variant="default" className="text-xs h-7 flex-1" onClick={() => onCreateCampaign(creator)}>
                              <Plus className="h-3 w-3 mr-1" /> Campaña
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })
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
