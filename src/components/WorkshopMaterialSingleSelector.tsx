import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WorkshopMaterial {
  id: string;
  material_id: string;
  material_name: string;
  material_sku: string;
  material_color: string | null;
  material_unit: string;
  real_balance: number;
}

interface WorkshopMaterialSingleSelectorProps {
  workshopId: string;
  selectedMaterial: string;
  onMaterialSelect: (materialId: string) => void;
  placeholder?: string;
}

const WorkshopMaterialSingleSelector = ({ 
  workshopId, 
  selectedMaterial, 
  onMaterialSelect,
  placeholder = "Seleccionar material..."
}: WorkshopMaterialSingleSelectorProps) => {
  const [availableMaterials, setAvailableMaterials] = useState<WorkshopMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchWorkshopMaterials = async () => {
    if (!workshopId) return;
    
    setLoading(true);
    try {
      // Obtener materiales disponibles en el taller específico usando la función
      const { data: materials, error } = await supabase
        .rpc('get_material_deliveries_with_real_balance');

      if (error) {
        console.error('Error fetching workshop materials:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los materiales del taller",
          variant: "destructive",
        });
        return;
      }

      // Filtrar materiales del taller específico y que tengan balance positivo
      const workshopMaterials = materials?.filter(material => 
        material.workshop_id === workshopId && material.real_balance > 0
      ) || [];

      // Transformar los datos al formato esperado
      const formattedMaterials = workshopMaterials.map(material => ({
        id: material.id,
        material_id: material.material_id,
        material_name: material.material_name,
        material_sku: material.material_sku,
        material_color: material.material_color,
        material_unit: material.material_unit,
        real_balance: material.real_balance,
      }));

      setAvailableMaterials(formattedMaterials);
    } catch (error) {
      console.error('Error fetching workshop materials:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los materiales del taller",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkshopMaterials();
  }, [workshopId]);

  const formatMaterialDisplayName = (material: WorkshopMaterial) => {
    const baseName = `${material.material_name} (${material.material_sku})`;
    return material.material_color ? `${baseName} - ${material.material_color}` : baseName;
  };

  // Filter materials based on search term
  const filteredMaterials = availableMaterials.filter(material => {
    const searchLower = searchTerm.toLowerCase();
    return (
      material.material_name.toLowerCase().includes(searchLower) ||
      material.material_sku.toLowerCase().includes(searchLower) ||
      (material.material_color && material.material_color.toLowerCase().includes(searchLower))
    );
  });

  const selectedMaterialData = availableMaterials.find(m => m.material_id === selectedMaterial);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={loading}
        >
          {selectedMaterialData ? (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">{formatMaterialDisplayName(selectedMaterialData)}</span>
              <Badge variant="outline" className="ml-2 shrink-0">
                {selectedMaterialData.real_balance} {selectedMaterialData.material_unit}
              </Badge>
            </div>
          ) : (
            loading ? "Cargando materiales..." : placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command>
          <CommandInput 
            placeholder="Buscar material..." 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>No se encontraron materiales.</CommandEmpty>
            <ScrollArea className="h-64">
              <CommandGroup>
                {filteredMaterials.map((material) => (
                  <CommandItem
                    key={material.material_id}
                    value={formatMaterialDisplayName(material)}
                    onSelect={() => {
                      onMaterialSelect(material.material_id);
                      setOpen(false);
                      setSearchTerm('');
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedMaterial === material.material_id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col">
                        <span className="font-medium">{formatMaterialDisplayName(material)}</span>
                        {material.material_color && (
                          <span className="text-xs text-muted-foreground">Color: {material.material_color}</span>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-2 shrink-0">
                        {material.real_balance} {material.material_unit}
                      </Badge>
                    </div>
                  </CommandItem>
                ))}
                {filteredMaterials.length === 0 && availableMaterials.length > 0 && (
                  <CommandItem disabled>
                    No hay materiales que coincidan con la búsqueda
                  </CommandItem>
                )}
                {availableMaterials.length === 0 && !loading && (
                  <CommandItem disabled>
                    No hay materiales disponibles en este taller
                  </CommandItem>
                )}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default WorkshopMaterialSingleSelector;