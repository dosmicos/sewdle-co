import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Material, CreateMaterialData } from '@/types/materials';

export const useMaterials = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchMaterialsQuery = async () => {
    const { data, error } = await supabase
      .rpc('get_materials_with_stock_status');

    if (error) {
      console.error('Error fetching materials:', error);
      throw error;
    }

    console.log('Fetched materials:', data);
    return data || [];
  };

  const { data: materials = [], isLoading: loading, refetch: fetchMaterials } = useQuery({
    queryKey: ['materials'],
    queryFn: fetchMaterialsQuery,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const createMaterialMutation = useMutation({
    mutationFn: async (materialData: CreateMaterialData) => {
      console.log('Creating material with data:', materialData);

      // Generar SKU automáticamente
      const { data: sku, error: skuError } = await supabase
        .rpc('generate_material_sku', { category_name: materialData.category });

      if (skuError) {
        console.error('Error generating SKU:', skuError);
        throw skuError;
      }

      // Crear el material
      const { data: material, error: materialError } = await supabase
        .from('materials')
        .insert([{
          sku: sku,
          name: materialData.name,
          description: materialData.description || null,
          category: materialData.category,
          unit: materialData.unit,
          color: materialData.color || null,
          min_stock_alert: materialData.min_stock_alert,
          current_stock: 0,
          supplier: materialData.supplier || null,
          unit_cost: materialData.unit_cost || null
        }])
        .select()
        .single();

      if (materialError) {
        console.error('Error creating material:', materialError);
        throw materialError;
      }

      console.log('Created material:', material);
      return material;
    },
    onSuccess: (material) => {
      toast({
        title: "¡Material creado exitosamente!",
        description: `El material ${material.name} (${material.sku}) ha sido creado.`,
      });
      // Invalidar y refrescar la query de materiales
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onError: (error) => {
      console.error('Error creating material:', error);
      toast({
        title: "Error al crear material",
        description: "Hubo un problema al crear el material. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const createMaterial = createMaterialMutation.mutateAsync;

  const updateMaterialMutation = useMutation({
    mutationFn: async ({ id, materialData }: { id: string; materialData: Partial<CreateMaterialData> }) => {
      console.log('Updating material:', id, materialData);

      const { data: material, error } = await supabase
        .from('materials')
        .update(materialData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating material:', error);
        throw error;
      }

      console.log('Updated material:', material);
      return material;
    },
    onSuccess: (material) => {
      toast({
        title: "¡Material actualizado exitosamente!",
        description: `El material ${material.name} ha sido actualizado.`,
      });
      // Invalidar y refrescar la query de materiales
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onError: (error) => {
      console.error('Error updating material:', error);
      toast({
        title: "Error al actualizar material",
        description: "Hubo un problema al actualizar el material. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const updateMaterial = async (id: string, materialData: Partial<CreateMaterialData>) => {
    return updateMaterialMutation.mutateAsync({ id, materialData });
  };

  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting material:', id);

      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting material:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "¡Material eliminado exitosamente!",
        description: "El material ha sido eliminado del catálogo.",
      });
      // Invalidar y refrescar la query de materiales
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onError: (error) => {
      console.error('Error deleting material:', error);
      toast({
        title: "Error al eliminar material",
        description: "Hubo un problema al eliminar el material. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const deleteMaterial = deleteMaterialMutation.mutateAsync;

  const updateStockMutation = useMutation({
    mutationFn: async ({ id, newStock }: { id: string; newStock: number }) => {
      console.log('Updating stock for material:', id, 'new stock:', newStock);

      const { data: material, error } = await supabase
        .from('materials')
        .update({ current_stock: newStock })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating stock:', error);
        throw error;
      }

      console.log('Updated material stock:', material);
      return material;
    },
    onSuccess: (material) => {
      toast({
        title: "¡Stock actualizado exitosamente!",
        description: `El stock de ${material.name} ha sido actualizado.`,
      });
      // Invalidar y refrescar la query de materiales
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onError: (error) => {
      console.error('Error updating stock:', error);
      toast({
        title: "Error al actualizar stock",
        description: "Hubo un problema al actualizar el stock. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const updateStock = async (id: string, newStock: number) => {
    return updateStockMutation.mutateAsync({ id, newStock });
  };

  return {
    materials,
    loading: loading || createMaterialMutation.isPending || updateMaterialMutation.isPending || deleteMaterialMutation.isPending || updateStockMutation.isPending,
    fetchMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    updateStock
  };
};
