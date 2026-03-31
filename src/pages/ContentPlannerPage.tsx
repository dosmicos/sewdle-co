import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  LayoutGrid,
  List,
  Filter,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { WeekView } from '@/components/content-planner/WeekView';
import {
  useContentPlanner,
  getCurrentWeekAndYear,
  ContentPiece,
  ContentPieceInput,
  ContentFilters,
  Platform,
  ContentStatus,
  PLATFORM_CONFIG,
  STATUS_CONFIG,
  CONTENT_TYPE_CONFIG,
} from '@/hooks/useContentPlanner';

// Lazy load the form dialog - not needed on initial render
const ContentForm = lazy(() =>
  import('@/components/content-planner/ContentForm').then((m) => ({
    default: m.ContentForm,
  }))
);

type ViewMode = 'week' | 'list';

const ContentPlannerPage: React.FC = () => {
  const { week: currentWeek, year: currentYear } = getCurrentWeekAndYear();
  const [weekNumber, setWeekNumber] = useState(currentWeek);
  const [year, setYear] = useState(currentYear);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ContentFilters>({});

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingPiece, setEditingPiece] = useState<ContentPiece | null>(null);
  const [addDate, setAddDate] = useState<string | undefined>();

  const {
    pieces,
    piecesByDate,
    weekDates,
    statusCounts,
    isLoading,
    teamMembers,
    addPiece,
    isAdding,
    updatePiece,
    isUpdating,
    deletePiece,
    moveToDate,
    changeStatus,
  } = useContentPlanner(weekNumber, year, filters);

  // Week navigation - memoized
  const goToPrevWeek = useCallback(() => {
    if (weekNumber === 1) {
      setWeekNumber(52);
      setYear((y) => y - 1);
    } else {
      setWeekNumber((w) => w - 1);
    }
  }, [weekNumber]);

  const goToNextWeek = useCallback(() => {
    if (weekNumber >= 52) {
      setWeekNumber(1);
      setYear((y) => y + 1);
    } else {
      setWeekNumber((w) => w + 1);
    }
  }, [weekNumber]);

  const goToCurrentWeek = useCallback(() => {
    setWeekNumber(currentWeek);
    setYear(currentYear);
  }, [currentWeek, currentYear]);

  // Week date range label
  const weekLabel = useMemo(() => {
    if (weekDates.length < 7) return '';
    const start = parseISO(weekDates[0]);
    const end = parseISO(weekDates[6]);
    return `${format(start, "d 'de' MMM", { locale: es })} — ${format(end, "d 'de' MMM, yyyy", { locale: es })}`;
  }, [weekDates]);

  // Memoized handlers
  const handleCardClick = useCallback((piece: ContentPiece) => {
    setEditingPiece(piece);
    setAddDate(undefined);
    setFormOpen(true);
  }, []);

  const handleAddClick = useCallback((date?: string) => {
    setEditingPiece(null);
    setAddDate(date);
    setFormOpen(true);
  }, []);

  const handleSave = useCallback(async (input: ContentPieceInput) => {
    try {
      await addPiece(input);
      toast.success('Contenido creado');
    } catch (err) {
      toast.error('Error al crear contenido');
    }
  }, [addPiece]);

  const handleUpdate = useCallback(async (data: { id: string; updates: Partial<ContentPieceInput> }) => {
    try {
      await updatePiece(data);
      toast.success('Contenido actualizado');
    } catch (err) {
      toast.error('Error al actualizar');
    }
  }, [updatePiece]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deletePiece(id);
      toast.success('Contenido eliminado');
    } catch (err) {
      toast.error('Error al eliminar');
    }
  }, [deletePiece]);

  const handleMoveToDate = useCallback(async (data: { id: string; newDate: string }) => {
    try {
      await moveToDate(data);
    } catch {
      toast.error('Error al mover contenido');
    }
  }, [moveToDate]);

  const handleToggleFilters = useCallback(() => {
    setShowFilters((v) => !v);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Memoized derived values
  const isCurrentWeek = weekNumber === currentWeek && year === currentYear;
  const totalPieces = pieces.length;

  const activeStatusCounts = useMemo(
    () => (Object.entries(statusCounts) as [ContentStatus, number][]).filter(([, count]) => count > 0),
    [statusCounts]
  );

  const hasActiveFilters = !!(filters.platform || filters.status || filters.assigned_to);

  // Memoized list view rows
  const listRows = useMemo(() => {
    return pieces.map((piece) => ({
      piece,
      platform: PLATFORM_CONFIG[piece.platform],
      status: STATUS_CONFIG[piece.status],
      contentType: CONTENT_TYPE_CONFIG[piece.content_type],
      member: teamMembers.find((m) => m.id === piece.assigned_to),
    }));
  }, [pieces, teamMembers]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC]">
      {/* Header - more compact */}
      <div className="bg-white border-b border-gray-200/80 px-4 lg:px-5 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Title + week nav */}
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-[#1E293B] leading-tight">Content Planner</h1>
              <p className="text-xs text-gray-400 mt-0.5">{weekLabel}</p>
            </div>

            <div className="flex items-center gap-0.5 ml-2">
              <Button variant="ghost" size="icon" onClick={goToPrevWeek} className="h-7 w-7">
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={isCurrentWeek ? 'default' : 'outline'}
                size="sm"
                onClick={goToCurrentWeek}
                className={`text-[11px] h-7 px-2.5 font-semibold ${
                  isCurrentWeek ? 'bg-[#2563EB] hover:bg-[#2563EB]/90' : ''
                }`}
              >
                S{weekNumber}
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNextWeek} className="h-7 w-7">
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Inline status pills */}
            {activeStatusCounts.length > 0 && (
              <div className="hidden xl:flex items-center gap-1 ml-2 pl-3 border-l border-gray-200">
                {activeStatusCounts.map(([status, count]) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: STATUS_CONFIG[status].bgColor,
                      color: STATUS_CONFIG[status].color,
                    }}
                  >
                    <span
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: STATUS_CONFIG[status].dotColor }}
                    />
                    {count}
                  </span>
                ))}
                <span className="text-[10px] text-gray-300 ml-0.5">{totalPieces} total</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* View toggle */}
            <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('week')}
                className={`px-2 py-1 text-xs transition-colors ${
                  viewMode === 'week'
                    ? 'bg-[#1E293B] text-white'
                    : 'bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2 py-1 text-xs transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#1E293B] text-white'
                    : 'bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <List className="w-3 h-3" />
              </button>
            </div>

            {/* Filter toggle */}
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleFilters}
              className={`h-7 text-[11px] ${
                showFilters ? 'bg-[#1E293B]' : hasActiveFilters ? 'border-[#2563EB] text-[#2563EB]' : ''
              }`}
            >
              <SlidersHorizontal className="w-3 h-3 mr-1" />
              Filtros
              {hasActiveFilters && !showFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] ml-1" />
              )}
            </Button>

            {/* Add button */}
            <Button
              size="sm"
              onClick={() => handleAddClick()}
              className="h-7 text-[11px] bg-[#2563EB] hover:bg-[#2563EB]/90"
            >
              <Plus className="w-3 h-3 mr-1" />
              Nuevo
            </Button>
          </div>
        </div>

        {/* Filters bar */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-gray-300" />
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Filtrar</span>
            </div>

            <Select
              value={filters.platform || 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, platform: v as Platform | 'all' }))
              }
            >
              <SelectTrigger className="w-[120px] h-7 text-[11px]">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(Object.entries(PLATFORM_CONFIG) as [Platform, typeof PLATFORM_CONFIG[Platform]][]).map(
                  ([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: cfg.color }}
                        />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>

            <Select
              value={filters.status || 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, status: v as ContentStatus | 'all' }))
              }
            >
              <SelectTrigger className="w-[130px] h-7 text-[11px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(Object.entries(STATUS_CONFIG) as [ContentStatus, typeof STATUS_CONFIG[ContentStatus]][]).map(
                  ([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: cfg.dotColor }}
                        />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>

            <Select
              value={filters.assigned_to || 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, assigned_to: v }))
              }
            >
              <SelectTrigger className="w-[140px] h-7 text-[11px]">
                <SelectValue placeholder="Responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-6 text-[10px] text-gray-400 hover:text-gray-600 px-2"
              >
                Limpiar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 lg:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : viewMode === 'week' ? (
          <WeekView
            weekDates={weekDates}
            piecesByDate={piecesByDate}
            teamMembers={teamMembers}
            onCardClick={handleCardClick}
            onAddClick={handleAddClick}
            onMoveToDate={handleMoveToDate}
          />
        ) : (
          /* List view */
          <div className="bg-white rounded-lg border border-gray-200/80 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/60">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Titulo</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Plataforma</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Tipo</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Estado</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Fecha</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Responsable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-gray-300 text-sm">
                      No hay contenido para esta semana
                    </TableCell>
                  </TableRow>
                ) : (
                  listRows.map(({ piece, platform, status, contentType, member }) => (
                    <TableRow
                      key={piece.id}
                      className="cursor-pointer hover:bg-gray-50/80 transition-colors"
                      onClick={() => handleCardClick(piece)}
                    >
                      <TableCell className="font-medium text-xs text-[#1E293B]">{piece.title}</TableCell>
                      <TableCell>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: platform.bgColor, color: platform.color }}
                        >
                          {platform.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px] text-gray-500">
                        {contentType.icon} {contentType.label}
                      </TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: status.bgColor, color: status.color }}
                        >
                          <span
                            className="w-1 h-1 rounded-full"
                            style={{ backgroundColor: status.dotColor }}
                          />
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px] text-gray-500">
                        {piece.scheduled_date
                          ? format(parseISO(piece.scheduled_date), "d MMM", { locale: es })
                          : '--'}
                        {piece.scheduled_time ? ` ${piece.scheduled_time.slice(0, 5)}` : ''}
                      </TableCell>
                      <TableCell className="text-[11px] text-gray-500">
                        {member?.name || '--'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Floating add button (mobile) */}
      <button
        onClick={() => handleAddClick()}
        className="lg:hidden fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#2563EB] text-white shadow-lg hover:bg-[#2563EB]/90 active:scale-95 transition-all flex items-center justify-center z-40"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Content Form Dialog - lazy loaded */}
      {formOpen && (
        <Suspense fallback={null}>
          <ContentForm
            open={formOpen}
            onOpenChange={setFormOpen}
            piece={editingPiece}
            defaultDate={addDate}
            defaultWeek={weekNumber}
            defaultYear={year}
            teamMembers={teamMembers}
            onSave={handleSave}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            isSaving={isAdding || isUpdating}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ContentPlannerPage;
