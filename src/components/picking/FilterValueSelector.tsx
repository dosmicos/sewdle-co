import React, { useState } from 'react';
import { FilterOption } from '@/types/picking';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface FilterValueSelectorProps {
  filter: FilterOption;
  currentValue: string | string[];
  onApply: (value: string | string[]) => void;
  onCancel: () => void;
}

export const FilterValueSelector = ({ 
  filter, 
  currentValue, 
  onApply, 
  onCancel 
}: FilterValueSelectorProps) => {
  console.log('🎯 FilterValueSelector rendered:', { filter, currentValue });
  
  const [selectedValues, setSelectedValues] = useState<string[]>(() => {
    if (Array.isArray(currentValue)) {
      return currentValue;
    }
    if (typeof currentValue === 'string' && currentValue) {
      return [currentValue];
    }
    return [];
  });

  // Validación temprana
  if (!filter) {
    console.error('❌ Filter is null or undefined');
    return null;
  }
  
  if (!filter.options || filter.options.length === 0) {
    console.error('❌ Filter has no options:', filter);
    return (
      <Dialog open onOpenChange={onCancel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">
              No se pudieron cargar las opciones del filtro.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={onCancel}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const handleApply = () => {
    if (filter.type === 'multiselect') {
      onApply(selectedValues);
    } else {
      onApply(selectedValues[0] || '');
    }
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{filter.label}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filter.type === 'multiselect' && filter.options?.map((option) => (
            <div key={option.value} className="flex items-center space-x-2 py-2 px-3 hover:bg-muted rounded-md">
              <Checkbox
                id={option.value}
                checked={selectedValues.includes(option.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedValues([...selectedValues, option.value]);
                  } else {
                    setSelectedValues(selectedValues.filter(v => v !== option.value));
                  }
                }}
              />
              <label 
                htmlFor={option.value} 
                className="text-sm cursor-pointer flex-1"
              >
                {option.label}
              </label>
            </div>
          ))}
          
          {filter.type === 'select' && filter.options?.map((option) => (
            <Button
              key={option.value}
              variant={selectedValues.includes(option.value) ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={() => setSelectedValues([option.value])}
            >
              {option.label}
            </Button>
          ))}
        </div>
        
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleApply} 
            disabled={filter.type === 'multiselect' && selectedValues.length === 0}
          >
            Aplicar filtro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
