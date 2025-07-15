import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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

  return (
    <Select
      value={selectedMaterial}
      onValueChange={onMaterialSelect}
      disabled={loading}
    >
      <SelectTrigger>
        <SelectValue placeholder={loading ? "Cargando materiales..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {availableMaterials.map((material) => (
          <SelectItem key={material.material_id} value={material.material_id}>
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col">
                <span className="font-medium">{formatMaterialDisplayName(material)}</span>
                {material.material_color && (
                  <span className="text-xs text-gray-500">Color: {material.material_color}</span>
                )}
              </div>
              <Badge variant="outline" className="ml-2">
                {material.real_balance} {material.material_unit}
              </Badge>
            </div>
          </SelectItem>
        ))}
        {availableMaterials.length === 0 && !loading && (
          <SelectItem value="no-materials" disabled>
            No hay materiales disponibles en este taller
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
};

export default WorkshopMaterialSingleSelector;