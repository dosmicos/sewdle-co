import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface Quarter {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
}

interface QuarterSelectorProps {
  selectedQuarter?: string;
  onQuarterChange?: (quarterId: string) => void;
  showNavigation?: boolean;
}

export const QuarterSelector: React.FC<QuarterSelectorProps> = ({
  selectedQuarter,
  onQuarterChange,
  showNavigation = true
}) => {
  // Generar trimestres (últimos 2 años + próximo año)
  const generateQuarters = (): Quarter[] => {
    const quarters: Quarter[] = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
    
    // Generar trimestres desde 2023 hasta 2025
    for (let year = 2023; year <= 2025; year++) {
      for (let q = 1; q <= 4; q++) {
        const startMonth = (q - 1) * 3;
        const endMonth = startMonth + 2;
        
        const startDate = new Date(year, startMonth, 1);
        const endDate = new Date(year, endMonth + 1, 0); // Último día del mes
        
        const isCurrent = year === currentYear && q === currentQuarter;
        
        quarters.push({
          id: `${year}-Q${q}`,
          name: `Q${q} ${year}`,
          startDate,
          endDate,
          isCurrent
        });
      }
    }
    
    return quarters.reverse(); // Más recientes primero
  };

  const quarters = generateQuarters();
  const currentQuarter = quarters.find(q => q.isCurrent);
  const currentSelectedQuarter = selectedQuarter || currentQuarter?.id || quarters[0]?.id;
  
  const selectedQuarterObj = quarters.find(q => q.id === currentSelectedQuarter);
  const currentIndex = quarters.findIndex(q => q.id === currentSelectedQuarter);

  const handlePrevious = () => {
    if (currentIndex < quarters.length - 1) {
      const nextQuarter = quarters[currentIndex + 1];
      onQuarterChange?.(nextQuarter.id);
    }
  };

  const handleNext = () => {
    if (currentIndex > 0) {
      const prevQuarter = quarters[currentIndex - 1];
      onQuarterChange?.(prevQuarter.id);
    }
  };

  const formatDateRange = (quarter: Quarter) => {
    const startStr = quarter.startDate.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short' 
    });
    const endStr = quarter.endDate.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
    return `${startStr} - ${endStr}`;
  };

  const getDaysRemaining = (quarter: Quarter) => {
    const today = new Date();
    const diffTime = quarter.endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  return (
    <div className="flex items-center gap-4">
      {/* Navigation Buttons */}
      {showNavigation && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentIndex >= quarters.length - 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={currentIndex <= 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Quarter Selector */}
      <Select value={currentSelectedQuarter} onValueChange={onQuarterChange}>
        <SelectTrigger className="w-48">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <SelectValue placeholder="Seleccionar trimestre" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {quarters.map((quarter) => (
            <SelectItem key={quarter.id} value={quarter.id}>
              <div className="flex items-center justify-between w-full">
                <span className={quarter.isCurrent ? 'font-semibold' : ''}>
                  {quarter.name}
                  {quarter.isCurrent && ' (Actual)'}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quarter Info */}
      {selectedQuarterObj && (
        <div className="text-sm text-muted-foreground">
          <div>{formatDateRange(selectedQuarterObj)}</div>
          {selectedQuarterObj.isCurrent && (
            <div className="text-xs">
              {getDaysRemaining(selectedQuarterObj)} días restantes
            </div>
          )}
        </div>
      )}
    </div>
  );
};