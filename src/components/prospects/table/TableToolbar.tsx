import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import { STAGE_LABELS, ProspectStage } from '@/types/prospects';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';

interface TableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  stageFilter: ProspectStage[];
  onStageFilterChange: (value: ProspectStage[]) => void;
  cityFilter: string;
  onCityFilterChange: (value: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  qualityRange: [number, number];
  onQualityRangeChange: (value: [number, number]) => void;
  assignedToFilter: string;
  onAssignedToFilterChange: (value: string) => void;
}

export const TableToolbar = ({
  searchQuery,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  cityFilter,
  onCityFilterChange,
  sourceFilter,
  onSourceFilterChange,
  qualityRange,
  onQualityRangeChange,
  assignedToFilter,
  onAssignedToFilterChange,
}: TableToolbarProps) => {
  const hasFilters = 
    searchQuery || 
    stageFilter.length > 0 || 
    cityFilter || 
    sourceFilter || 
    qualityRange[0] > 0 || 
    qualityRange[1] < 10 ||
    assignedToFilter;

  const clearFilters = () => {
    onSearchChange('');
    onStageFilterChange([]);
    onCityFilterChange('');
    onSourceFilterChange('');
    onQualityRangeChange([0, 10]);
    onAssignedToFilterChange('');
  };

  const toggleStage = (stage: ProspectStage) => {
    if (stageFilter.includes(stage)) {
      onStageFilterChange(stageFilter.filter(s => s !== stage));
    } else {
      onStageFilterChange([...stageFilter, stage]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, contacto, email, teléfono..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stage Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Etapa
            {stageFilter.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1">
                {stageFilter.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <h4 className="font-medium text-sm mb-3">Filtrar por Etapa</h4>
            {Object.entries(STAGE_LABELS).map(([stage, label]) => (
              <div key={stage} className="flex items-center gap-2">
                <Checkbox
                  checked={stageFilter.includes(stage as ProspectStage)}
                  onCheckedChange={() => toggleStage(stage as ProspectStage)}
                />
                <label className="text-sm cursor-pointer flex-1" onClick={() => toggleStage(stage as ProspectStage)}>
                  {label}
                </label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* City Filter */}
      <Input
        placeholder="Ciudad..."
        value={cityFilter}
        onChange={(e) => onCityFilterChange(e.target.value)}
        className="w-40"
      />

      {/* Source Filter */}
      <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Fuente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todas</SelectItem>
          <SelectItem value="referral">Referido</SelectItem>
          <SelectItem value="direct">Directo</SelectItem>
          <SelectItem value="social_media">Redes Sociales</SelectItem>
          <SelectItem value="website">Sitio Web</SelectItem>
          <SelectItem value="other">Otro</SelectItem>
        </SelectContent>
      </Select>

      {/* Quality Range Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Calidad: {qualityRange[0]}-{qualityRange[1]}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Índice de Calidad</h4>
            <Slider
              value={qualityRange}
              onValueChange={(value) => onQualityRangeChange(value as [number, number])}
              min={0}
              max={10}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{qualityRange[0]}</span>
              <span>{qualityRange[1]}</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="gap-1"
        >
          <X className="h-3 w-3" />
          Limpiar
        </Button>
      )}
    </div>
  );
};