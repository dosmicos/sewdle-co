
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useInventorySync } from './useInventorySync';
import { useDeliveryEvidence } from './useDeliveryEvidence';

export const useDeliveries = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { syncApprovedItemsToShopify } = useInventorySync();
  const { uploadEvidenceFiles } = useDeliveryEvidence();

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_deliveries_with_sync_status');

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
      console.log('Fetching delivery by ID:', deliveryId);
      
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          orders (
            id,
            order_number
          ),
          workshops (
            id,
            name
          ),
          delivery_items (
            id,
            delivery_id,
            order_item_id,
            quantity_delivered,
            quantity_approved,
            quantity_defective,
            quality_status,
            quality_notes,
            notes,
            created_at,
            order_items (
              id,
              order_id,
              product_variant_id,
              quantity,
              unit_price,
              total_price,
              product_variants (
                id,
                sku_variant,
                size,
                color,
                stock_quantity,
                additional_price,
                products (
                  id,
                  name,
                  sku,
                  description,
                  category,
                  base_price,
                  image_url
                )
              )
            )
          )
        `)
        .eq('id', deliveryId)
        .single();

      if (error) {
        console.error('SQL Error fetching delivery:', error);
        throw error;
      }

      console.log('Raw delivery data from database:', JSON.stringify(data, null, 2));
      
      // Verificar la estructura de los datos
      if (data?.delivery_items) {
        console.log('Delivery items structure check:');
        data.delivery_items.forEach((item: any, index: number) => {
          console.log(`Item ${index}:`, {
            id: item.id,
            order_item_id: item.order_item_id,
            order_items_exists: !!item.order_items,
            product_variants_exists: !!item.order_items?.product_variants,
            products_exists: !!item.order_items?.product_variants?.products,
            product_name: item.order_items?.product_variants?.products?.name,
            variant_info: {
              size: item.order_items?.product_variants?.size,
              color: item.order_items?.product_variants?.color,
              sku: item.order_items?.product_variants?.sku_variant
            }
          });
        });
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

  const createDelivery = async (deliveryData: any) => {
    setLoading(true);
    try {
      console.log('Creating delivery with data:', deliveryData);

      // Validar archivos adjuntos al inicio
      if (deliveryData.files && deliveryData.files.length > 0) {
        console.log(`Files to attach: ${deliveryData.files.length}`);
        deliveryData.files.forEach((file: File, index: number) => {
          console.log(`File ${index + 1}: ${file.name} (${file.size} bytes, ${file.type})`);
        });
      }

      // Paso 1: Validar que orderId existe
      const { data: orderExists, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', deliveryData.orderId)
        .single();

      if (orderError || !orderExists) {
        throw new Error(`Orden no encontrada: ${deliveryData.orderId}`);
      }

      // Paso 2: Validar workshopId si se proporciona
      if (deliveryData.workshopId) {
        const { data: workshopExists, error: workshopError } = await supabase
          .from('workshops')
          .select('id')
          .eq('id', deliveryData.workshopId)
          .single();

        if (workshopError || !workshopExists) {
          console.warn(`Workshop no encontrado: ${deliveryData.workshopId}, continuando sin workshop`);
        }
      }

      // Paso 3: Validar que todos los orderItemIds existen
      if (deliveryData.items && deliveryData.items.length > 0) {
        const orderItemIds = deliveryData.items.map((item: any) => item.orderItemId);
        const { data: orderItemsExist, error: orderItemsError } = await supabase
          .from('order_items')
          .select('id')
          .in('id', orderItemIds);

        if (orderItemsError) {
          throw new Error(`Error validando items de orden: ${orderItemsError.message}`);
        }

        if (!orderItemsExist || orderItemsExist.length !== orderItemIds.length) {
          const foundIds = orderItemsExist?.map(item => item.id) || [];
          const missingIds = orderItemIds.filter((id: string) => !foundIds.includes(id));
          throw new Error(`Items de orden no encontrados: ${missingIds.join(', ')}`);
        }
      }

      // Paso 4: Generar tracking number
      const { data: trackingNumber, error: trackingError } = await supabase
        .rpc('generate_delivery_number');

      if (trackingError || !trackingNumber) {
        throw new Error(`Error generando número de seguimiento: ${trackingError?.message || 'Unknown error'}`);
      }

      // Paso 5: Crear la entrega con datos corregidos
      const deliveryRecord = {
        tracking_number: trackingNumber,
        order_id: deliveryData.orderId,
        workshop_id: deliveryData.workshopId || null,
        delivery_date: new Date().toISOString().split('T')[0], // Fecha actual en formato YYYY-MM-DD
        status: 'pending',
        notes: deliveryData.notes || null,
        delivered_by: null, // Se puede asignar después
        recipient_name: null,
        recipient_phone: null,
        recipient_address: null
      };

      console.log('Creating delivery record:', deliveryRecord);

      const { data: createdDelivery, error: deliveryError } = await supabase
        .from('deliveries')
        .insert([deliveryRecord])
        .select()
        .single();

      if (deliveryError) {
        console.error('Error creating delivery:', deliveryError);
        throw new Error(`Error creando entrega: ${deliveryError.message}`);
      }

      console.log('Delivery created successfully:', createdDelivery);

      // Paso 6: Crear los delivery_items si hay items
      if (deliveryData.items && deliveryData.items.length > 0) {
        const deliveryItems = deliveryData.items.map((item: any) => ({
          delivery_id: createdDelivery.id,
          order_item_id: item.orderItemId,
          quantity_delivered: item.quantityDelivered,
          quantity_approved: 0,
          quantity_defective: 0,
          quality_status: 'pending',
          notes: null,
          quality_notes: null
        }));

        console.log('Creating delivery items:', deliveryItems);

        const { data: createdItems, error: itemsError } = await supabase
          .from('delivery_items')
          .insert(deliveryItems)
          .select();

        if (itemsError) {
          console.error('Error creating delivery items:', itemsError);
          // Rollback: eliminar la entrega creada
          await supabase.from('deliveries').delete().eq('id', createdDelivery.id);
          throw new Error(`Error creando items de entrega: ${itemsError.message}`);
        }

        console.log('Delivery items created successfully:', createdItems);
      }

      // Paso 7: FUNCIONALIDAD MEJORADA - Subir archivos adjuntos si existen
      if (deliveryData.files && deliveryData.files.length > 0) {
        try {
          console.log(`Starting file upload process for ${deliveryData.files.length} files`);
          
          // Validar que todos los archivos son válidos antes de subirlos
          const validFiles = Array.from(deliveryData.files).filter((file: File) => {
            if (!file || file.size === 0) {
              console.warn(`Skipping invalid file:`, file);
              return false;
            }
            return true;
          });

          if (validFiles.length > 0) {
            console.log(`Uploading ${validFiles.length} valid files...`);
            await uploadEvidenceFiles(
              createdDelivery.id, 
              validFiles, 
              deliveryData.notes ? `Archivos de entrega: ${deliveryData.notes}` : 'Archivos de entrega inicial'
            );
            console.log('All files uploaded successfully');
          } else {
            console.warn('No valid files to upload');
          }
          
        } catch (fileError) {
          console.error('Error uploading delivery files:', fileError);
          // No fallar la creación de la entrega por error en archivos, pero mostrar advertencia
          toast({
            title: "Advertencia",
            description: "La entrega fue creada exitosamente pero hubo un problema al subir algunos archivos adjuntos. Puedes intentar subirlos nuevamente desde los detalles de la entrega.",
            variant: "default",
          });
        }
      }

      // Mensaje de éxito
      const filesCount = deliveryData.files ? deliveryData.files.length : 0;
      toast({
        title: "Entrega creada",
        description: `Entrega ${trackingNumber} registrada exitosamente${filesCount > 0 ? ` con ${filesCount} archivo(s) adjunto(s)` : ''}`,
      });

      return createdDelivery;

    } catch (error) {
      console.error('Error creating delivery:', error);
      toast({
        title: "Error al crear entrega",
        description: error instanceof Error ? error.message : "No se pudo crear la entrega",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const processQualityReview = async (deliveryId: string, qualityData: any) => {
    setLoading(true);
    try {
      console.log('Processing quality review for delivery:', deliveryId);
      console.log('Quality data received:', qualityData);
      
      // Validar que qualityData.variants existe y tiene datos
      if (!qualityData.variants || Object.keys(qualityData.variants).length === 0) {
        throw new Error('No se encontraron datos de variantes para procesar');
      }

      // Convertir datos de calidad al formato esperado usando los IDs reales
      const itemsReview = Object.entries(qualityData.variants).map(([deliveryItemId, data]: [string, any]) => {
        console.log('Processing item:', deliveryItemId, 'with data:', data);
        
        // Validar que el ID es un UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(deliveryItemId)) {
          console.error('Invalid UUID format for delivery_item_id:', deliveryItemId);
          throw new Error(`ID de delivery_item inválido: ${deliveryItemId}`);
        }

        return {
          id: deliveryItemId, // Usar el UUID real del delivery_item
          quantityApproved: data.approved || 0,
          quantityDefective: data.defective || 0,
          status: data.approved > 0 && data.defective === 0 ? 'approved' : 
                 data.defective > 0 && data.approved === 0 ? 'rejected' : 
                 'partial_approved',
          notes: data.reason || qualityData.generalNotes || ''
        };
      });

      console.log('Items to review after processing:', itemsReview);

      // Actualizar items con resultados de calidad
      for (const item of itemsReview) {
        console.log('Updating delivery_item:', item.id, 'with quantities:', {
          approved: item.quantityApproved,
          defective: item.quantityDefective,
          status: item.status
        });

        const { error } = await supabase
          .from('delivery_items')
          .update({
            quantity_approved: item.quantityApproved,
            quantity_defective: item.quantityDefective,
            quality_status: item.status,
            quality_notes: item.notes
          })
          .eq('id', item.id); // Usar el UUID real

        if (error) {
          console.error('Error updating delivery_item:', item.id, error);
          throw error;
        }

        console.log('Successfully updated delivery_item:', item.id);
      }

      // NUEVA FUNCIONALIDAD: Subir archivos de evidencia si existen
      if (qualityData.evidenceFiles && qualityData.evidenceFiles.length > 0) {
        try {
          console.log('Uploading evidence files:', qualityData.evidenceFiles.length);
          await uploadEvidenceFiles(deliveryId, qualityData.evidenceFiles);
          console.log('Evidence files uploaded successfully');
        } catch (evidenceError) {
          console.error('Error uploading evidence files:', evidenceError);
          // No fallar el proceso de calidad por error de evidencia
          toast({
            title: "Advertencia",
            description: "La revisión de calidad fue procesada pero hubo un problema al subir la evidencia fotográfica.",
            variant: "default",
          });
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

      // Solo sincronizar si no se ha sincronizado antes
      if (!deliveryData.synced_to_shopify) {
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
      } else {
        toast({
          title: "Revisión completada",
          description: "Los resultados de calidad han sido guardados. Esta entrega ya fue sincronizada con Shopify.",
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

  const updateDeliveryQuantities = async (deliveryId: string, quantityUpdates: Array<{id: string, quantity: number}>) => {
    setLoading(true);
    try {
      console.log('Updating delivery quantities for delivery:', deliveryId, quantityUpdates);
      
      // Verificar que la entrega existe y está en estado editable
      const { data: deliveryCheck, error: deliveryError } = await supabase
        .from('deliveries')
        .select('id, status, synced_to_shopify')
        .eq('id', deliveryId)
        .single();

      if (deliveryError) {
        throw new Error('Entrega no encontrada');
      }

      // Verificar que la entrega puede ser editada
      const editableStatuses = ['pending', 'in_quality'];
      if (!editableStatuses.includes(deliveryCheck.status)) {
        throw new Error('Esta entrega ya no puede ser editada porque ha pasado por control de calidad');
      }

      if (deliveryCheck.synced_to_shopify) {
        throw new Error('Esta entrega ya fue sincronizada con Shopify y no puede ser editada');
      }

      // Actualizar las cantidades de cada delivery_item
      for (const update of quantityUpdates) {
        console.log('Updating delivery_item:', update.id, 'to quantity:', update.quantity);
        
        const { error: updateError } = await supabase
          .from('delivery_items')
          .update({
            quantity_delivered: update.quantity
          })
          .eq('id', update.id);

        if (updateError) {
          console.error('Error updating delivery_item:', update.id, updateError);
          throw new Error(`Error actualizando item: ${updateError.message}`);
        }
      }

      toast({
        title: "Cantidades actualizadas",
        description: "Las cantidades de entrega han sido actualizadas exitosamente",
      });

      return true;

    } catch (error) {
      console.error('Error updating delivery quantities:', error);
      toast({
        title: "Error al actualizar cantidades",
        description: error instanceof Error ? error.message : "No se pudieron actualizar las cantidades",
        variant: "destructive",
      });
      return false;
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
    createDelivery,
    processQualityReview,
    updateDeliveryQuantities,
    deleteDelivery,
    loading
  };
};
