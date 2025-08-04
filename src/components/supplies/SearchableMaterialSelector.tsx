import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Material {
  id: string;
  name: string;
  sku: string;
  color?: string;
  category?: string;
  unit: string;
  current_stock: number;
  supplier?: string;
}

interface SearchableMaterialSelectorProps {
  materials: Material[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SearchableMaterialSelector = ({ 
  materials, 
  value, 
  onValueChange, 
  placeholder = "Seleccionar material...",
  disabled = false 
}: SearchableMaterialSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedMaterial = materials.find(m => m.id === value);

  // Helper function to format material display name with color
  const formatMaterialDisplayName = (material: Material) => {
    const baseName = `${material.name} (${material.sku})`;
    return material.color ? `${baseName} - ${material.color}` : baseName;
  };

  // Filter materials based on search term
  const filteredMaterials = materials.filter(material => {
    const searchableText = `${material.name} ${material.sku} ${material.color || ''} ${material.category || ''}`.toLowerCase();
    return searchableText.includes(searchTerm.toLowerCase());
  });

  // Group materials by category for better organization
  const groupedMaterials = filteredMaterials.reduce((groups, material) => {
    const category = material.category || 'Sin categoría';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(material);
    return groups;
  }, {} as Record<string, Material[]>);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-[2.5rem] p-3"
          disabled={disabled}
        >
          <div className="flex items-center flex-1 min-w-0">
            <Package className="mr-2 h-4 w-4 shrink-0" />
            {selectedMaterial ? (
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="font-medium truncate">
                  {formatMaterialDisplayName(selectedMaterial)}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Stock: {selectedMaterial.current_stock} {selectedMaterial.unit}</span>
                  {selectedMaterial.color && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {selectedMaterial.color}
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 z-50" side="bottom" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command className="w-full">
          <CommandInput 
            placeholder="Buscar por nombre, SKU, color..." 
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="h-12"
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No se encontraron materiales.</CommandEmpty>
            {Object.entries(groupedMaterials).map(([category, categoryMaterials]) => (
              <CommandGroup key={category} heading={category}>
                {categoryMaterials.map((material) => (
                  <CommandItem
                    key={material.id}
                    value={`${material.name} ${material.sku} ${material.color || ''}`}
                    onSelect={() => {
                      onValueChange(material.id);
                      setOpen(false);
                      setSearchTerm('');
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center flex-1 min-w-0">
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            value === material.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium truncate">
                            {formatMaterialDisplayName(material)}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Stock: {material.current_stock} {material.unit}</span>
                            {material.supplier && (
                              <span>• {material.supplier}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {material.color && (
                        <Badge variant="outline" className="ml-2 text-xs px-2 py-0 shrink-0">
                          {material.color}
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SearchableMaterialSelector;