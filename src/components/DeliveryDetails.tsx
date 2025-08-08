import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Save, Edit2, Package, Upload, X, AlertTriangle, CheckCircle, RefreshCw, DollarSign } from 'lucide-react';
import DeliverySyncStatus from './DeliverySyncStatus';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useUserContext } from '@/hooks/useUserContext';
import { useInventorySync } from '@/hooks/useInventorySync';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { sortVariants } from '@/lib/variantSorting';
import DeliveryEvidenceGallery from './DeliveryEvidenceGallery';
import DeliveryReviewSummary from './DeliveryReviewSummary';
import DeliveryInvoiceFiles from './DeliveryInvoiceFiles';
import { DeliveryPaymentManager } from './financial/DeliveryPaymentManager';

interface DeliveryDetailsProps {
  delivery: any;
  onBack: (shouldRefresh?: boolean) => void;
  onDeliveryUpdated?: () => void;
}

const DeliveryDetails = ({ delivery: initialDelivery, onBack, onDeliveryUpdated }: DeliveryDetailsProps) => {
  const [delivery, setDelivery] = useState(initialDelivery);
  const [isEditing, setIsEditing] = useState(false);
  const [isReEditingQuality, setIsReEditingQuality] = useState(false); // Nuevo estado para re-edición
  const [quantityData, setQuantityData] = useState<any>({});
  const [qualityData, setQualityData] = useState<any>({ variants: {} });
  const [generalNotes, setGeneralNotes] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
  const [syncingVariants, setSyncingVariants] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { fetchDeliveryById, updateDeliveryQuantities, processQualityReview, loading } = useDeliveries();
  const { canEditDeliveries } = useUserContext();
  const { syncApprovedItemsToShopify } = useInventorySync();
  const { toast } = useToast();

  useEffect(() => {
    loadDelivery();
  }, [initialDelivery.id]);

  const loadDelivery = async () => {
    const refreshedDelivery = await fetchDeliveryById(initialDelivery.id);
    if (refreshedDelivery) {
      setDelivery(refreshedDelivery);
      
      // Initialize quantity data
      const initialQuantityData: any = {};
      refreshedDelivery.delivery_items?.forEach((item: any) => {
        initialQuantityData[item.id] = item.quantity_delivered || 0;
      });
      setQuantityData(initialQuantityData);
      
      // Initialize quality data
      const initialQualityData: any = { variants: {} };
      refreshedDelivery.delivery_items?.forEach((item: any) => {
        initialQualityData.variants[item.id] = {
          approved: item.quantity_approved || 0,
          defective: item.quantity_defective || 0,
          reason: item.quality_notes || ''
        };
      });
      setQualityData(initialQualityData);
      
      // Initialize general notes from delivery data
      setGeneralNotes(refreshedDelivery.notes || '');
    }
  };

  // Helper function to sort delivery items by product first, then by variant size
  const getSortedDeliveryItems = (items: any[]) => {
    if (!items) return [];
    
    // Group items by product name
    const groupedByProduct = items.reduce((acc, item) => {
      const productName = item.order_items?.product_variants?.products?.name || 'Sin nombre';
      if (!acc[productName]) {
        acc[productName] = [];
      }
      acc[productName].push({
        ...item,
        size: item.order_items?.product_variants?.size || '',
        title: item.order_items?.product_variants?.size || ''
      });
      return acc;
    }, {} as Record<string, any[]>);
    
    // Sort each product group by variants and then combine all
    const sortedItems: any[] = [];
    
    // Sort product names alphabetically
    const sortedProductNames = Object.keys(groupedByProduct).sort();
    
    // For each product, sort its variants and add to final array
    sortedProductNames.forEach(productName => {
      const productItems = groupedByProduct[productName];
      const sortedProductItems = sortVariants(productItems);
      sortedItems.push(...sortedProductItems);
    });
    
    return sortedItems;
  };

  const handleQuantityChange = (itemId: string, value: number) => {
    setQuantityData(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handleSaveQuantities = async () => {
    const updates = Object.entries(quantityData).map(([id, quantity]) => ({
      id,
      quantity: Number(quantity)
    }));
    
    const success = await updateDeliveryQuantities(delivery.id, updates);
    if (success) {
      setIsEditing(false);
      loadDelivery();
      onDeliveryUpdated?.();
    }
  };

  const handleQualityChange = (itemId: string, field: string, value: any) => {
    setQualityData(prev => ({
      ...prev,
      variants: {
        ...prev.variants,
        [itemId]: {
          ...prev.variants[itemId],
          [field]: value
        }
      }
    }));
  };

  // Función para detectar si es la última variante sin guardar
  const isLastUnsavedVariant = (itemId: string) => {
    const unsavedVariants = delivery.delivery_items?.filter((item: any) => {
      // Una variante no está guardada si no tiene cantidad_approved ni quantity_defective en la base de datos
      return (item.quantity_approved === 0 && item.quantity_defective === 0);
    }) || [];
    
    // Es la última si solo queda una sin guardar y es la actual
    return unsavedVariants.length === 1 && unsavedVariants[0].id === itemId;
  };

  // Función para obtener todas las variantes pendientes de sincronización 
  const getPendingSyncVariants = () => {
    return delivery.delivery_items?.filter((item: any) => {
      return item.quantity_approved > 0 && !item.synced_to_shopify;
    }) || [];
  };

  const saveVariantQuality = async (itemId: string, isLastVariant = false) => {
    const variantData = qualityData.variants[itemId];
    if (!variantData || (variantData.approved === 0 && variantData.defective === 0)) {
      toast({
        title: "Error",
        description: "Debe asignar al menos una unidad como aprobada o defectuosa",
        variant: "destructive",
      });
      return;
    }

    const deliveredItem = delivery.delivery_items?.find((item: any) => item.id === itemId);
    if (!deliveredItem) return;

    const totalReviewed = variantData.approved + variantData.defective;
    if (totalReviewed !== deliveredItem.quantity_delivered) {
      toast({
        title: "Error", 
        description: `Debe revisar todas las ${deliveredItem.quantity_delivered} unidades entregadas`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Actualizar datos de calidad de la variante
      const { error } = await supabase
        .from('delivery_items')
        .update({
          quantity_approved: variantData.approved,
          quantity_defective: variantData.defective,
          quality_notes: variantData.reason || null
        })
        .eq('id', itemId);

      if (error) {
        console.error('Error saving variant quality:', error);
        toast({
          title: "Error",
          description: "No se pudo guardar la revisión de calidad",
          variant: "destructive",
        });
        return;
      }

      // Si es la última variante, ejecutar proceso secuencial
      if (isLastVariant) {
        console.log('🔄 Es la última variante - Iniciando proceso de finalización secuencial');
        
        try {
          // PASO 1: Guardar notas generales de calidad
          console.log('📝 Paso 1: Guardando notas generales');
          if (generalNotes.trim()) {
          const { error: notesError } = await supabase
            .from('deliveries')
            .update({
              notes: generalNotes.trim()
            })
            .eq('id', delivery.id);

          if (notesError) {
            console.error('Error saving general notes:', notesError);
            toast({
              title: "Advertencia",
              description: "La variante fue guardada pero hubo un error al guardar las notas generales",
              variant: "default",
            });
          }
        }

        // Subir archivos de evidencia si están presentes
        if (evidenceFiles.length > 0) {
          try {
            console.log('Uploading evidence files from last variant save:', evidenceFiles.length);
            
            // Subir cada archivo
            for (let i = 0; i < evidenceFiles.length; i++) {
              const file = evidenceFiles[i];
              
              try {
                // Upload to storage
                const fileExt = file.name.split('.').pop();
                const fileName = `${delivery.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('delivery-evidence')
                  .upload(fileName, file);

                if (uploadError) {
                  console.error(`Upload error for ${file.name}:`, uploadError);
                  continue;
                }

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                  .from('delivery-evidence')
                  .getPublicUrl(fileName);

                // Save file record to database
                const fileRecord = {
                  delivery_id: delivery.id,
                  file_name: file.name,
                  file_url: publicUrl,
                  file_type: file.type,
                  file_size: file.size,
                  uploaded_by: (await supabase.auth.getUser()).data.user?.id,
                  notes: `Evidencia guardada con revisión completa`,
                  file_category: 'evidence'
                };

                const { error: dbError } = await supabase
                  .from('delivery_files')
                  .insert([fileRecord]);

                if (dbError) {
                  console.error(`Database insert error for ${file.name}:`, dbError);
                }
              } catch (fileError) {
                console.error(`Error processing file ${file.name}:`, fileError);
              }
            }

            // Limpiar archivos después de subirlos exitosamente
            setEvidenceFiles([]);
            setEvidencePreviews([]);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }

            console.log('Evidence files uploaded successfully from last variant save');
          } catch (evidenceError) {
            console.error('Error uploading evidence files:', evidenceError);
            toast({
              title: "Advertencia",
              description: "La variante fue guardada pero hubo un error al subir la evidencia fotográfica",
              variant: "default",
            });
          }
        }

        // Sincronizar todas las variantes aprobadas pendientes + la variante actual
        const pendingVariants = getPendingSyncVariants();
        
        // Incluir la variante que acabamos de guardar
        const currentItem = delivery.delivery_items?.find((item: any) => item.id === itemId);
        const allVariantsToSync = [...pendingVariants];
        
        if (currentItem && variantData.approved > 0) {
          // Actualizar los datos de la variante actual con los valores recién guardados
          const updatedCurrentItem = {
            ...currentItem,
            quantity_approved: variantData.approved,
            quantity_defective: variantData.defective,
            quality_notes: variantData.reason || null
          };
          allVariantsToSync.push(updatedCurrentItem);
        }
        
        if (allVariantsToSync.length > 0) {
          try {
            const syncData = {
              deliveryId: delivery.id,
              approvedItems: allVariantsToSync.map(item => ({
                variantId: item.order_items?.product_variants?.id,
                skuVariant: item.order_items?.product_variants?.sku_variant,
                quantityApproved: item.quantity_approved
              })).filter(item => item.quantityApproved > 0) // Solo sincronizar las que tienen unidades aprobadas
            };

            const result = await syncApprovedItemsToShopify(syncData);

            if (result.success) {
              // Marcar todas las variantes como sincronizadas (incluyendo la actual)
              for (const item of allVariantsToSync) {
                await supabase
                  .from('delivery_items')
                  .update({
                    synced_to_shopify: true,
                    last_sync_attempt: new Date().toISOString()
                  })
                  .eq('id', item.id);
              }

              toast({
                title: "Revisión finalizada",
                description: `Última variante guardada y ${allVariantsToSync.length} variante(s) sincronizada(s) con Shopify`,
              });
            } else {
              toast({
                title: "Guardado",
                description: "Última variante guardada. Error en sincronización con Shopify - puede reintentar manualmente",
                variant: "default",
              });
            }
          } catch (syncError) {
            console.error('Error syncing all variants:', syncError);
            toast({
              title: "Guardado",
              description: "Última variante guardada. Error en sincronización con Shopify - puede reintentar manualmente",
              variant: "default",
            });
          }
        } else {
          toast({
            title: "Revisión finalizada",
            description: "Última variante guardada exitosamente",
          });
        }
        } catch (error) {
          console.error('❌ Error en proceso de finalización:', error);
          toast({
            title: "Error en finalización",
            description: "Ocurrió un error durante el proceso de finalización. Por favor revise manualmente.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Guardado",
          description: "Revisión de calidad guardada exitosamente",
        });
      }

      // Recargar datos de la entrega y notificar al componente padre
      loadDelivery();
      onDeliveryUpdated?.();
    } catch (error) {
      console.error('Error saving variant quality:', error);
      toast({
        title: "Error",
        description: "Error al guardar la revisión de calidad",
        variant: "destructive",
      });
    }
  };

  const syncVariantToShopify = async (itemId: string) => {
    const deliveredItem = delivery.delivery_items?.find((item: any) => item.id === itemId);
    if (!deliveredItem || deliveredItem.quantity_approved === 0) {
      toast({
        title: "Error",
        description: "No hay unidades aprobadas para sincronizar",
        variant: "destructive",
      });
      return;
    }

    // Permitir resincronización si ya está sincronizado
    const isResync = deliveredItem.synced_to_shopify;

    // Confirmar sincronización/resincronización
    const confirmSync = window.confirm(
      `¿Desea ${isResync ? 'resincronizar' : 'sincronizar'} ${deliveredItem.quantity_approved} unidades aprobadas de esta variante con Shopify?\n\nProducto: ${deliveredItem.order_items?.product_variants?.products?.name}\nVariante: ${deliveredItem.order_items?.product_variants?.size} - ${deliveredItem.order_items?.product_variants?.color}\nSKU: ${deliveredItem.order_items?.product_variants?.sku_variant}${isResync ? '\n\n⚠️ ATENCIÓN: Esta variante ya fue sincronizada. Al resincronizar se actualizará el inventario en Shopify.' : ''}`
    );

    if (!confirmSync) return;

    // Agregar al set de variantes sincronizando
    setSyncingVariants(prev => new Set(prev.add(itemId)));

    try {
      const syncData = {
        deliveryId: delivery.id,
        approvedItems: [{
          variantId: deliveredItem.order_items?.product_variants?.id,
          skuVariant: deliveredItem.order_items?.product_variants?.sku_variant,
          quantityApproved: deliveredItem.quantity_approved
        }]
      };

      const result = await syncApprovedItemsToShopify(syncData);

      if (result.success) {
        // Marcar como sincronizado
        await supabase
          .from('delivery_items')
          .update({
            synced_to_shopify: true,
            last_sync_attempt: new Date().toISOString()
          })
          .eq('id', itemId);

        toast({
          title: isResync ? "Resincronizado" : "Sincronizado",
          description: `Variante ${isResync ? 'resincronizada' : 'sincronizada'} exitosamente con Shopify`,
        });

        loadDelivery();
        onDeliveryUpdated?.();
      }
    } catch (error) {
      console.error('Error syncing variant:', error);
      
      // Actualizar contador de intentos fallidos
      await supabase
        .from('delivery_items')
        .update({
          sync_attempt_count: (deliveredItem.sync_attempt_count || 0) + 1,
          last_sync_attempt: new Date().toISOString(),
          sync_error_message: error instanceof Error ? error.message : 'Error desconocido'
        })
        .eq('id', itemId);

      toast({
        title: "Error de sincronización",
        description: "No se pudo sincronizar con Shopify",
        variant: "destructive",
      });
    } finally {
      // Remover del set de variantes sincronizando
      setSyncingVariants(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleEvidenceFilesSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file types (only images)
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      alert('Solo se permiten archivos de imagen (JPG, PNG, WEBP, GIF)');
      return;
    }

    // Validate file sizes (max 5MB each)
    const oversizedFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert('Cada archivo debe ser menor a 5MB');
      return;
    }

    // Validate total files (max 10)
    if (evidenceFiles.length + files.length > 10) {
      alert('Máximo 10 archivos de evidencia por entrega');
      return;
    }

    // Update files and create previews
    setEvidenceFiles(prev => [...prev, ...files]);
    
    // Create preview URLs
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setEvidencePreviews(prev => [...prev, ...newPreviews]);
  };

  const handleRemoveEvidenceFile = (index: number) => {
    // Revoke the preview URL to prevent memory leaks
    URL.revokeObjectURL(evidencePreviews[index]);
    
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
    setEvidencePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleQualitySubmit = async () => {
    try {
      const qualityDataWithEvidence = {
        ...qualityData,
        generalNotes,
        evidenceFiles: evidenceFiles.length > 0 ? evidenceFiles : undefined
      };

      await processQualityReview(delivery.id, qualityDataWithEvidence);
      
      // Clear evidence files after successful upload
      setEvidenceFiles([]);
      setEvidencePreviews([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      loadDelivery();
    } catch (error) {
      console.error('Error processing quality review:', error);
    }
  };

  // Nueva función para habilitar re-edición de calidad
  const enableQualityReEdit = () => {
    // Activar modo de re-edición
    setIsReEditingQuality(true);
    
    // Reset quality data to allow re-editing
    const resetQualityData: any = { variants: {} };
    delivery.delivery_items?.forEach((item: any) => {
      resetQualityData.variants[item.id] = {
        approved: item.quantity_approved || 0,
        defective: item.quantity_defective || 0,
        reason: item.quality_notes || ''
      };
    });
    setQualityData(resetQualityData);
    
    toast({
      title: "Modo de re-edición activado",
      description: "Ahora puede modificar las cantidades aprobadas/defectuosas y resincronizar",
    });
  };

  // Función para cancelar re-edición
  const cancelQualityReEdit = () => {
    setIsReEditingQuality(false);
    // Restaurar datos originales
    const originalQualityData: any = { variants: {} };
    delivery.delivery_items?.forEach((item: any) => {
      originalQualityData.variants[item.id] = {
        approved: item.quantity_approved || 0,
        defective: item.quantity_defective || 0,
        reason: item.quality_notes || ''
      };
    });
    setQualityData(originalQualityData);
    
    toast({
      title: "Cancelado",
      description: "Cambios cancelados. Se han restaurado los valores originales.",
    });
  };

  // Función para guardar cambios de re-edición
  const saveQualityReEdit = async () => {
    try {
      // Validar que las cantidades sumen correctamente
      const hasErrors = delivery.delivery_items?.some((item: any) => {
        const variantData = qualityData.variants[item.id];
        const totalReviewed = (variantData?.approved || 0) + (variantData?.defective || 0);
        return totalReviewed !== item.quantity_delivered;
      });

      if (hasErrors) {
        toast({
          title: "Error de validación",
          description: "Las cantidades aprobadas + defectuosas deben sumar el total entregado para cada variante",
          variant: "destructive",
        });
        return;
      }

      // Actualizar todos los items
      for (const item of delivery.delivery_items || []) {
        const variantData = qualityData.variants[item.id];
        if (variantData) {
          await supabase
            .from('delivery_items')
            .update({
              quantity_approved: variantData.approved,
              quantity_defective: variantData.defective,
              quality_notes: variantData.reason || null,
              // Reset sync status if quantities changed
              synced_to_shopify: false,
              last_sync_attempt: null
            })
            .eq('id', item.id);
        }
      }

      setIsReEditingQuality(false);
      
      toast({
        title: "Cambios guardados",
        description: "Los cambios en la revisión de calidad han sido guardados. Puede resincronizar si es necesario.",
      });

      loadDelivery();
      onDeliveryUpdated?.();
    } catch (error) {
      console.error('Error saving quality re-edit:', error);
      toast({
        title: "Error",
        description: "Error al guardar los cambios",
        variant: "destructive",
      });
    }
  };

  // Función para resincronizar solo items que necesitan sincronización
  const resyncEntireDelivery = async () => {
    // Filtrar solo items que tienen cantidades aprobadas Y que NO están sincronizados
    const itemsToSync = delivery.delivery_items?.filter((item: any) => 
      item.quantity_approved > 0 && !item.synced_to_shopify
    );
    
    if (!itemsToSync || itemsToSync.length === 0) {
      toast({
        title: "Sin cambios pendientes",
        description: "No hay items que requieran sincronización. Todos los items aprobados ya están sincronizados con Shopify.",
        variant: "default",
      });
      return;
    }

    const confirmResync = window.confirm(
      `¿Desea sincronizar los cambios pendientes de la entrega ${delivery.tracking_number} con Shopify?\n\nSe sincronizarán ${itemsToSync.length} variante(s) con un total de ${itemsToSync.reduce((sum: number, item: any) => sum + item.quantity_approved, 0)} unidades aprobadas.\n\n⚠️ ATENCIÓN: Esto actualizará el inventario en Shopify solo con los cambios pendientes.`
    );

    if (!confirmResync) return;

    try {
      setSyncingVariants(new Set(itemsToSync.map((item: any) => item.id)));

      const syncData = {
        deliveryId: delivery.id,
        approvedItems: itemsToSync.map(item => ({
          variantId: item.order_items?.product_variants?.id,
          skuVariant: item.order_items?.product_variants?.sku_variant,
          quantityApproved: item.quantity_approved
        }))
      };

      const result = await syncApprovedItemsToShopify(syncData);

      if (result.success) {
        // Marcar solo las variantes procesadas como sincronizadas
        for (const item of itemsToSync) {
          await supabase
            .from('delivery_items')
            .update({
              synced_to_shopify: true,
              last_sync_attempt: new Date().toISOString()
            })
            .eq('id', item.id);
        }

        toast({
          title: "Cambios sincronizados",
          description: `${itemsToSync.length} variante(s) sincronizada(s) exitosamente con Shopify`,
        });

        loadDelivery();
        onDeliveryUpdated?.();
      }
    } catch (error) {
      console.error('Error resyncing delivery:', error);
      toast({
        title: "Error de resincronización",
        description: "Error al sincronizar los cambios con Shopify",
        variant: "destructive",
      });
    } finally {
      setSyncingVariants(new Set());
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_quality': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'partial_approved': return 'bg-orange-100 text-orange-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_quality': return 'En Revisión';
      case 'approved': return 'Aprobada';
      case 'partial_approved': return 'Parcial';
      case 'rejected': return 'Rechazada';
      default: return status;
    }
  };

  // Helper function to get individual item sync status
  const getItemSyncStatus = (item: any) => {
    const hasApproved = item.quantity_approved > 0;
    const hasDefective = item.quantity_defective > 0;
    const hasReviewed = hasApproved || hasDefective;
    const isSynced = item.synced_to_shopify;
    
    if (!hasReviewed) {
      return {
        text: 'En Revisión',
        variant: 'secondary' as const,
        color: 'bg-blue-100 text-blue-800'
      };
    }
    
    if (hasReviewed && !isSynced) {
      return {
        text: 'Guardado',
        variant: 'outline' as const,
        color: 'bg-yellow-100 text-yellow-800'
      };
    }
    
    if (hasApproved && isSynced) {
      return {
        text: 'Sincronizado',
        variant: 'default' as const,
        color: 'bg-green-100 text-green-800'
      };
    }
    
    // Caso especial: procesado pero sin unidades aprobadas (faltante)
    if (hasReviewed && !hasApproved && hasDefective) {
      return {
        text: 'Procesado',
        variant: 'destructive' as const,
        color: 'bg-red-100 text-red-800'
      };
    }
    
    return {
      text: 'Guardado',
      variant: 'outline' as const,
      color: 'bg-yellow-100 text-yellow-800'
    };
  };

  const getTotalQuantities = () => {
    if (!delivery.delivery_items) return { delivered: 0, approved: 0, defective: 0 };
    
    return delivery.delivery_items.reduce((totals: any, item: any) => ({
      delivered: totals.delivered + (item.quantity_delivered || 0),
      approved: totals.approved + (item.quantity_approved || 0),
      defective: totals.defective + (item.quantity_defective || 0)
    }), { delivered: 0, approved: 0, defective: 0 });
  };

  const getQualityTotals = () => {
    let totalApproved = 0;
    let totalDefective = 0;
    
    Object.values(qualityData.variants).forEach((variant: any) => {
      totalApproved += variant.approved || 0;
      totalDefective += variant.defective || 0;
    });
    
    return { totalApproved, totalDefective };
  };

  const getDiscrepancies = () => {
    const discrepancies: any[] = [];
    
    delivery.delivery_items?.forEach((item: any) => {
      const delivered = item.quantity_delivered || 0;
      const variantData = qualityData.variants[item.id] || {};
      const approved = variantData.approved || 0;
      const defective = variantData.defective || 0;
      const reviewed = approved + defective;
      
      // Only consider discrepancy if user has entered values (approved > 0 OR defective > 0)
      if ((approved > 0 || defective > 0) && delivered !== reviewed) {
        discrepancies.push({
          item,
          delivered,
          reviewed,
          difference: delivered - reviewed
        });
      }
    });
    
    return discrepancies;
  };

  const totals = getTotalQuantities();
  const qualityTotals = getQualityTotals();
  const discrepancies = getDiscrepancies();
  const canEdit = canEditDeliveries && ['pending', 'in_quality'].includes(delivery.status);
  const canProcessQuality = canEditDeliveries && (['pending', 'in_quality'].includes(delivery.status) || isReEditingQuality);
  const hasDiscrepancies = discrepancies.length > 0;

  // Get sorted delivery items
  const sortedDeliveryItems = getSortedDeliveryItems(delivery.delivery_items);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => onBack()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{delivery.tracking_number}</h1>
            <p className="text-muted-foreground">
              Orden: {delivery.orders?.order_number} • 
              Taller: {delivery.workshops?.name || 'Sin asignar'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(delivery.status)}>
            {getStatusText(delivery.status)}
          </Badge>
          
          {/* Botones de re-edición y resincronización para entregas procesadas */}
          {canEditDeliveries && ['approved', 'partial_approved'].includes(delivery.status) && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={enableQualityReEdit}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Re-editar Calidad
              </Button>
              
              {/* Solo mostrar botón de resincronización si hay ítems pendientes */}
              {getPendingSyncVariants().length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resyncEntireDelivery}
                  disabled={syncingVariants.size > 0}
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncingVariants.size > 0 ? 'animate-spin' : ''}`} />
                  {syncingVariants.size > 0 ? 'Resincronizando...' : 'Resincronizar Todo'}
                </Button>
              )}
            </>
          )}
          
        </div>
      </div>

      {/* Resumen de Revisión - Solo mostrar si ha sido procesada */}
      <DeliveryReviewSummary 
        delivery={delivery}
        totalDelivered={totals.delivered}
        totalApproved={totals.approved}
        totalDefective={totals.defective}
      />

      {/* Delivery Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información de la Entrega</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Fecha de Entrega</Label>
              <p className="font-medium">
                {delivery.delivery_date ? format(new Date(delivery.delivery_date), 'dd/MM/yyyy', { locale: es }) : 'Sin fecha'}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Total Entregado</Label>
              <p className="font-medium text-blue-600">{totals.delivered} unidades</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Estado de Sincronización</Label>
              <DeliverySyncStatus 
                delivery={delivery} 
                onSyncSuccess={loadDelivery} 
                size="sm"
              />
            </div>
          </div>
          {delivery.notes && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Notas</Label>
              <p className="text-sm bg-gray-50 p-3 rounded">{delivery.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Table - Modern Design */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-5 h-5" />
              <span>Items de la Entrega</span>
            </CardTitle>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                {isEditing ? 'Cancelar' : 'Editar Cantidades'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Variante</TableHead>
                  <TableHead className="text-center font-semibold text-blue-700">Entregadas</TableHead>
                  {(canProcessQuality || totals.approved > 0 || totals.defective > 0) && (
                    <>
                      <TableHead className="text-center font-semibold text-green-700">Aprobadas</TableHead>
                      <TableHead className="text-center font-semibold text-red-700">Defectuosas</TableHead>
                    </>
                  )}
                  {canProcessQuality && !isEditing && (
                    <TableHead className="font-semibold">Observaciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDeliveryItems?.map((item: any) => {
                  const delivered = item.quantity_delivered || 0;
                  const variantData = qualityData.variants[item.id] || {};
                  const approved = variantData.approved || 0;
                  const defective = variantData.defective || 0;
                  const reviewed = approved + defective;
                  const hasUserInput = approved > 0 || defective > 0;
                  const hasDiscrepancy = hasUserInput && delivered !== reviewed;
                  const isVariantReviewed = item.quantity_approved > 0 || item.quantity_defective > 0;
                  const canSaveVariant = hasUserInput && !hasDiscrepancy;
                  const canSyncVariant = item.quantity_approved > 0 && !item.synced_to_shopify;
                  
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/25">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">
                              {item.order_items?.product_variants?.products?.name}
                            </p>
                            {(() => {
                              const status = getItemSyncStatus(item);
                              return (
                                <Badge 
                                  variant={status.variant} 
                                  className={`text-xs ${status.color}`}
                                >
                                  {status.text}
                                </Badge>
                              );
                            })()}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              {item.order_items?.product_variants?.size}
                            </span>
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              {item.order_items?.product_variants?.color}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {item.order_items?.product_variants?.sku_variant}
                          </p>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            value={quantityData[item.id] || 0}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                            className="w-20 mx-auto text-center"
                          />
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-bold text-blue-600">{delivered}</span>
                          </div>
                        )}
                      </TableCell>

                      {(canProcessQuality || totals.approved > 0 || totals.defective > 0) && (
                        <>
                          <TableCell className="text-center">
                            {canProcessQuality && !isEditing ? (
                              <Input
                                type="number"
                                min="0"
                                max={delivered}
                                value={approved}
                                onChange={(e) => handleQualityChange(item.id, 'approved', parseInt(e.target.value) || 0)}
                                className="w-20 mx-auto text-center"
                              />
                            ) : (
                              <div className="flex flex-col items-center">
                                {approved > 0 && (
                                  <span className="text-lg font-bold text-green-600">{approved}</span>
                                )}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-center">
                            {canProcessQuality && !isEditing ? (
                              <Input
                                type="number"
                                min="0"
                                max={delivered}
                                value={defective}
                                onChange={(e) => handleQualityChange(item.id, 'defective', parseInt(e.target.value) || 0)}
                                className="w-20 mx-auto text-center"
                              />
                            ) : (
                              <div className="flex flex-col items-center">
                                {defective > 0 && (
                                  <span className="text-lg font-bold text-red-600">{defective}</span>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </>
                      )}

                      {canProcessQuality && !isEditing && (
                        <TableCell>
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Observaciones..."
                              value={variantData.reason || ''}
                              onChange={(e) => handleQualityChange(item.id, 'reason', e.target.value)}
                              rows={2}
                              className="text-sm resize-none"
                            />
                            {hasDiscrepancy && (
                              <p className="text-orange-600 text-xs">
                                ⚠️ Total revisadas: {reviewed} (entregadas: {delivered})
                              </p>
                            )}
                            
                            {/* Botones de acciones por variante */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {canSaveVariant && !item.synced_to_shopify && (
                                (() => {
                                  const isLast = isLastUnsavedVariant(item.id);
                                  const pendingSync = getPendingSyncVariants().length;
                                  
                                  return (
                                    <Button
                                      size="sm"
                                      variant={isLast ? "default" : "outline"}
                                      onClick={() => saveVariantQuality(item.id, isLast)}
                                      className={`text-xs ${isLast ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                                    >
                                      <Save className="w-3 h-3 mr-1" />
                                      {isLast ? 
                                        `Guardar y Finalizar Revisión${pendingSync > 0 ? ` (${pendingSync} a sincronizar)` : ''}` : 
                                        'Guardar'
                                      }
                                    </Button>
                                  );
                                })()
                              )}
                              
                              {canSyncVariant && !isLastUnsavedVariant(item.id) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => syncVariantToShopify(item.id)}
                                  disabled={syncingVariants.has(item.id)}
                                  className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700"
                                >
                                  <RefreshCw className={`w-3 h-3 mr-1 ${syncingVariants.has(item.id) ? 'animate-spin' : ''}`} />
                                  {syncingVariants.has(item.id) ? 'Sincronizando...' : 'Sincronizar'}
                                </Button>
                              )}
                              
                              {item.sync_attempt_count > 0 && !item.synced_to_shopify && item.sync_error_message && (
                                <div className="text-xs text-red-600">
                                  {item.sync_attempt_count} intento(s) fallidos
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Quality Control Actions - Only for users WITH QC permissions */}
          {canProcessQuality && (
            <div className="mt-6 space-y-6">
              {/* Save quantities button when editing */}
              {isEditing && (
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveQuantities} disabled={loading}>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Cambios
                  </Button>
                </div>
              )}

              {/* Quality Summary */}
              {!isEditing && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Total Entregadas</Label>
                    <p className="text-2xl font-bold text-blue-600">{totals.delivered}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Total Aprobadas</Label>
                    <p className="text-2xl font-bold text-green-600">{qualityTotals.totalApproved}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Total Defectuosas</Label>
                    <p className="text-2xl font-bold text-red-600">{qualityTotals.totalDefective}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Total Revisadas</Label>
                    <p className="text-2xl font-bold text-purple-600">{qualityTotals.totalApproved + qualityTotals.totalDefective}</p>
                  </div>
                </div>
              )}

              {/* General Notes */}
              {!isEditing && (
                <div>
                  <Label className="text-sm font-medium">Notas Generales de Calidad</Label>
                  <Textarea
                    placeholder="Comentarios adicionales sobre la entrega..."
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              {/* Evidence Upload Section */}
              {!isEditing && (
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Evidencia Fotográfica (Opcional)</Label>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleEvidenceFilesSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center space-x-2"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Subir Fotos de Evidencia</span>
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        (Máximo 10 archivos, 5MB cada uno)
                      </span>
                    </div>

                    {/* Preview Selected Files */}
                    {evidenceFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Archivos seleccionados:</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {evidenceFiles.map((file, index) => (
                            <div key={index} className="relative group">
                              <div className="aspect-square rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
                                <img
                                  src={evidencePreviews[index]}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="absolute top-1 right-1">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleRemoveEvidenceFile(index)}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                              <p className="text-xs text-center mt-1 truncate">{file.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botones para modo de re-edición */}
              {isReEditingQuality && (
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline"
                    onClick={cancelQualityReEdit}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button 
                    onClick={saveQualityReEdit}
                    disabled={loading}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Cambios
                  </Button>
                </div>
              )}

              {!isEditing && !isReEditingQuality && (
                <div className="flex justify-end">
                  <Button 
                    onClick={handleQualitySubmit} 
                    disabled={loading || hasDiscrepancies}
                    className={hasDiscrepancies ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Procesar Control de Calidad
                  </Button>
                </div>
              )}

              {hasDiscrepancies && !isEditing && !isReEditingQuality && (
                <p className="text-sm text-orange-600 text-center">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Corrige las discrepancias antes de procesar el control de calidad
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información de Pago */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5" />
            <span>Información de Pago</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeliveryPaymentManager deliveryId={delivery.id} />
        </CardContent>
      </Card>

      {/* Archivos de Cuenta de Cobro/Remisión */}
      <DeliveryInvoiceFiles deliveryId={delivery.id} />

      {/* Evidence Gallery - NOW SHOWN TO ALL USERS */}
      <DeliveryEvidenceGallery deliveryId={delivery.id} />
    </div>
  );
};

export default DeliveryDetails;
