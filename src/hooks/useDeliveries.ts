import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useInventorySync } from './useInventorySync';

export const useDeliveries = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { syncApprovedItemsToShopify } = useInventorySync();

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      toast({
        title: "Error fetching deliveries",
        description: error instanceof Error ? error.message : "Failed to fetch deliveries",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryById = async (deliveryId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          delivery_items (
            *,
            order_items (
              product_variant_id,
              product_variants (
                sku_variant
              )
            )
          )
        `)
        .eq('id', deliveryId)
        .single();
  
      if (error) {
        throw error;
      }
  
      return data;
    } catch (error) {
      console.error('Error fetching delivery by ID:', error);
      toast({
        title: "Error fetching delivery",
        description: error instanceof Error ? error.message : "Failed to fetch delivery",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getDeliveryStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deliveries_stats')
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return data || {
        total_deliveries: 0,
        pending_deliveries: 0,
        in_quality_deliveries: 0,
        approved_deliveries: 0,
        rejected_deliveries: 0
      };
    } catch (error) {
      console.error('Error fetching delivery stats:', error);
      toast({
        title: "Error fetching stats",
        description: error instanceof Error ? error.message : "Failed to fetch delivery stats",
        variant: "destructive",
      });
      return {
        total_deliveries: 0,
        pending_deliveries: 0,
        in_quality_deliveries: 0,
        approved_deliveries: 0,
        rejected_deliveries: 0
      };
    } finally {
      setLoading(false);
    }
  };

  const processQualityReview = async (deliveryId: string, itemsReview: any[]) => {
    setLoading(true);
    try {
      console.log('Processing quality review for delivery:', deliveryId);
      
      // Actualizar items con resultados de calidad
      for (const item of itemsReview) {
        const { error } = await supabase
          .from('delivery_items')
          .update({
            quantity_approved: item.quantityApproved,
            quantity_defective: item.quantityDefective,
            quality_status: item.status,
            quality_notes: item.notes
          })
          .eq('id', item.id);

        if (error) {
          throw error;
        }
      }

      // Obtener detalles completos de la entrega para sincronización
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('deliveries')
        .select(`
          *,
          order_id,
          delivery_items (
            *,
            order_items (
              product_variant_id,
              product_variants (
                sku_variant
              )
            )
          )
        `)
        .eq('id', deliveryId)
        .single();

      if (deliveryError) {
        throw deliveryError;
      }

      // Preparar datos para sincronización con Shopify
      const approvedItems = deliveryData.delivery_items
        ?.filter((item: any) => item.quantity_approved > 0)
        .map((item: any) => ({
          variantId: item.order_items?.product_variant_id || '',
          skuVariant: item.order_items?.product_variants?.sku_variant || '',
          quantityApproved: item.quantity_approved
        }))
        .filter((item: any) => item.skuVariant) || [];

      // Intentar sincronización automática con Shopify si hay items aprobados
      if (approvedItems.length > 0) {
        try {
          await syncApprovedItemsToShopify({
            deliveryId,
            approvedItems
          });
          
          toast({
            title: "Revisión completada",
            description: `Calidad procesada y inventario sincronizado con Shopify para ${approvedItems.length} items`,
          });
        } catch (syncError) {
          console.error('Error in Shopify sync:', syncError);
          toast({
            title: "Revisión completada",
            description: "Calidad procesada correctamente. Error en sincronización con Shopify, se puede reintentar manualmente.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Revisión completada",
          description: "Los resultados de calidad han sido guardados",
        });
      }

      return true;

    } catch (error) {
      console.error('Error processing quality review:', error);
      toast({
        title: "Error en revisión",
        description: error instanceof Error ? error.message : "No se pudo procesar la revisión de calidad",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteDelivery = async (deliveryId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('deliveries')
        .delete()
        .eq('id', deliveryId);

      if (error) {
        throw error;
      }

      toast({
        title: "Entrega eliminada",
        description: "La entrega ha sido eliminada exitosamente",
      });

      return true;
    } catch (error) {
      console.error('Error deleting delivery:', error);
      toast({
        title: "Error al eliminar",
        description: error instanceof Error ? error.message : "No se pudo eliminar la entrega",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    fetchDeliveries,
    fetchDeliveryById,
    getDeliveryStats,
    processQualityReview,
    deleteDelivery,
    loading
  };
};
