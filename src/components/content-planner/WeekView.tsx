import React, { useState } from 'react';
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
import { Plus, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const DayColumn: React.FC<{
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
      className={`flex flex-col min-h-[320px] rounded-xl border transition-all duration-200 ${
        isOver
          ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-200/60'
          : today
          ? 'border-blue-300 bg-blue-50/30'
          : isWeekend
          ? 'border-gray-200 bg-gray-50/40'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Day header */}
      <div
        className={`px-3 py-2 border-b flex items-center justify-between ${
          today ? 'bg-blue-100/60 border-blue-200' : 'bg-gray-50/80 border-gray-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              today ? 'text-blue-700' : 'text-gray-500'
            }`}
          >
            {DAY_NAMES[dayIndex]}
          </span>
          <span
            className={`text-sm font-bold ${
              today
                ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center'
                : 'text-gray-800'
            }`}
          >
            {format(dateObj, 'd')}
          </span>
        </div>

        <button
          onClick={onAddClick}
          className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
          title="Agregar contenido"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        <SortableContext items={pieces.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence mode="popLayout">
            {pieces.map((piece) => (
              <ContentCard
                key={piece.id}
                piece={piece}
                teamMembers={teamMembers}
                onClick={onCardClick}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        {/* Empty state */}
        {pieces.length === 0 && (
          <button
            onClick={onAddClick}
            className="w-full py-6 flex flex-col items-center justify-center text-gray-300 hover:text-blue-400 transition-colors group"
          >
            <Sparkles className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-medium">Agregar contenido</span>
          </button>
        )}
      </div>

      {/* Piece count */}
      {pieces.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-100 text-center">
          <span className="text-[10px] text-gray-400 font-medium">
            {pieces.length} {pieces.length === 1 ? 'pieza' : 'piezas'}
          </span>
        </div>
      )}
    </div>
  );
};

export const WeekView: React.FC<WeekViewProps> = ({
  weekDates,
  piecesByDate,
  teamMembers,
  onCardClick,
  onAddClick,
  onMoveToDate,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePiece, setActivePiece] = useState<ContentPiece | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const piece = event.active.data.current?.piece as ContentPiece;
    setActiveId(event.active.id as string);
    setActivePiece(piece);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setActivePiece(null);

    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    const piece = active.data.current?.piece as ContentPiece;

    // Determine the target date — could be a day column id or another card's container
    const targetDate = weekDates.includes(overId) ? overId : null;
    if (!targetDate || targetDate === piece.scheduled_date) return;

    await onMoveToDate({ id: piece.id, newDate: targetDate });
  };

  // Mobile: show one day at a time with horizontal swipe
  const [mobileDay, setMobileDay] = useState(0);

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
          <div className="grid grid-cols-7 gap-2">
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

          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activePiece ? (
              <div className="opacity-90 rotate-2 scale-105">
                <ContentCard
                  piece={activePiece}
                  teamMembers={teamMembers}
                  onClick={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Mobile: single day with navigation */}
      <div className="lg:hidden">
        {/* Day tabs */}
        <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
          {weekDates.map((date, i) => {
            const dateObj = parseISO(date);
            const today = isToday(dateObj);
            const count = (piecesByDate[date] || []).length;
            return (
              <button
                key={date}
                onClick={() => setMobileDay(i)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-center transition-colors ${
                  mobileDay === i
                    ? 'bg-blue-600 text-white'
                    : today
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase">{DAY_NAMES[i]}</div>
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
        <div className="space-y-2">
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
              className="w-full py-12 flex flex-col items-center justify-center text-gray-300 hover:text-blue-400 transition-colors border-2 border-dashed border-gray-200 rounded-xl"
            >
              <Sparkles className="w-7 h-7 mb-2" />
              <span className="text-sm font-medium">Agregar contenido</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};
