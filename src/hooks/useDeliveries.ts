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
            synced_to_shopify,
            sync_attempt_count,
            last_sync_attempt,
            sync_error_message,
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
    console.log('Starting delivery creation process with enhanced file handling...');
    
    try {
      console.log('Creating delivery with data:', deliveryData);

      // Enhanced file validation with specific logging for invoice/remission files
      let validFiles: File[] = [];
      if (deliveryData.files && deliveryData.files.length > 0) {
        console.log(`📄 Processing ${deliveryData.files.length} invoice/remission file(s)...`);
        
        validFiles = Array.from(deliveryData.files).filter((file): file is File => {
          if (file instanceof File) {
            console.log(`✅ Valid invoice/remission file: ${file.name} (${file.size} bytes, ${file.type})`);
            return true;
          } else {
            console.warn('❌ Invalid file object found:', file);
            return false;
          }
        });
        
        console.log(`📊 Invoice/Remission files summary: ${validFiles.length}/${deliveryData.files.length} valid files`);
        
        // Additional validation for invoice/remission files
        const supportedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        const unsupportedFiles = validFiles.filter(file => !supportedTypes.includes(file.type));
        
        if (unsupportedFiles.length > 0) {
          throw new Error(`Archivos no soportados para cuenta de cobro/remisión: ${unsupportedFiles.map(f => f.name).join(', ')}`);
        }
      }

      // Step 1: Validate orderId exists
      const { data: orderExists, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('id', deliveryData.orderId)
        .single();

      if (orderError || !orderExists) {
        throw new Error(`Orden no encontrada: ${deliveryData.orderId}`);
      }
      
      console.log(`📋 Order validated: ${orderExists.order_number}`);

      // Step 2: Validate workshopId if provided
      if (deliveryData.workshopId) {
        const { data: workshopExists, error: workshopError } = await supabase
          .from('workshops')
          .select('id, name')
          .eq('id', deliveryData.workshopId)
          .single();

        if (workshopError || !workshopExists) {
          console.warn(`Workshop no encontrado: ${deliveryData.workshopId}, continuando sin workshop`);
        } else {
          console.log(`🏭 Workshop validated: ${workshopExists.name}`);
        }
      }

      // Step 3: Validate order items
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
        
        console.log(`📦 ${orderItemsExist.length} order items validated`);
      }

      // Step 4: Generate tracking number
      const { data: trackingNumber, error: trackingError } = await supabase
        .rpc('generate_delivery_number');

      if (trackingError || !trackingNumber) {
        throw new Error(`Error generando número de seguimiento: ${trackingError?.message || 'Unknown error'}`);
      }
      
      console.log(`🏷️ Generated tracking number: ${trackingNumber}`);

      // Step 5: Create delivery record
      const deliveryRecord = {
        tracking_number: trackingNumber,
        order_id: deliveryData.orderId,
        workshop_id: deliveryData.workshopId || null,
        delivery_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        user_observations: deliveryData.notes || null, // Save user observations in dedicated field
        notes: null, // Keep notes field for system messages only
        delivered_by: null,
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
        console.error('❌ Error creating delivery:', deliveryError);
        throw new Error(`Error creando entrega: ${deliveryError.message}`);
      }

      console.log('✅ Delivery created successfully:', createdDelivery);

      // Step 6: Create delivery items
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
          console.error('❌ Error creating delivery items:', itemsError);
          await supabase.from('deliveries').delete().eq('id', createdDelivery.id);
          throw new Error(`Error creando items de entrega: ${itemsError.message}`);
        }

        console.log('✅ Delivery items created successfully:', createdItems);
      }

      // Step 7: Enhanced file upload for invoice/remission documents
      let uploadedFilesCount = 0;
      let failedFilesCount = 0;
      
      if (validFiles.length > 0) {
        try {
          console.log(`📁 Starting upload of ${validFiles.length} invoice/remission file(s) to delivery-evidence bucket...`);
          
          const uploadResults = [];
          
          for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            console.log(`📤 Uploading file ${i + 1}/${validFiles.length}: ${file.name}`);
            
            try {
              // Upload to delivery-evidence bucket with proper folder structure
              const fileExt = file.name.split('.').pop();
              const fileName = `${createdDelivery.id}/invoice-remission-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
              
              console.log(`📂 Storage path: delivery-evidence/${fileName}`);
              
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('delivery-evidence')
                .upload(fileName, file);

              if (uploadError) {
                console.error(`❌ Upload error for ${file.name}:`, uploadError);
                failedFilesCount++;
                uploadResults.push({ 
                  file: file.name, 
                  success: false, 
                  error: uploadError.message 
                });
                continue;
              }

              console.log(`✅ File uploaded to storage:`, uploadData);

              // Get public URL
              const { data: { publicUrl } } = supabase.storage
                .from('delivery-evidence')
                .getPublicUrl(fileName);

              console.log(`🔗 Public URL generated: ${publicUrl}`);

              // Save file record to delivery_files table
              const fileRecord = {
                delivery_id: createdDelivery.id,
                file_name: file.name,
                file_url: publicUrl,
                file_type: file.type,
                file_size: file.size,
                uploaded_by: (await supabase.auth.getUser()).data.user?.id,
                notes: 'Archivo de cuenta de cobro/remisión',
                file_category: 'invoice'
              };

              console.log('💾 Saving file record to database:', fileRecord);

              const { data: dbData, error: dbError } = await supabase
                .from('delivery_files')
                .insert([fileRecord])
                .select();

              if (dbError) {
                console.error(`❌ Database insert error for ${file.name}:`, dbError);
                failedFilesCount++;
                uploadResults.push({ 
                  file: file.name, 
                  success: false, 
                  error: dbError.message 
                });
              } else {
                console.log(`✅ File record saved to database:`, dbData);
                uploadedFilesCount++;
                uploadResults.push({ 
                  file: file.name, 
                  success: true, 
                  url: publicUrl 
                });
              }

            } catch (fileError) {
              console.error(`❌ Error processing file ${file.name}:`, fileError);
              failedFilesCount++;
              uploadResults.push({ 
                file: file.name, 
                success: false, 
                error: fileError instanceof Error ? fileError.message : 'Error desconocido' 
              });
            }
          }

          console.log(`📊 File upload summary: ${uploadedFilesCount} successful, ${failedFilesCount} failed`);
          
          if (uploadedFilesCount > 0) {
            const successMessage = failedFilesCount > 0 
              ? `Entrega ${trackingNumber} creada. ${uploadedFilesCount} archivo(s) de cuenta de cobro/remisión subidos. ${failedFilesCount} archivo(s) fallaron.`
              : `Entrega ${trackingNumber} creada exitosamente con ${uploadedFilesCount} archivo(s) de cuenta de cobro/remisión`;
              
            toast({
              title: "Entrega registrada",
              description: successMessage,
            });
          }

          if (failedFilesCount > 0 && uploadedFilesCount === 0) {
            console.warn('⚠️ All files failed to upload');
            toast({
              title: "Advertencia",
              description: `Entrega ${trackingNumber} creada pero no se pudieron subir los archivos de cuenta de cobro/remisión. Puedes subirlos después desde los detalles de la entrega.`,
              variant: "default",
            });
          }
          
        } catch (fileError) {
          console.error('❌ Critical error in file upload process:', fileError);
          toast({
            title: "Advertencia",
            description: `Entrega ${trackingNumber} creada pero hubo problemas con los archivos de cuenta de cobro/remisión. Puedes subirlos después desde los detalles de la entrega.`,
            variant: "default",
          });
        }
      } else {
        // No files to upload
        toast({
          title: "Entrega registrada",
          description: `Entrega ${trackingNumber} creada exitosamente`,
        });
      }

      console.log(`✅ Delivery creation process completed successfully for ${trackingNumber}`);
      console.log(`📄 Files uploaded to delivery-evidence bucket under folder: ${createdDelivery.id}/`);
      console.log(`💾 File records saved to delivery_files table with delivery_id: ${createdDelivery.id}`);
      
      return createdDelivery;

    } catch (error) {
      console.error('❌ Error creating delivery:', error);
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
      
      if (!qualityData.variants || Object.keys(qualityData.variants).length === 0) {
        throw new Error('No se encontraron datos de variantes para procesar');
      }

      const itemsReview = Object.entries(qualityData.variants).map(([deliveryItemId, data]: [string, any]) => {
        console.log('Processing item:', deliveryItemId, 'with data:', data);
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(deliveryItemId)) {
          console.error('Invalid UUID format for delivery_item_id:', deliveryItemId);
          throw new Error(`ID de delivery_item inválido: ${deliveryItemId}`);
        }

        return {
          id: deliveryItemId,
          quantityApproved: data.approved || 0,
          quantityDefective: data.defective || 0,
          status: data.approved > 0 && data.defective === 0 ? 'approved' : 
                 data.defective > 0 && data.approved === 0 ? 'rejected' : 
                 'partial_approved',
          notes: data.reason || qualityData.generalNotes || ''
        };
      });

      console.log('Items to review after processing:', itemsReview);

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
          .eq('id', item.id);

        if (error) {
          console.error('Error updating delivery_item:', item.id, error);
          throw error;
        }

        console.log('Successfully updated delivery_item:', item.id);
      }

      // Upload quality evidence files (different from invoice/remission files)
      if (qualityData.evidenceFiles && qualityData.evidenceFiles.length > 0) {
        try {
          console.log('Uploading quality control evidence files:', qualityData.evidenceFiles.length);
          await uploadEvidenceFiles(deliveryId, qualityData.evidenceFiles);
          console.log('Quality evidence files uploaded successfully');
        } catch (evidenceError) {
          console.error('Error uploading quality evidence files:', evidenceError);
          toast({
            title: "Advertencia",
            description: "La revisión de calidad fue procesada pero hubo un problema al subir la evidencia fotográfica.",
            variant: "default",
          });
        }
      }

      // Update delivery with general notes (preserving user observations)
      if (qualityData.generalNotes && qualityData.generalNotes.trim()) {
        console.log('Updating delivery with general notes (quality review):', qualityData.generalNotes);
        const { error: notesError } = await supabase
          .from('deliveries')
          .update({
            notes: `Control de Calidad: ${qualityData.generalNotes.trim()}`
          })
          .eq('id', deliveryId);

        if (notesError) {
          console.error('Error updating delivery general notes:', notesError);
          toast({
            title: "Advertencia",
            description: "La revisión fue procesada pero hubo un error al guardar las notas generales.",
            variant: "default",
          });
        } else {
          console.log('Successfully updated delivery general notes');
        }
      }

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

      // Calcular estadísticas para determinar el estado de la entrega
      const totalItems = deliveryData.delivery_items?.length || 0;
      const itemsWithApproved = deliveryData.delivery_items?.filter((item: any) => item.quantity_approved > 0).length || 0;
      const itemsWithDefective = deliveryData.delivery_items?.filter((item: any) => item.quantity_defective > 0).length || 0;
      const alreadySyncedCount = deliveryData.delivery_items?.filter((item: any) => item.synced_to_shopify && item.quantity_approved > 0).length || 0;

      // Determinar el nuevo estado de la entrega
      let newDeliveryStatus = 'pending';
      if (itemsWithApproved > 0 && itemsWithDefective === 0) {
        newDeliveryStatus = 'approved';
      } else if (itemsWithApproved === 0 && itemsWithDefective > 0) {
        newDeliveryStatus = 'rejected';
      } else if (itemsWithApproved > 0 && itemsWithDefective > 0) {
        newDeliveryStatus = 'partial_approved';
      }

      // Filtrar items que tienen cantidad aprobada (la verificación de sync la hará syncApprovedItemsToShopify)
      const approvedItems = deliveryData.delivery_items
        ?.filter((item: any) => item.quantity_approved > 0)
        .map((item: any) => ({
          variantId: item.order_items?.product_variant_id || '',
          skuVariant: item.order_items?.product_variants?.sku_variant || '',
          quantityApproved: item.quantity_approved
        }))
        .filter((item: any) => item.skuVariant) || [];

      // Actualizar estado de la entrega primero
      console.log('Updating delivery status to:', newDeliveryStatus);
      const { error: statusError } = await supabase
        .from('deliveries')
        .update({
          status: newDeliveryStatus
        })
        .eq('id', deliveryId);

      if (statusError) {
        console.error('Error updating delivery status:', statusError);
        throw statusError;
      }

      // Verificar y sincronizar items que realmente necesitan sincronización
      if (approvedItems.length > 0) {
        try {
          console.log('Verificando y sincronizando items aprobados:', approvedItems);
          const syncResult = await syncApprovedItemsToShopify({
            deliveryId,
            approvedItems
          }, true); // onlyPending = true para verificar estado de sync
          
          const syncedCount = syncResult?.syncedItems?.length || 0;
          const skippedCount = approvedItems.length - syncedCount;
          
          if (syncedCount > 0) {
            toast({
              title: "Revisión completada",
              description: `Calidad procesada. Sincronizados ${syncedCount} items nuevos con Shopify${skippedCount > 0 ? ` (${skippedCount} ya estaban sincronizados)` : ''}.`,
            });
          } else {
            toast({
              title: "Revisión completada",
              description: `Los resultados de calidad han sido guardados. Todos los ${approvedItems.length} items ya estaban sincronizados con Shopify.`,
            });
          }
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

  const updateDeliveryQuantities = async (deliveryId: string, quantityUpdates: Array<{id: string, quantity: number}>) => {
    setLoading(true);
    try {
      console.log('Updating delivery quantities for delivery:', deliveryId, quantityUpdates);
      
      const { data: deliveryCheck, error: deliveryError } = await supabase
        .from('deliveries')
        .select('id, status, synced_to_shopify')
        .eq('id', deliveryId)
        .single();

      if (deliveryError) {
        throw new Error('Entrega no encontrada');
      }

      const editableStatuses = ['pending', 'in_quality'];
      if (!editableStatuses.includes(deliveryCheck.status)) {
        throw new Error('Esta entrega ya no puede ser editada porque ha pasado por control de calidad');
      }

      if (deliveryCheck.synced_to_shopify) {
        throw new Error('Esta entrega ya fue sincronizada con Shopify y no puede ser editada');
      }

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
