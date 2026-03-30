import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
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

export const ContentCard: React.FC<ContentCardProps> = ({ piece, teamMembers, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: piece.id, data: { piece } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const platform = PLATFORM_CONFIG[piece.platform];
  const contentType = CONTENT_TYPE_CONFIG[piece.content_type];
  const status = STATUS_CONFIG[piece.status];
  const assignedMember = teamMembers.find((m) => m.id === piece.assigned_to);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0, scale: isDragging ? 1.04 : 1 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      className={`group rounded-lg border bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        isDragging ? 'z-50 ring-2 ring-blue-400/50' : ''
      }`}
      onClick={() => onClick(piece)}
    >
      {/* Platform accent bar */}
      <div
        className="h-1 rounded-t-lg"
        style={{ backgroundColor: platform.color }}
      />

      <div className="p-2.5 space-y-2">
        {/* Header: drag handle + platform badge + type */}
        <div className="flex items-center gap-1.5">
          <button
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing shrink-0 touch-none"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5 text-gray-400" />
          </button>

          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: platform.bgColor, color: platform.color }}
          >
            {platform.label}
          </span>

          <span className="text-[10px] text-gray-500 truncate">
            {contentType.icon} {contentType.label}
          </span>
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">
          {piece.title}
        </p>

        {/* Footer: status + time + avatar */}
        <div className="flex items-center justify-between gap-1.5">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: status.bgColor, color: status.color }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: status.dotColor }}
            />
            {status.label}
          </span>

          <div className="flex items-center gap-1.5">
            {piece.scheduled_time && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
                <Clock className="w-3 h-3" />
                {piece.scheduled_time.slice(0, 5)}
              </span>
            )}

            {assignedMember && (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ backgroundColor: platform.color }}
                title={assignedMember.name}
              >
                {assignedMember.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
