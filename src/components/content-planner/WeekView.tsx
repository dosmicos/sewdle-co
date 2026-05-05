import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { format, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { ContentCard } from './ContentCard';
import {
  ContentPiece,
  TeamMember,
} from '@/hooks/useContentPlanner';

interface WeekViewProps {
  weekDates: string[];
  piecesByDate: Record<string, ContentPiece[]>;
  teamMembers: TeamMember[];
  onCardClick: (piece: ContentPiece) => void;
  onAddClick: (date: string) => void;
  onMoveToDate: (data: { id: string; newDate: string }) => Promise<void>;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

const DayColumnInner: React.FC<{
  date: string;
  pieces: ContentPiece[];
  teamMembers: TeamMember[];
  onCardClick: (piece: ContentPiece) => void;
  onAddClick: () => void;
  dayIndex: number;
}> = ({ date, pieces, teamMembers, onCardClick, onAddClick, dayIndex }) => {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const dateObj = parseISO(date);
  const today = isToday(dateObj);
  const isWeekend = dayIndex >= 5;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border transition-all duration-150 ${
        isOver
          ? 'border-[#2563EB] bg-blue-50/60 ring-1 ring-[#3B82F6]/30'
          : today
          ? 'border-[#3B82F6]/40 bg-[#F8FAFC]'
          : isWeekend
          ? 'border-gray-100 bg-gray-50/30'
          : 'border-gray-200/80 bg-white'
      }`}
      style={{ minHeight: pieces.length > 0 ? undefined : '120px' }}
    >
      {/* Day header - compact */}
      <div
        className={`px-2 py-1.5 border-b flex items-center justify-between ${
          today ? 'bg-[#2563EB]/5 border-[#3B82F6]/20' : 'bg-gray-50/60 border-gray-100'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              today ? 'text-[#2563EB]' : 'text-gray-400'
            }`}
          >
            {DAY_NAMES[dayIndex]}
          </span>
          <span
            className={`text-xs font-bold leading-none ${
              today
                ? 'bg-[#2563EB] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]'
                : 'text-[#1E293B]'
            }`}
          >
            {format(dateObj, 'd')}
          </span>
          {pieces.length > 0 && (
            <span className="text-[9px] text-gray-300 font-medium">
              {pieces.length}
            </span>
          )}
        </div>

        <button
          onClick={onAddClick}
          className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-[#2563EB] hover:bg-[#2563EB]/10 transition-colors"
          title="Agregar contenido"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
        <SortableContext items={pieces.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {pieces.map((piece) => (
            <ContentCard
              key={piece.id}
              piece={piece}
              teamMembers={teamMembers}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>

        {/* Empty state - minimal */}
        {pieces.length === 0 && (
          <button
            onClick={onAddClick}
            className="w-full py-3 flex items-center justify-center text-gray-200 hover:text-[#3B82F6] transition-colors group"
          >
            <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
};

const DayColumn = React.memo(DayColumnInner);

export const WeekView: React.FC<WeekViewProps> = ({
  weekDates,
  piecesByDate,
  teamMembers,
  onCardClick,
  onAddClick,
  onMoveToDate,
}) => {
  const [activePiece, setActivePiece] = useState<ContentPiece | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const piece = event.active.data.current?.piece as ContentPiece;
    setActivePiece(piece);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActivePiece(null);

    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    const piece = active.data.current?.piece as ContentPiece;

    const targetDate = weekDates.includes(overId) ? overId : null;
    if (!targetDate || targetDate === piece.scheduled_date) return;

    await onMoveToDate({ id: piece.id, newDate: targetDate });
  }, [weekDates, onMoveToDate]);

  // Mobile: show one day at a time
  const [mobileDay, setMobileDay] = useState(0);

  const noopClick = useCallback(() => {}, []);

  return (
    <>
      {/* Desktop: 7-column grid */}
      <div className="hidden lg:block">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map((date, i) => (
              <DayColumn
                key={date}
                date={date}
                pieces={piecesByDate[date] || []}
                teamMembers={teamMembers}
                onCardClick={onCardClick}
                onAddClick={() => onAddClick(date)}
                dayIndex={i}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activePiece ? (
              <div className="opacity-90 rotate-1 scale-105">
                <ContentCard
                  piece={activePiece}
                  teamMembers={teamMembers}
                  onClick={noopClick}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Mobile: single day with navigation */}
      <div className="lg:hidden">
        {/* Day tabs */}
        <div className="flex gap-0.5 mb-3 overflow-x-auto pb-1">
          {weekDates.map((date, i) => {
            const dateObj = parseISO(date);
            const today = isToday(dateObj);
            const count = (piecesByDate[date] || []).length;
            return (
              <button
                key={date}
                onClick={() => setMobileDay(i)}
                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-center transition-colors ${
                  mobileDay === i
                    ? 'bg-[#2563EB] text-white'
                    : today
                    ? 'bg-[#2563EB]/10 text-[#2563EB]'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <div className="text-[9px] font-semibold uppercase">{DAY_NAMES[i]}</div>
                <div className="text-sm font-bold">{format(dateObj, 'd')}</div>
                {count > 0 && (
                  <div
                    className={`text-[9px] mt-0.5 ${
                      mobileDay === i ? 'text-blue-200' : 'text-gray-400'
                    }`}
                  >
                    {count}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Active day content */}
        <div className="space-y-1.5">
          {(piecesByDate[weekDates[mobileDay]] || []).map((piece) => (
            <ContentCard
              key={piece.id}
              piece={piece}
              teamMembers={teamMembers}
              onClick={onCardClick}
            />
          ))}

          {(piecesByDate[weekDates[mobileDay]] || []).length === 0 && (
            <button
              onClick={() => onAddClick(weekDates[mobileDay])}
              className="w-full py-8 flex flex-col items-center justify-center text-gray-300 hover:text-[#3B82F6] transition-colors border border-dashed border-gray-200 rounded-lg"
            >
              <Plus className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Agregar contenido</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};
