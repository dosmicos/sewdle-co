
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
  quality_status: string;
  notes: string;
  quantity_approved: number;
  quantity_defective: number;
  order_item_id: string;
  product_variant_id: string | null;
}

interface OrderTotals {
  ordered: number;
  delivered: number;
  approved: number;
  defective: number;
  pending: number;
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
        notes: item.notes || ''
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
      
      const query = forceRefresh 
        ? supabase.rpc('get_deliveries_with_details', { _cache_bust: Date.now() })
        : supabase.rpc('get_deliveries_with_details');

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching deliveries:', error);
        throw error;
      }

      console.log('Fetched deliveries data:', data);
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

      const { data: delivery, error: deliveryError } = forceRefresh 
        ? await query.single()
        : await query.single();

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
      let totalDelivered = 0;

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
          totalDelivered += deliveryItem.quantity_delivered || 0;
          totalApproved += approved;
          totalDefective += defective;

          console.log(`Item ${itemIndex}: Approved: ${approved}, Defective: ${defective}`);

          let status = 'approved';
          let notes = variantData.reason || '';

          if (approved > 0 && defective > 0) {
            status = 'approved';
            notes = `Aprobadas: ${approved}, Defectuosas: ${defective}. ${notes}`;
          } else if (approved > 0 && defective === 0) {
            status = 'approved';
            notes = `Aprobadas: ${approved}. ${notes}`;
          } else if (defective > 0 && approved === 0) {
            status = 'rejected';
            notes = `Defectuosas: ${defective}. ${notes}`;
          }

          const itemUpdate: ItemUpdateData = {
            id: deliveryItem.id,
            quality_status: status,
            notes: notes,
            quantity_approved: approved,
            quantity_defective: defective,
            order_item_id: deliveryItem.order_item_id,
            product_variant_id: deliveryItem.order_items?.product_variant_id || null
          };

          itemUpdates.push(itemUpdate);
        }
      }

      console.log('Totals - Delivered:', totalDelivered, 'Approved:', totalApproved, 'Defective:', totalDefective);

      if (itemUpdates.length === 0) {
        throw new Error('No se encontraron elementos válidos para procesar');
      }

      // Update delivery items
      for (const update of itemUpdates) {
        if (!update.id) {
          console.error('Missing delivery item ID:', update);
          continue;
        }

        console.log('Updating delivery item:', update.id, 'with status:', update.quality_status);
        
        const { error: updateError } = await supabase
          .from('delivery_items')
          .update({
            quality_status: update.quality_status,
            notes: update.notes
          })
          .eq('id', update.id);

        if (updateError) {
          console.error('Error updating delivery item:', update.id, updateError);
          throw new Error(`Error al actualizar item de entrega: ${updateError.message}`);
        }
        
        console.log('Successfully updated delivery item:', update.id);
      }

      // Determine delivery status
      let deliveryStatus = 'approved';
      let deliveryNotes = '';

      if (totalDefective > 0 && totalApproved === 0) {
        deliveryStatus = 'rejected';
        deliveryNotes = `Entrega devuelta: ${totalDefective} unidades defectuosas de ${totalDelivered} entregadas. ${qualityData.generalNotes || ''}`;
      } else {
        deliveryStatus = 'approved';
        deliveryNotes = `Entrega aprobada: ${totalApproved} aprobadas${totalDefective > 0 ? `, ${totalDefective} devueltas` : ''} de ${totalDelivered} entregadas. ${qualityData.generalNotes || ''}`;
      }

      console.log('Final delivery status:', deliveryStatus);
      console.log('Delivery notes:', deliveryNotes);

      const { error: deliveryUpdateError } = await supabase
        .from('deliveries')
        .update({
          status: deliveryStatus,
          notes: deliveryNotes
        })
        .eq('id', deliveryId);

      if (deliveryUpdateError) {
        console.error('Error updating delivery status:', deliveryUpdateError);
        throw new Error(`Error al actualizar estado de entrega: ${deliveryUpdateError.message}`);
      }

      console.log('Successfully updated delivery status to:', deliveryStatus);

      // Sync inventory if items were approved
      if (totalApproved > 0) {
        try {
          await syncApprovedInventoryWithShopify(itemUpdates.filter(item => item.quantity_approved > 0));
        } catch (syncError) {
          console.error('Error syncing inventory:', syncError);
        }
      }

      // Update order status - FORZAR actualización inmediata
      try {
        console.log('About to update order status for order:', delivery.order_id);
        await updateOrderStatusBasedOnDeliveries(delivery.order_id);
        
        // Force manual order status update
        console.log('Triggering manual order status update');
        await forceOrderStatusUpdate(delivery.order_id);

        // Check if order is completed and update ALL deliveries of that order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('status')
          .eq('id', delivery.order_id)
          .single();

        if (!orderError && orderData && orderData.status === 'completed') {
          console.log('Order is completed, updating ALL deliveries to approved');
          
          // Update ALL deliveries from this order to approved status
          const { error: allDeliveriesUpdateError } = await supabase
            .from('deliveries')
            .update({
              status: 'approved'
            })
            .eq('order_id', delivery.order_id);

          if (allDeliveriesUpdateError) {
            console.error('Error updating all deliveries to approved:', allDeliveriesUpdateError);
          } else {
            console.log('Successfully updated all deliveries to approved status');
          }
        }

      } catch (orderError) {
        console.error('Error updating order status:', orderError);
      }

      toast({
        title: "Revisión de calidad procesada",
        description: `${totalApproved} productos aprobados, ${totalDefective} devueltos. ${totalApproved > 0 ? 'Inventario sincronizado.' : ''}`,
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

  const checkAndUpdateDeliveryOnOrderCompletion = async (deliveryId: string, orderId: string) => {
    try {
      console.log('Checking if order is completed to update delivery status');
      
      // Get the current order status
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('Error fetching order status:', orderError);
        return;
      }

      console.log('Current order status:', orderData.status);

      // If order is completed, update delivery to approved
      if (orderData.status === 'completed') {
        console.log('Order is completed, updating delivery to approved');
        
        const { error: deliveryUpdateError } = await supabase
          .from('deliveries')
          .update({
            status: 'approved'
          })
          .eq('id', deliveryId);

        if (deliveryUpdateError) {
          console.error('Error updating delivery to approved:', deliveryUpdateError);
        } else {
          console.log('Successfully updated delivery to approved status');
          
          // Show success toast
          toast({
            title: "Estado actualizado",
            description: "La entrega ha sido marcada como aprobada porque la orden se completó.",
          });
        }
      }
    } catch (error) {
      console.error('Error in checkAndUpdateDeliveryOnOrderCompletion:', error);
    }
  };

  const forceOrderStatusUpdate = async (orderId: string) => {
    try {
      console.log('Force updating order status for:', orderId);
      
      // Get order stats directly
      const { data: orderStats, error: statsError } = await supabase
        .rpc('get_order_delivery_stats', { order_id_param: orderId });

      if (statsError) {
        console.error('Error getting order stats:', statsError);
        return;
      }

      if (!orderStats || orderStats.length === 0) {
        console.error('No order stats returned');
        return;
      }

      const stats = orderStats[0];
      console.log('Order stats for status update:', stats);

      // Determine new status
      let newStatus = 'pending';
      let statusNotes = '';

      const totalProcessed = (stats.total_approved || 0) + (stats.total_defective || 0);
      const totalOrdered = stats.total_ordered || 0;
      
      if (totalProcessed >= totalOrdered && totalOrdered > 0) {
        newStatus = 'completed';
        statusNotes = `Orden completada: ${stats.total_approved || 0} aprobadas${(stats.total_defective || 0) > 0 ? `, ${stats.total_defective} devueltas` : ''} de ${totalOrdered} total.`;
      } else if ((stats.total_delivered || 0) > 0) {
        newStatus = 'in_progress';
        statusNotes = `Orden en progreso: ${stats.total_approved || 0} aprobadas, ${stats.total_defective || 0} devueltas, ${stats.total_pending || 0} pendientes de ${totalOrdered} total.`;
      }

      console.log('Forcing order status to:', newStatus);

      // Update order status directly
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          notes: statusNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error forcing order status update:', updateError);
      } else {
        console.log(`Order ${orderId} status forced to: ${newStatus}`);
      }

    } catch (error) {
      console.error('Error in forceOrderStatusUpdate:', error);
    }
  };

  const updateOrderStatusBasedOnDeliveries = async (orderId: string) => {
    try {
      console.log('Updating order status for order:', orderId);
      
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            product_variant_id
          ),
          deliveries (
            id,
            status,
            delivery_items (
              quantity_delivered,
              quality_status,
              notes,
              order_item_id
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('Error fetching order data:', orderError);
        return;
      }

      console.log('Order data for status update:', orderData);

      // Initialize totals properly with explicit number type
      let totalsOrdered: number = 0;
      let totalsDelivered: number = 0;
      let totalsApproved: number = 0;
      let totalsDefective: number = 0;
      let totalsPending: number = 0;

      if (orderData.order_items && Array.isArray(orderData.order_items)) {
        for (const orderItem of orderData.order_items) {
          if (!orderItem) continue;
          
          const itemQuantity = Number(orderItem.quantity) || 0;
          totalsOrdered += itemQuantity;
          
          if (orderData.deliveries && Array.isArray(orderData.deliveries)) {
            for (const delivery of orderData.deliveries) {
              if (!delivery || !delivery.delivery_items || !Array.isArray(delivery.delivery_items)) {
                continue;
              }
              
              for (const deliveryItem of delivery.delivery_items) {
                if (!deliveryItem || deliveryItem.order_item_id !== orderItem.id) {
                  continue;
                }
                
                const deliveredQty = Number(deliveryItem.quantity_delivered) || 0;
                totalsDelivered += deliveredQty;
                
                const qualityStatus = deliveryItem.quality_status;
                
                if (qualityStatus === 'approved') {
                  totalsApproved += deliveredQty;
                } else if (qualityStatus === 'rejected') {
                  totalsDefective += deliveredQty;
                } else if (qualityStatus === 'partial_approved') {
                  const notes = String(deliveryItem.notes || '');
                  const approvedMatch = notes.match(/Aprobadas: (\d+)/);
                  const defectiveMatch = notes.match(/Defectuosas: (\d+)/);
                  
                  if (approvedMatch && approvedMatch[1]) {
                    const approvedCount = parseInt(approvedMatch[1], 10);
                    if (!isNaN(approvedCount)) {
                      totalsApproved += approvedCount;
                    }
                  }
                  
                  if (defectiveMatch && defectiveMatch[1]) {
                    const defectiveCount = parseInt(defectiveMatch[1], 10);
                    if (!isNaN(defectiveCount)) {
                      totalsDefective += defectiveCount;
                    }
                  }
                }
              }
            }
          }
        }
      }

      totalsPending = Math.max(0, totalsOrdered - totalsApproved - totalsDefective);

      console.log('Order status calculation:', {
        totalOrdered: totalsOrdered,
        totalDelivered: totalsDelivered,
        totalApproved: totalsApproved,
        totalDefective: totalsDefective,
        totalPending: totalsPending,
        currentStatus: orderData.status
      });

      let orderStatus = 'pending';
      let orderNotes = '';

      const totalProcessed = totalsApproved + totalsDefective;
      
      if (totalProcessed >= totalsOrdered) {
        orderStatus = 'completed';
        orderNotes = `Orden completada: ${totalsApproved} aprobadas${totalsDefective > 0 ? `, ${totalsDefective} devueltas` : ''} de ${totalsOrdered} total.`;
      } else if (totalsDelivered > 0) {
        orderStatus = 'in_progress';
        orderNotes = `Orden en progreso: ${totalsApproved} aprobadas, ${totalsDefective} devueltas, ${totalsPending} pendientes de ${totalsOrdered} total.`;
      }

      console.log('New order status will be:', orderStatus);

      if (orderStatus !== orderData.status || orderNotes !== orderData.notes) {
        console.log('Updating order status from', orderData.status, 'to', orderStatus);
        
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: orderStatus,
            notes: orderNotes
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Error updating order status:', updateError);
        } else {
          console.log(`Order ${orderId} status updated to: ${orderStatus}`);
        }
      } else {
        console.log('Order status already up to date:', orderStatus);
      }

    } catch (error) {
      console.error('Error updating order status based on deliveries:', error);
    }
  };

  const syncApprovedInventoryWithShopify = async (approvedItems: ItemUpdateData[]) => {
    try {
      console.log('Syncing approved inventory with Shopify:', approvedItems);
      
      const variantUpdates = new Map();
      
      approvedItems.forEach(item => {
        if (item.product_variant_id && item.quantity_approved > 0) {
          const current = variantUpdates.get(item.product_variant_id) || 0;
          variantUpdates.set(item.product_variant_id, current + item.quantity_approved);
        }
      });

      for (const [variantId, quantity] of variantUpdates) {
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

  const deleteDelivery = async (deliveryId: string) => {
    setLoading(true);
    try {
      console.log('Deleting delivery:', deliveryId);

      const { error: itemsError } = await supabase
        .from('delivery_items')
        .delete()
        .eq('delivery_id', deliveryId);

      if (itemsError) {
        console.error('Error deleting delivery items:', itemsError);
        throw itemsError;
      }

      const { error: deliveryError } = await supabase
        .from('deliveries')
        .delete()
        .eq('id', deliveryId);

      if (deliveryError) {
        console.error('Error deleting delivery:', deliveryError);
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
        description: error instanceof Error ? error.message : "No se pudo eliminar la entrega.",
        variant: "destructive",
      });
      return false;
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
    checkAndUpdateDeliveryOnOrderCompletion,
    forceOrderStatusUpdate,
    updateOrderStatusBasedOnDeliveries,
    syncApprovedInventoryWithShopify,
    getDeliveryStats,
    deleteDelivery,
    loading
  };
};
