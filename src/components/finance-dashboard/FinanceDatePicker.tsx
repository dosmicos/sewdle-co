import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DatePreset, type FinanceDateRange } from '@/hooks/useFinanceDateRange';
import { cn } from '@/lib/utils';

interface FinanceDatePickerProps {
  dateRange: FinanceDateRange;
}

const presetLabels: Record<DatePreset, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  '7d': '7 días',
  mtd: 'Este mes',
  '30d': '30 días',
  '90d': '90 días',
  custom: 'Personalizado',
};

const FinanceDatePicker: React.FC<FinanceDatePickerProps> = ({ dateRange }) => {
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempStart, setTempStart] = useState<Date | undefined>();

  const handlePresetClick = (preset: DatePreset) => {
    if (preset === 'custom') {
      setCalendarOpen(true);
      return;
    }
    dateRange.setPreset(preset);
    setOpen(false);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    if (!tempStart) {
      setTempStart(date);
    } else {
      const start = date < tempStart ? date : tempStart;
      const end = date > tempStart ? date : tempStart;
      dateRange.setCustomRange(start, end);
      setTempStart(undefined);
      setCalendarOpen(false);
      setOpen(false);
    }
  };

  const displayLabel = dateRange.preset === 'custom'
    ? `${format(dateRange.current.start, 'dd MMM', { locale: es })} - ${format(dateRange.current.end, 'dd MMM', { locale: es })}`
    : presetLabels[dateRange.preset];

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 px-3 gap-2 text-sm font-medium bg-white border-gray-200">
            <CalendarIcon className="h-4 w-4 text-gray-500" />
            {displayLabel}
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {!calendarOpen ? (
            <div className="flex flex-col p-2 min-w-[160px]">
              {(Object.keys(presetLabels) as DatePreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    'text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors',
                    dateRange.preset === preset && 'bg-blue-50 text-blue-600 font-medium'
                  )}
                >
                  {presetLabels[preset]}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-2">
              <p className="text-xs text-gray-500 px-3 mb-2">
                {tempStart ? 'Selecciona fecha final' : 'Selecciona fecha inicial'}
              </p>
              <Calendar
                mode="single"
                selected={tempStart}
                onSelect={handleCalendarSelect}
                locale={es}
                className="pointer-events-auto"
              />
              <div className="flex justify-end px-3 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCalendarOpen(false);
                    setTempStart(undefined);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <Button variant="outline" className="h-9 px-3 text-sm font-medium bg-white border-gray-200 text-gray-600">
        Período anterior
      </Button>
    </div>
  );
};

export default FinanceDatePicker;
