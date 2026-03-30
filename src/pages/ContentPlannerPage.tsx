import React, { useState, useMemo } from 'react';
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
import { format, parseISO, startOfISOWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { WeekView } from '@/components/content-planner/WeekView';
import { ContentForm } from '@/components/content-planner/ContentForm';
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

  // Week navigation
  const goToPrevWeek = () => {
    if (weekNumber === 1) {
      setWeekNumber(52);
      setYear((y) => y - 1);
    } else {
      setWeekNumber((w) => w - 1);
    }
  };

  const goToNextWeek = () => {
    if (weekNumber >= 52) {
      setWeekNumber(1);
      setYear((y) => y + 1);
    } else {
      setWeekNumber((w) => w + 1);
    }
  };

  const goToCurrentWeek = () => {
    setWeekNumber(currentWeek);
    setYear(currentYear);
  };

  // Week date range label
  const weekLabel = useMemo(() => {
    if (weekDates.length < 7) return '';
    const start = parseISO(weekDates[0]);
    const end = parseISO(weekDates[6]);
    return `${format(start, "d 'de' MMM", { locale: es })} — ${format(end, "d 'de' MMM, yyyy", { locale: es })}`;
  }, [weekDates]);

  // Handlers
  const handleCardClick = (piece: ContentPiece) => {
    setEditingPiece(piece);
    setAddDate(undefined);
    setFormOpen(true);
  };

  const handleAddClick = (date?: string) => {
    setEditingPiece(null);
    setAddDate(date);
    setFormOpen(true);
  };

  const handleSave = async (input: ContentPieceInput) => {
    try {
      await addPiece(input);
      toast.success('Contenido creado');
    } catch (err) {
      toast.error('Error al crear contenido');
    }
  };

  const handleUpdate = async (data: { id: string; updates: Partial<ContentPieceInput> }) => {
    try {
      await updatePiece(data);
      toast.success('Contenido actualizado');
    } catch (err) {
      toast.error('Error al actualizar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePiece(id);
      toast.success('Contenido eliminado');
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  const handleMoveToDate = async (data: { id: string; newDate: string }) => {
    try {
      await moveToDate(data);
    } catch {
      toast.error('Error al mover contenido');
    }
  };

  const isCurrentWeek = weekNumber === currentWeek && year === currentYear;
  const totalPieces = pieces.length;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title + week nav */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Content Planner</h1>
              <p className="text-sm text-gray-500 mt-0.5">{weekLabel}</p>
            </div>

            <div className="flex items-center gap-1 ml-4">
              <Button variant="ghost" size="icon" onClick={goToPrevWeek} className="h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant={isCurrentWeek ? 'default' : 'outline'}
                size="sm"
                onClick={goToCurrentWeek}
                className="text-xs h-8 px-3"
              >
                Semana {weekNumber}
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNextWeek} className="h-8 w-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Status counters */}
            <div className="hidden xl:flex items-center gap-1.5 mr-3">
              {(Object.entries(statusCounts) as [ContentStatus, number][])
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <Badge
                    key={status}
                    variant="secondary"
                    className="text-[10px] h-5 px-1.5"
                    style={{
                      backgroundColor: STATUS_CONFIG[status].bgColor,
                      color: STATUS_CONFIG[status].color,
                    }}
                  >
                    {count} {STATUS_CONFIG[status].label}
                  </Badge>
                ))}
            </div>

            {/* View toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('week')}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'week'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Filter toggle */}
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className="h-8"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
              Filtros
            </Button>

            {/* Add button */}
            <Button size="sm" onClick={() => handleAddClick()} className="h-8">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nuevo
            </Button>
          </div>
        </div>

        {/* Filters bar */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Filtrar por:</span>
            </div>

            <Select
              value={filters.platform || 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, platform: v as Platform | 'all' }))
              }
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(Object.entries(PLATFORM_CONFIG) as [Platform, typeof PLATFORM_CONFIG[Platform]][]).map(
                  ([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
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
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(Object.entries(STATUS_CONFIG) as [ContentStatus, typeof STATUS_CONFIG[ContentStatus]][]).map(
                  ([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
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
              <SelectTrigger className="w-[160px] h-8 text-xs">
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

            {(filters.platform || filters.status || filters.assigned_to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({})}
                className="h-7 text-xs text-gray-500"
              >
                Limpiar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
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
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-xs font-semibold">Título</TableHead>
                  <TableHead className="text-xs font-semibold">Plataforma</TableHead>
                  <TableHead className="text-xs font-semibold">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold">Estado</TableHead>
                  <TableHead className="text-xs font-semibold">Fecha</TableHead>
                  <TableHead className="text-xs font-semibold">Responsable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pieces.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                      No hay contenido para esta semana
                    </TableCell>
                  </TableRow>
                ) : (
                  pieces.map((piece) => {
                    const platform = PLATFORM_CONFIG[piece.platform];
                    const status = STATUS_CONFIG[piece.status];
                    const contentType = CONTENT_TYPE_CONFIG[piece.content_type];
                    const member = teamMembers.find((m) => m.id === piece.assigned_to);
                    return (
                      <TableRow
                        key={piece.id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleCardClick(piece)}
                      >
                        <TableCell className="font-medium text-sm">{piece.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-[10px]"
                            style={{ backgroundColor: platform.bgColor, color: platform.color }}
                          >
                            {platform.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {contentType.icon} {contentType.label}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-[10px]"
                            style={{ backgroundColor: status.bgColor, color: status.color }}
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {piece.scheduled_date
                            ? format(parseISO(piece.scheduled_date), "d MMM", { locale: es })
                            : '—'}
                          {piece.scheduled_time ? ` ${piece.scheduled_time.slice(0, 5)}` : ''}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {member?.name || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Floating add button (mobile) */}
      <button
        onClick={() => handleAddClick()}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Content Form Dialog */}
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
    </div>
  );
};

export default ContentPlannerPage;
