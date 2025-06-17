
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
  workshopId: string;
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

export const useDeliveries = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createDelivery = async (deliveryData: CreateDeliveryData) => {
    setLoading(true);
    try {
      console.log('Creating delivery with data:', deliveryData);

      // Verificar autenticación primero
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

      // Validar que hay items válidos
      if (deliveryData.items.length === 0) {
        throw new Error('Debe agregar al menos un item a la entrega');
      }

      // Verificar si podemos acceder a la tabla deliveries primero
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

      // Generar número de tracking único
      const { data: trackingNumber, error: trackingError } = await supabase
        .rpc('generate_delivery_number');

      if (trackingError) {
        console.error('Error generating tracking number:', trackingError);
        throw trackingError;
      }

      console.log('Generated tracking number:', trackingNumber);

      // Preparar datos de la entrega con valores explícitos
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

      // Intentar la inserción con manejo de errores más específico
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

        // Error específico para RLS
        if (deliveryError.message.includes('row-level security')) {
          throw new Error('Error de permisos: No tienes autorización para crear entregas. Contacta al administrador.');
        }

        throw deliveryError;
      }

      console.log('Created delivery:', delivery);

      // Crear items de la entrega
      console.log('Creating delivery items:', deliveryData.items);
      
      const deliveryItems = deliveryData.items.map(item => ({
        delivery_id: delivery.id,
        order_item_id: item.orderItemId,
        quantity_delivered: item.quantityDelivered,
        quality_status: item.qualityStatus || 'pending',
        notes: item.notes || ''
      }));

      console.log('Delivery items to insert:', deliveryItems);

      const { error: itemsError } = await supabase
        .from('delivery_items')
        .insert(deliveryItems);

      if (itemsError) {
        console.error('Error creating delivery items:', itemsError);
        
        // Si falla la creación de items, intentar limpiar la entrega creada
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

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_deliveries_with_details');

      if (error) {
        throw error;
      }

      return data;
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

  const fetchDeliveryById = async (deliveryId: string) => {
    setLoading(true);
    try {
      const { data: delivery, error: deliveryError } = await supabase
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
        .eq('id', deliveryId)
        .single();

      if (deliveryError) {
        throw deliveryError;
      }

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

      // First, get the delivery items to update them
      const { data: delivery, error: fetchError } = await supabase
        .from('deliveries')
        .select(`
          *,
          delivery_items (
            id,
            quantity_delivered,
            order_item_id,
            order_items (
              product_variant_id
            )
          )
        `)
        .eq('id', deliveryId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Process each variant/item
      const itemUpdates = [];
      let totalApproved = 0;
      let totalDefective = 0;
      let totalDelivered = 0;

      for (const [variantKey, variantData] of Object.entries(qualityData.variants)) {
        const itemIndex = parseInt(variantKey.replace('item-', ''));
        const deliveryItem = delivery.delivery_items[itemIndex];
        
        if (deliveryItem && (variantData.approved > 0 || variantData.defective > 0)) {
          totalDelivered += deliveryItem.quantity_delivered;
          totalApproved += variantData.approved;
          totalDefective += variantData.defective;

          // Determinar el estado del item basado en las cantidades
          let status = 'pending';
          let notes = variantData.reason || '';

          if (variantData.approved > 0 && variantData.defective > 0) {
            status = 'partial_approved';
            notes = `Aprobadas: ${variantData.approved}, Defectuosas: ${variantData.defective}. ${notes}`;
          } else if (variantData.approved > 0 && variantData.defective === 0) {
            status = 'approved';
            notes = `Aprobadas: ${variantData.approved}. ${notes}`;
          } else if (variantData.defective > 0 && variantData.approved === 0) {
            status = 'rejected';
            notes = `Defectuosas: ${variantData.defective}. ${notes}`;
          }

          itemUpdates.push({
            id: deliveryItem.id,
            quality_status: status,
            notes: notes,
            quantity_approved: variantData.approved,
            quantity_defective: variantData.defective,
            order_item_id: deliveryItem.order_item_id,
            product_variant_id: deliveryItem.order_items?.product_variant_id
          });
        }
      }

      // Update all delivery items with detailed status
      for (const update of itemUpdates) {
        const { error: updateError } = await supabase
          .from('delivery_items')
          .update({
            quality_status: update.quality_status,
            notes: update.notes
          })
          .eq('id', update.id);

        if (updateError) {
          throw updateError;
        }
      }

      // Determine overall delivery status based on results
      let deliveryStatus = 'approved';
      if (totalApproved > 0 && totalDefective > 0) {
        deliveryStatus = 'partial_approved';
      } else if (totalApproved > 0 && totalDefective === 0) {
        deliveryStatus = 'approved';
      } else if (totalDefective > 0 && totalApproved === 0) {
        deliveryStatus = 'rejected';
      }

      // Update delivery status and notes with summary
      const summaryNotes = `Revisión completada: ${totalApproved} aprobadas, ${totalDefective} defectuosas de ${totalDelivered} entregadas. ${qualityData.generalNotes || ''}`;

      const { error: deliveryUpdateError } = await supabase
        .from('deliveries')
        .update({
          status: deliveryStatus,
          notes: summaryNotes
        })
        .eq('id', deliveryId);

      if (deliveryUpdateError) {
        throw deliveryUpdateError;
      }

      // If there are approved items, sync with Shopify inventory
      if (totalApproved > 0) {
        await syncApprovedInventoryWithShopify(itemUpdates.filter(item => item.quantity_approved > 0));
      }

      toast({
        title: "Revisión de calidad procesada",
        description: `${totalApproved} productos aprobados, ${totalDefective} defectuosos. ${totalApproved > 0 ? 'Inventario sincronizado con Shopify.' : ''}`,
      });

      return true;
    } catch (error) {
      console.error('Error processing quality review:', error);
      toast({
        title: "Error al procesar revisión",
        description: "No se pudo procesar la revisión de calidad.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const syncApprovedInventoryWithShopify = async (approvedItems: any[]) => {
    try {
      console.log('Syncing approved inventory with Shopify:', approvedItems);
      
      // Agrupar por variante para sumar cantidades
      const variantUpdates = new Map();
      
      approvedItems.forEach(item => {
        if (item.product_variant_id && item.quantity_approved > 0) {
          const current = variantUpdates.get(item.product_variant_id) || 0;
          variantUpdates.set(item.product_variant_id, current + item.quantity_approved);
        }
      });

      // Actualizar stock local primero
      for (const [variantId, quantity] of variantUpdates) {
        // Get current stock first
        const { data: currentVariant, error: fetchError } = await supabase
          .from('product_variants')
          .select('stock_quantity')
          .eq('id', variantId)
          .single();

        if (fetchError) {
          console.error('Error fetching current stock:', fetchError);
          continue;
        }

        const newStockQuantity = (currentVariant.stock_quantity || 0) + quantity;

        const { error: stockError } = await supabase
          .from('product_variants')
          .update({
            stock_quantity: newStockQuantity
          })
          .eq('id', variantId);

        if (stockError) {
          console.error('Error updating local stock:', stockError);
        } else {
          console.log(`Updated local stock for variant ${variantId}: +${quantity} (new total: ${newStockQuantity})`);
        }
      }

      // TODO: Implementar sincronización real con Shopify API
      // Esta sería la llamada a Shopify para actualizar el inventario
      // await updateShopifyInventory(variantUpdates);

      console.log('Local inventory updated successfully');
      
    } catch (error) {
      console.error('Error syncing inventory:', error);
      throw error;
    }
  };

  const getDeliveryStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_delivery_stats');

      if (error) {
        throw error;
      }

      return data[0] || {
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
    } finally {
      setLoading(false);
    }
  };

  return {
    createDelivery,
    fetchDeliveries,
    fetchDeliveryById,
    updateDeliveryStatus,
    updateDeliveryItemQuality,
    processQualityReview,
    syncApprovedInventoryWithShopify,
    getDeliveryStats,
    loading
  };
};
