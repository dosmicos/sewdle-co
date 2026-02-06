import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import type { UgcCampaign } from '@/types/ugc';

interface UgcKanbanCardProps {
  campaign: UgcCampaign;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

export const UgcKanbanCard: React.FC<UgcKanbanCardProps> = ({
  campaign,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}) => {
  const creator = campaign.creator;
  const avatarUrl = creator?.instagram_handle
    ? `https://unavatar.io/instagram/${creator.instagram_handle}`
    : null;

  const daysInStage = differenceInDays(new Date(), new Date(campaign.updated_at));
  const videosDelivered = campaign.videos?.filter(
    (v) => v.status === 'aprobado' || v.status === 'publicado'
  ).length || 0;
  const videosPending = campaign.videos?.filter(
    (v) => v.status === 'pendiente' || v.status === 'en_revision'
  ).length || 0;

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, campaign.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`p-3 cursor-pointer hover:shadow-md transition-all border border-border ${
        isDragging ? 'opacity-50 rotate-2 shadow-lg' : ''
      }`}
      style={{ backgroundColor: 'var(--card)' }}
    >
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-muted">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={creator?.name || ''}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-medium text-muted-foreground">
              {creator?.name?.charAt(0) || '?'}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {creator?.name || 'Sin nombre'}
          </p>
          {creator?.instagram_handle && (
            <p className="text-xs text-muted-foreground truncate">
              @{creator.instagram_handle}
            </p>
          )}
        </div>
      </div>

      {/* Product */}
      {campaign.product_sent && (
        <p className="text-xs text-muted-foreground mt-2 truncate">
          📦 {campaign.product_sent}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <span className="text-[10px] text-muted-foreground">
          {daysInStage}d en esta etapa
        </span>
        <div className="flex items-center gap-1">
          {videosPending > 0 && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-50 text-orange-600 border-orange-200">
              <Video className="h-2.5 w-2.5 mr-0.5" />
              {videosPending}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {videosDelivered}/{campaign.agreed_videos}
          </span>
        </div>
      </div>
    </Card>
  );
};
