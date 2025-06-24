
import { useState } from 'react';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';

interface MaterialRequirement {
  materialId: string;
  quantity: number;
  unit: string;
}

interface ValidationResult {
  canProceed: boolean;
  sufficientMaterials: MaterialRequirement[];
  insufficientMaterials: MaterialRequirement[];
  workshopStock: Record<string, number>;
}

export const useOrderMaterialValidation = () => {
  const [loading, setLoading] = useState(false);
  const { fetchMaterialDeliveries } = useMaterialDeliveries();

  const validateMaterialsForWorkshop = async (
    workshopId: string,
    materials: MaterialRequirement[]
  ): Promise<ValidationResult> => {
    setLoading(true);
    try {
      console.log('Validating materials for workshop:', workshopId, materials);

      // Obtener stock disponible en el taller usando el nuevo campo real_balance
      const deliveries = await fetchMaterialDeliveries();
      const workshopStock: Record<string, number> = {};
      
      deliveries
        .filter(delivery => delivery.workshop_id === workshopId)
        .forEach(delivery => {
          const materialId = delivery.material_id;
          const available = delivery.real_balance || 0;
          workshopStock[materialId] = (workshopStock[materialId] || 0) + available;
        });

      console.log('Workshop stock:', workshopStock);

      // Clasificar materiales según disponibilidad
      const sufficientMaterials: MaterialRequirement[] = [];
      const insufficientMaterials: MaterialRequirement[] = [];

      materials.forEach(material => {
        const availableStock = workshopStock[material.materialId] || 0;
        
        if (availableStock >= material.quantity) {
          sufficientMaterials.push(material);
        } else {
          insufficientMaterials.push({
            ...material,
            quantity: material.quantity - availableStock // Cantidad faltante
          });
        }
      });

      const canProceed = insufficientMaterials.length === 0;

      console.log('Validation result:', {
        canProceed,
        sufficient: sufficientMaterials.length,
        insufficient: insufficientMaterials.length
      });

      return {
        canProceed,
        sufficientMaterials,
        insufficientMaterials,
        workshopStock
      };
    } catch (error) {
      console.error('Error validating materials:', error);
      return {
        canProceed: false,
        sufficientMaterials: [],
        insufficientMaterials: materials,
        workshopStock: {}
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    validateMaterialsForWorkshop,
    loading
  };
};
