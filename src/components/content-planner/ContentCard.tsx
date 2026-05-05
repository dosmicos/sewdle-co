import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Clock } from 'lucide-react';
import {
  ContentPiece,
  PLATFORM_CONFIG,
  CONTENT_TYPE_CONFIG,
  STATUS_CONFIG,
  TeamMember,
} from '@/hooks/useContentPlanner';

interface ContentCardProps {
  piece: ContentPiece;
  teamMembers: TeamMember[];
  onClick: (piece: ContentPiece) => void;
}

const ContentCardInner: React.FC<ContentCardProps> = ({ piece, teamMembers, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: piece.id, data: { piece } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? '1.04' : '1',
  };

  const platform = PLATFORM_CONFIG[piece.platform];
  const contentType = CONTENT_TYPE_CONFIG[piece.content_type];
  const status = STATUS_CONFIG[piece.status];
  const assignedMember = teamMembers.find((m) => m.id === piece.assigned_to);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border bg-white shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer ${
        isDragging ? 'z-50 ring-2 ring-blue-400/50' : ''
      }`}
      onClick={() => onClick(piece)}
    >
      {/* Platform accent bar */}
      <div
        className="h-0.5 rounded-t-lg"
        style={{ backgroundColor: platform.color }}
      />

      <div className="px-2 py-1.5 space-y-1">
        {/* Header: drag handle + platform badge + type */}
        <div className="flex items-center gap-1">
          <button
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing shrink-0 touch-none"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3 text-gray-400" />
          </button>

          <span
            className="text-[9px] font-semibold px-1 py-px rounded-full shrink-0 leading-tight"
            style={{ backgroundColor: platform.bgColor, color: platform.color }}
          >
            {platform.label}
          </span>

          <span className="text-[9px] text-gray-400 truncate leading-tight">
            {contentType.icon} {contentType.label}
          </span>
        </div>

        {/* Title */}
        <p className="text-xs font-medium text-[#1E293B] leading-tight line-clamp-2">
          {piece.title}
        </p>

        {/* Footer: status + time + avatar */}
        <div className="flex items-center justify-between gap-1">
          <span
            className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1 py-px rounded-full leading-tight"
            style={{ backgroundColor: status.bgColor, color: status.color }}
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: status.dotColor }}
            />
            {status.label}
          </span>

          <div className="flex items-center gap-1">
            {piece.scheduled_time && (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-gray-400">
                <Clock className="w-2.5 h-2.5" />
                {piece.scheduled_time.slice(0, 5)}
              </span>
            )}

            {assignedMember && (
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                style={{ backgroundColor: platform.color }}
                title={assignedMember.name}
              >
                {assignedMember.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ContentCard = React.memo(ContentCardInner);
