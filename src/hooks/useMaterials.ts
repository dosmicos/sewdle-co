
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Material {
  id: string;
  sku: string;
  name: string;
  description?: string;
  unit: string;
  color?: string;
  category: string;
  min_stock_alert: number;
  current_stock: number;
  supplier?: string;
  unit_cost?: number;
  image_url?: string;
  stock_status?: string;
  created_at: string;
}

interface CreateMaterialData {
  name: string;
  description?: string;
  category: string;
  unit: string;
  color?: string;
  min_stock_alert: number;
  supplier?: string;
  unit_cost?: number;
}

export const useMaterials = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_materials_with_stock_status');

      if (error) {
        console.error('Error fetching materials:', error);
        throw error;
      }

      console.log('Fetched materials:', data);
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast({
        title: "Error al cargar materiales",
        description: "No se pudieron cargar los materiales.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createMaterial = async (materialData: CreateMaterialData) => {
    setLoading(true);
    try {
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

      toast({
        title: "¡Material creado exitosamente!",
        description: `El material ${material.name} (${material.sku}) ha sido creado.`,
      });

      // Refrescar la lista
      await fetchMaterials();

      return material;
    } catch (error) {
      console.error('Error creating material:', error);
      toast({
        title: "Error al crear material",
        description: "Hubo un problema al crear el material. Por favor intenta de nuevo.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateMaterial = async (id: string, materialData: Partial<CreateMaterialData>) => {
    setLoading(true);
    try {
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

      toast({
        title: "¡Material actualizado exitosamente!",
        description: `El material ${material.name} ha sido actualizado.`,
      });

      // Refrescar la lista
      await fetchMaterials();

      return material;
    } catch (error) {
      console.error('Error updating material:', error);
      toast({
        title: "Error al actualizar material",
        description: "Hubo un problema al actualizar el material. Por favor intenta de nuevo.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteMaterial = async (id: string) => {
    setLoading(true);
    try {
      console.log('Deleting material:', id);

      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting material:', error);
        throw error;
      }

      toast({
        title: "¡Material eliminado exitosamente!",
        description: "El material ha sido eliminado del catálogo.",
      });

      // Refrescar la lista
      await fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      toast({
        title: "Error al eliminar material",
        description: "Hubo un problema al eliminar el material. Por favor intenta de nuevo.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateStock = async (id: string, newStock: number) => {
    setLoading(true);
    try {
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

      toast({
        title: "¡Stock actualizado exitosamente!",
        description: `El stock de ${material.name} ha sido actualizado.`,
      });

      // Refrescar la lista
      await fetchMaterials();

      return material;
    } catch (error) {
      console.error('Error updating stock:', error);
      toast({
        title: "Error al actualizar stock",
        description: "Hubo un problema al actualizar el stock. Por favor intenta de nuevo.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  return {
    materials,
    loading,
    fetchMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    updateStock
  };
};
