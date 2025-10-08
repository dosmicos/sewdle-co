import { useState, useMemo } from 'react';
import { WorkshopProspect, ProspectStage } from '@/types/prospects';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { TextCell } from './cells/TextCell';
import { SelectCell } from './cells/SelectCell';
import { BadgeCell } from './cells/BadgeCell';
import { NumberCell } from './cells/NumberCell';
import { DateCell } from './cells/DateCell';
import { ColumnSelector } from './ColumnSelector';
import { TableToolbar } from './TableToolbar';
import { BulkActionsBar } from './BulkActionsBar';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProspectsTableViewProps {
  prospects: WorkshopProspect[];
  onUpdate: (id: string, updates: Partial<WorkshopProspect>) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
}

type ColumnConfig = {
  id: keyof WorkshopProspect | 'select';
  label: string;
  visible: boolean;
  width: string;
  sortable: boolean;
};

type SortConfig = {
  column: keyof WorkshopProspect | null;
  direction: 'asc' | 'desc' | null;
};

export const ProspectsTableView = ({ 
  prospects, 
  onUpdate, 
  onDelete 
}: ProspectsTableViewProps) => {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<ProspectStage[]>([]);
  const [cityFilter, setCityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [qualityRange, setQualityRange] = useState<[number, number]>([0, 10]);
  const [assignedToFilter, setAssignedToFilter] = useState('');

  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'select', label: '', visible: true, width: 'w-12', sortable: false },
    { id: 'name', label: 'Nombre', visible: true, width: 'w-48', sortable: true },
    { id: 'contact_person', label: 'Contacto', visible: true, width: 'w-44', sortable: true },
    { id: 'phone', label: 'Teléfono', visible: true, width: 'w-36', sortable: false },
    { id: 'email', label: 'Email', visible: true, width: 'w-52', sortable: false },
    { id: 'city', label: 'Ciudad', visible: true, width: 'w-32', sortable: true },
    { id: 'address', label: 'Dirección', visible: false, width: 'w-60', sortable: false },
    { id: 'stage', label: 'Etapa', visible: true, width: 'w-48', sortable: true },
    { id: 'source', label: 'Fuente', visible: true, width: 'w-32', sortable: true },
    { id: 'quality_index', label: 'Calidad', visible: true, width: 'w-24', sortable: true },
    { id: 'specialties', label: 'Especialidades', visible: false, width: 'w-52', sortable: false },
    { id: 'assigned_to', label: 'Asignado a', visible: false, width: 'w-36', sortable: false },
    { id: 'notes', label: 'Notas', visible: false, width: 'w-80', sortable: false },
    { id: 'created_at', label: 'Fecha Creación', visible: true, width: 'w-36', sortable: true },
  ]);

  // Toggle column visibility
  const toggleColumn = (columnId: string) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  };

  // Reorder columns
  const reorderColumns = (fromIndex: number, toIndex: number) => {
    const newColumns = [...columns];
    const [removed] = newColumns.splice(fromIndex, 1);
    newColumns.splice(toIndex, 0, removed);
    setColumns(newColumns);
  };

  // Save/Load column preferences
  const saveColumnPreferences = () => {
    localStorage.setItem('prospects-table-columns', JSON.stringify(columns));
  };

  const loadColumnPreferences = () => {
    const saved = localStorage.getItem('prospects-table-columns');
    if (saved) {
      setColumns(JSON.parse(saved));
    }
  };

  // Selection handlers
  const toggleAll = () => {
    if (selectedRows.size === filteredProspects.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredProspects.map(p => p.id)));
    }
  };

  const toggleRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  // Sorting handler
  const handleSort = (column: keyof WorkshopProspect) => {
    if (!columns.find(c => c.id === column)?.sortable) return;
    
    setSortConfig(prev => {
      if (prev.column === column) {
        if (prev.direction === 'asc') return { column, direction: 'desc' };
        if (prev.direction === 'desc') return { column: null, direction: null };
      }
      return { column, direction: 'asc' };
    });
  };

  // Filter and sort prospects
  const filteredProspects = useMemo(() => {
    let filtered = [...prospects];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(query) ||
        p.contact_person?.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query) ||
        p.phone?.toLowerCase().includes(query)
      );
    }

    // Stage filter
    if (stageFilter.length > 0) {
      filtered = filtered.filter(p => stageFilter.includes(p.stage));
    }

    // City filter
    if (cityFilter) {
      filtered = filtered.filter(p => p.city?.toLowerCase().includes(cityFilter.toLowerCase()));
    }

    // Source filter
    if (sourceFilter) {
      filtered = filtered.filter(p => p.source === sourceFilter);
    }

    // Quality range filter
    filtered = filtered.filter(p => {
      const quality = p.quality_index || 0;
      return quality >= qualityRange[0] && quality <= qualityRange[1];
    });

    // Assigned to filter
    if (assignedToFilter) {
      filtered = filtered.filter(p => p.assigned_to === assignedToFilter);
    }

    // Sorting
    if (sortConfig.column && sortConfig.direction) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.column!];
        const bVal = b[sortConfig.column!];
        
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [prospects, searchQuery, stageFilter, cityFilter, sourceFilter, qualityRange, assignedToFilter, sortConfig]);

  const visibleColumns = columns.filter(c => c.visible);

  const renderSortIcon = (columnId: keyof WorkshopProspect) => {
    if (sortConfig.column !== columnId) {
      return <ChevronsUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="h-4 w-4 ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 ml-1" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        stageFilter={stageFilter}
        onStageFilterChange={setStageFilter}
        cityFilter={cityFilter}
        onCityFilterChange={setCityFilter}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        qualityRange={qualityRange}
        onQualityRangeChange={setQualityRange}
        assignedToFilter={assignedToFilter}
        onAssignedToFilterChange={setAssignedToFilter}
      />

      {/* Column Selector */}
      <div className="flex justify-end">
        <ColumnSelector
          columns={columns}
          onToggle={toggleColumn}
          onReorder={reorderColumns}
          onSave={saveColumnPreferences}
          onLoad={loadColumnPreferences}
        />
      </div>

      {/* Bulk Actions Bar */}
      {selectedRows.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedRows.size}
          selectedIds={Array.from(selectedRows)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClear={() => setSelectedRows(new Set())}
        />
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {visibleColumns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    'h-12 font-medium',
                    column.width,
                    column.sortable && 'cursor-pointer select-none'
                  )}
                  onClick={() => column.sortable && column.id !== 'select' && handleSort(column.id as keyof WorkshopProspect)}
                >
                  {column.id === 'select' ? (
                    <Checkbox
                      checked={selectedRows.size === filteredProspects.length && filteredProspects.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  ) : (
                    <div className="flex items-center">
                      {column.label}
                      {column.sortable && renderSortIcon(column.id as keyof WorkshopProspect)}
                    </div>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProspects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="h-24 text-center">
                  No se encontraron prospectos
                </TableCell>
              </TableRow>
            ) : (
              filteredProspects.map((prospect) => (
                <TableRow
                  key={prospect.id}
                  className={cn(
                    'h-12 hover:bg-muted/50',
                    selectedRows.has(prospect.id) && 'bg-muted/50'
                  )}
                >
                  {visibleColumns.map((column) => {
                    if (column.id === 'select') {
                      return (
                        <TableCell key="select" className="w-12">
                          <Checkbox
                            checked={selectedRows.has(prospect.id)}
                            onCheckedChange={() => toggleRow(prospect.id)}
                          />
                        </TableCell>
                      );
                    }

                    const columnId = column.id as keyof WorkshopProspect;
                    
                    return (
                      <TableCell key={columnId} className={column.width}>
                        {columnId === 'name' && (
                          <TextCell
                            value={prospect.name}
                            onSave={(value) => onUpdate(prospect.id, { name: value })}
                            required
                          />
                        )}
                        {columnId === 'contact_person' && (
                          <TextCell
                            value={prospect.contact_person}
                            onSave={(value) => onUpdate(prospect.id, { contact_person: value })}
                          />
                        )}
                        {columnId === 'phone' && (
                          <TextCell
                            value={prospect.phone}
                            onSave={(value) => onUpdate(prospect.id, { phone: value })}
                          />
                        )}
                        {columnId === 'email' && (
                          <TextCell
                            value={prospect.email}
                            onSave={(value) => onUpdate(prospect.id, { email: value })}
                            type="email"
                          />
                        )}
                        {columnId === 'city' && (
                          <TextCell
                            value={prospect.city}
                            onSave={(value) => onUpdate(prospect.id, { city: value })}
                          />
                        )}
                        {columnId === 'address' && (
                          <TextCell
                            value={prospect.address}
                            onSave={(value) => onUpdate(prospect.id, { address: value })}
                          />
                        )}
                        {columnId === 'stage' && (
                          <SelectCell
                            value={prospect.stage}
                            prospectId={prospect.id}
                            onSave={(value) => onUpdate(prospect.id, { stage: value })}
                          />
                        )}
                        {columnId === 'source' && (
                          <BadgeCell value={prospect.source} />
                        )}
                        {columnId === 'quality_index' && (
                          <NumberCell
                            value={prospect.quality_index}
                            onSave={(value) => onUpdate(prospect.id, { quality_index: value })}
                            min={0}
                            max={10}
                          />
                        )}
                        {columnId === 'specialties' && (
                          <BadgeCell value={prospect.specialties?.join(', ')} />
                        )}
                        {columnId === 'notes' && (
                          <TextCell
                            value={prospect.notes}
                            onSave={(value) => onUpdate(prospect.id, { notes: value })}
                            multiline
                          />
                        )}
                        {columnId === 'created_at' && (
                          <DateCell value={prospect.created_at} />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};