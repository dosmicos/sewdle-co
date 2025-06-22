
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DeliveryItem {
  orderItemId: string;
  quantityDelivered: number;
  qualityStatus?: 'pending' | 'approved' | 'rejected' | 'rework_needed';
  notes?: string;
}

export interface CreateDeliveryData {
  orderId: string;
  workshopId: string | null;
  deliveryDate?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  notes?: string;
  items: DeliveryItem[];
}

export interface UpdateDeliveryStatusData {
  deliveryId: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'in_quality' | 'approved' | 'rejected' | 'returned';
  notes?: string;
}

export interface QualityReviewData {
  variants: Record<string, { approved: number; defective: number; reason: string }>;
  evidenceFiles: FileList | null;
  generalNotes: string;
}

interface ItemUpdateData {
  id: string;
  quantity_approved: number;
  quantity_defective: number;
  quality_notes: string;
  order_item_id: string;
  product_variant_id: string | null;
}

interface DeliveryStats {
  approved: number;
  defective: number;
}

export const useDeliveries = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createDelivery = async (deliveryData: CreateDeliveryData) => {
    setLoading(true);
    try {
      console.log('Creating delivery with data:', deliveryData);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Error de autenticación');
      }

      if (!session?.user) {
        console.error('No user session found');
        throw new Error('Usuario no autenticado');
      }

      console.log('User authenticated:', session.user.id);

      if (deliveryData.items.length === 0) {
        throw new Error('Debe agregar al menos un item a la entrega');
      }

      console.log('Testing deliveries table access...');
      const { data: testAccess, error: accessError } = await supabase
        .from('deliveries')
        .select('id')
        .limit(1);

      if (accessError) {
        console.error('Cannot access deliveries table:', accessError);
        throw new Error('No tienes permisos para acceder a las entregas');
      }

      console.log('Deliveries table access confirmed');

      const { data: trackingNumber, error: trackingError } = await supabase
        .rpc('generate_delivery_number');

      if (trackingError) {
        console.error('Error generating tracking number:', trackingError);
        throw trackingError;
      }

      console.log('Generated tracking number:', trackingNumber);

      const deliveryInsertData = {
        tracking_number: trackingNumber,
        order_id: deliveryData.orderId,
        workshop_id: deliveryData.workshopId,
        delivery_date: deliveryData.deliveryDate || new Date().toISOString().split('T')[0],
        delivered_by: session.user.id,
        recipient_name: deliveryData.recipientName || '',
        recipient_phone: deliveryData.recipientPhone || '',
        recipient_address: deliveryData.recipientAddress || '',
        notes: deliveryData.notes || '',
        status: 'pending'
      };

      console.log('Inserting delivery with data:', deliveryInsertData);

      const { data: delivery, error: deliveryError } = await supabase
        .from('deliveries')
        .insert([deliveryInsertData])
        .select()
        .single();

      if (deliveryError) {
        console.error('Error creating delivery:', deliveryError);
        console.error('Delivery error details:', {
          message: deliveryError.message,
          details: deliveryError.details,
          hint: deliveryError.hint,
          code: deliveryError.code
        });

        if (deliveryError.message.includes('row-level security')) {
          throw new Error('Error de permisos: No tienes autorización para crear entregas. Contacta al administrador.');
        }

        throw deliveryError;
      }

      console.log('Created delivery:', delivery);

      console.log('Creating delivery items:', deliveryData.items);
      
      const deliveryItems = deliveryData.items.map(item => ({
        delivery_id: delivery.id,
        order_item_id: item.orderItemId,
        quantity_delivered: item.quantityDelivered,
        quality_status: item.qualityStatus || 'pending',
        notes: item.notes || '',
        quantity_approved: 0,
        quantity_defective: 0
      }));

      console.log('Delivery items to insert:', deliveryItems);

      const { error: itemsError } = await supabase
        .from('delivery_items')
        .insert(deliveryItems);

      if (itemsError) {
        console.error('Error creating delivery items:', itemsError);
        
        await supabase.from('deliveries').delete().eq('id', delivery.id);
        
        if (itemsError.message.includes('row-level security')) {
          throw new Error('Error de permisos: No tienes autorización para crear items de entrega. Contacta al administrador.');
        }
        
        throw itemsError;
      }

      console.log('Successfully created delivery items');

      toast({
        title: "¡Entrega creada exitosamente!",
        description: `La entrega ${trackingNumber} ha sido registrada correctamente.`,
      });

      return delivery;

    } catch (error) {
      console.error('Error creating delivery:', error);
      toast({
        title: "Error al crear la entrega",
        description: error instanceof Error ? error.message : "Hubo un problema al registrar la entrega. Por favor intenta de nuevo.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveries = async (forceRefresh = false) => {
    setLoading(true);
    try {
      console.log('Fetching deliveries with force refresh:', forceRefresh);
      
      // Use the new function that includes approved and defective quantities
      const { data, error } = await supabase.rpc('get_deliveries_with_details_v2');

      if (error) {
        console.error('Error fetching deliveries:', error);
        throw error;
      }

      console.log('Fetched deliveries data:', data);
      return data || [];
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      toast({
        title: "Error al cargar las entregas",
        description: "No se pudieron cargar las entregas.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryById = async (deliveryId: string, forceRefresh = false) => {
    setLoading(true);
    try {
      console.log('Fetching delivery by ID:', deliveryId, 'Force refresh:', forceRefresh);
      
      let query = supabase
        .from('deliveries')
        .select(`
          *,
          orders (
            order_number,
            notes
          ),
          workshops (
            name,
            address
          ),
          delivery_items (
            *,
            order_items (
              *,
              product_variants (
                *,
                products (*)
              )
            )
          )
        `)
        .eq('id', deliveryId);

      const { data: delivery, error: deliveryError } = await query.single();

      if (deliveryError) {
        console.error('Error fetching delivery:', deliveryError);
        throw deliveryError;
      }

      console.log('Fetched delivery data:', delivery);
      return delivery;
    } catch (error) {
      console.error('Error fetching delivery:', error);
      toast({
        title: "Error al cargar la entrega",
        description: "No se pudo cargar los detalles de la entrega.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateDeliveryStatus = async (data: UpdateDeliveryStatusData) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({
          status: data.status,
          notes: data.notes
        })
        .eq('id', data.deliveryId);

      if (error) {
        throw error;
      }

      toast({
        title: "Estado actualizado",
        description: "El estado de la entrega ha sido actualizado correctamente.",
      });

      return true;
    } catch (error) {
      console.error('Error updating delivery status:', error);
      toast({
        title: "Error al actualizar estado",
        description: "No se pudo actualizar el estado de la entrega.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateDeliveryItemQuality = async (itemId: string, qualityStatus: string, notes?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('delivery_items')
        .update({
          quality_status: qualityStatus,
          notes: notes
        })
        .eq('id', itemId);

      if (error) {
        throw error;
      }

      toast({
        title: "Control de calidad actualizado",
        description: "El estado de calidad del item ha sido actualizado.",
      });

      return true;
    } catch (error) {
      console.error('Error updating item quality:', error);
      toast({
        title: "Error al actualizar calidad",
        description: "No se pudo actualizar el estado de calidad del item.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const processQualityReview = async (deliveryId: string, qualityData: QualityReviewData) => {
    setLoading(true);
    try {
      console.log('Processing quality review for delivery:', deliveryId);
      console.log('Quality data:', qualityData);

      const delivery = await fetchDeliveryById(deliveryId, true);

      if (!delivery) {
        throw new Error('No se encontró la entrega');
      }

      if (!delivery.delivery_items || !Array.isArray(delivery.delivery_items)) {
        throw new Error('No se encontraron items en la entrega');
      }

      console.log('Current delivery data:', delivery);

      const itemUpdates: ItemUpdateData[] = [];
      let totalApproved = 0;
      let totalDefective = 0;

      for (const [variantKey, variantData] of Object.entries(qualityData.variants)) {
        if (!variantData || typeof variantData !== 'object') {
          console.log(`Skipping invalid variant data for ${variantKey}`);
          continue;
        }

        const itemIndex = parseInt(variantKey.replace('item-', ''));
        
        if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= delivery.delivery_items.length) {
          console.log(`Invalid item index ${itemIndex} for variant ${variantKey}`);
          continue;
        }

        const deliveryItem = delivery.delivery_items[itemIndex];
        
        if (!deliveryItem) {
          console.log(`No delivery item found at index ${itemIndex}`);
          continue;
        }

        const approved = Number(variantData.approved) || 0;
        const defective = Number(variantData.defective) || 0;
        
        if (approved > 0 || defective > 0) {
          totalApproved += approved;
          totalDefective += defective;

          console.log(`Item ${itemIndex}: Approved: ${approved}, Defective: ${defective}`);

          const itemUpdate: ItemUpdateData = {
            id: deliveryItem.id,
            quantity_approved: approved,
            quantity_defective: defective,
            quality_notes: variantData.reason || '',
            order_item_id: deliveryItem.order_item_id,
            product_variant_id: deliveryItem.order_items?.product_variant_id || null
          };

          itemUpdates.push(itemUpdate);
        }
      }

      console.log('Totals - Approved:', totalApproved, 'Defective:', totalDefective);

      if (itemUpdates.length === 0) {
        throw new Error('No se encontraron elementos válidos para procesar');
      }

      // Update delivery items with the new structured fields
      for (const update of itemUpdates) {
        if (!update.id) {
          console.error('Missing delivery item ID:', update);
          continue;
        }

        console.log('Updating delivery item:', update.id, 'with approved:', update.quantity_approved, 'defective:', update.quantity_defective);
        
        const { error: updateError } = await supabase
          .from('delivery_items')
          .update({
            quantity_approved: update.quantity_approved,
            quantity_defective: update.quantity_defective,
            quality_notes: update.quality_notes
          })
          .eq('id', update.id);

        if (updateError) {
          console.error('Error updating delivery item:', update.id, updateError);
          throw new Error(`Error al actualizar item de entrega: ${updateError.message}`);
        }
        
        console.log('Successfully updated delivery item:', update.id);
      }

      // The delivery status will be automatically updated by the database trigger

      toast({
        title: "Revisión de calidad procesada",
        description: `${totalApproved} productos aprobados, ${totalDefective} devueltos.`,
      });

      return true;
    } catch (error) {
      console.error('Error processing quality review:', error);
      toast({
        title: "Error al procesar revisión",
        description: error instanceof Error ? error.message : "No se pudo procesar la revisión de calidad.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getDeliveryStats = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_delivery_stats');

      if (error) {
        console.error('Error fetching delivery stats:', error);
        throw error;
      }

      return data?.[0] || {
        total_deliveries: 0,
        pending_deliveries: 0,
        in_quality_deliveries: 0,
        approved_deliveries: 0,
        rejected_deliveries: 0
      };
    } catch (error) {
      console.error('Error fetching delivery stats:', error);
      return {
        total_deliveries: 0,
        pending_deliveries: 0,
        in_quality_deliveries: 0,
        approved_deliveries: 0,
        rejected_deliveries: 0
      };
    }
  };

  const deleteDelivery = async (deliveryId: string) => {
    setLoading(true);
    try {
      // First delete delivery items
      const { error: itemsError } = await supabase
        .from('delivery_items')
        .delete()
        .eq('delivery_id', deliveryId);

      if (itemsError) {
        throw itemsError;
      }

      // Then delete the delivery
      const { error: deliveryError } = await supabase
        .from('deliveries')
        .delete()
        .eq('id', deliveryId);

      if (deliveryError) {
        throw deliveryError;
      }

      toast({
        title: "Entrega eliminada",
        description: "La entrega ha sido eliminada correctamente.",
      });

      return true;
    } catch (error) {
      console.error('Error deleting delivery:', error);
      toast({
        title: "Error al eliminar entrega",
        description: "No se pudo eliminar la entrega.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Simplified function that now reads directly from database fields
  const parseDeliveryStats = (delivery: any): DeliveryStats => {
    // Use the aggregated data from the new database function
    if (delivery.total_approved !== undefined && delivery.total_defective !== undefined) {
      return {
        approved: delivery.total_approved || 0,
        defective: delivery.total_defective || 0
      };
    }

    // Fallback for individual delivery items (when viewing delivery details)
    if (delivery.delivery_items && Array.isArray(delivery.delivery_items)) {
      let approved = 0;
      let defective = 0;
      
      delivery.delivery_items.forEach((item: any) => {
        approved += item.quantity_approved || 0;
        defective += item.quantity_defective || 0;
      });
      
      return { approved, defective };
    }

    return { approved: 0, defective: 0 };
  };

  return {
    createDelivery,
    fetchDeliveries,
    fetchDeliveryById,
    updateDeliveryStatus,
    updateDeliveryItemQuality,
    processQualityReview,
    getDeliveryStats,
    deleteDelivery,
    parseDeliveryStats,
    loading
  };
};
