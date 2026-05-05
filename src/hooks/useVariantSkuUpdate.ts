import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SkuUpdateSafety {
  success: boolean;
  current_sku: string;
  new_sku: string;
  references: {
    order_items: number;
    inventory_replenishment: number;
  };
  pending_deliveries: number;
  warnings: string[];
  can_update: boolean;
  requires_confirmation: boolean;
  error?: string;
  conflicting_sku?: string;
}

export interface SkuUpdateResult {
  success: boolean;
  old_sku: string;
  new_sku: string;
  variant_id: string;
  affected_tables: {
    delivery_items: number;
    order_items: number;
    inventory_replenishment: number;
  };
  message: string;
  error?: string;
  error_code?: string;
}

export const useVariantSkuUpdate = () => {
  const [loading, setLoading] = useState(false);
  const [checkingSupport, setCheckingSupport] = useState(false);

  const checkUpdateSafety = async (variantId: string, newSku: string): Promise<SkuUpdateSafety | null> => {
    setCheckingSupport(true);
    try {
      const { data, error } = await supabase.rpc('check_variant_update_safety', {
        variant_id_param: variantId,
        new_sku_param: newSku
      });

      if (error) {
        console.error('Error checking variant update safety:', error);
        toast.error('Error al verificar la seguridad de la actualización');
        return null;
      }

      return data as unknown as SkuUpdateSafety;
    } catch (error) {
      console.error('Error checking variant update safety:', error);
      toast.error('Error al verificar la seguridad de la actualización');
      return null;
    } finally {
      setCheckingSupport(false);
    }
  };

  const updateVariantSku = async (variantId: string, newSku: string): Promise<SkuUpdateResult | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('update_variant_sku_cascade', {
        variant_id_param: variantId,
        new_sku_param: newSku
      });

      if (error) {
        console.error('Error updating variant SKU:', error);
        toast.error('Error al actualizar el SKU de la variante');
        return null;
      }

      const result = data as unknown as SkuUpdateResult;
      if (!result.success) {
        if (result.error === 'SKU already exists') {
          toast.error(`El SKU "${(result as any).conflicting_sku}" ya existe en otra variante`);
        } else {
          toast.error(result.error || 'Error al actualizar el SKU');
        }
        return result;
      }

      toast.success('SKU actualizado exitosamente');
      return result;
    } catch (error) {
      console.error('Error updating variant SKU:', error);
      toast.error('Error al actualizar el SKU de la variante');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    checkUpdateSafety,
    updateVariantSku,
    loading,
    checkingSupport
  };
};