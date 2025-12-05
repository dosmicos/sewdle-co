import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Printer, Package, User, MapPin, FileText, Loader2, Tags, CheckCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { OrderTagsManager } from '@/components/OrderTagsManager';
import { usePickingOrders, OperationalStatus, PickingOrder } from '@/hooks/usePickingOrders';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

interface ShopifyLineItem {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  price: number;
  quantity: number;
  product_id: number | null;
  variant_id: number | null;
  image_url: string | null;
  shopify_line_item_id: number;
  properties: { name: string; value: string }[] | null;
}

interface PickingOrderDetailsModalProps {
  orderId: string;
  onClose: () => void;
  allOrderIds: string[];
  onNavigate: (orderId: string) => void;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  picking: 'bg-blue-100 text-blue-800',
  packing: 'bg-purple-100 text-purple-800',
  ready_to_ship: 'bg-green-100 text-green-800',
  shipped: 'bg-gray-100 text-gray-800',
};

const statusLabels = {
  pending: 'Por Procesar',
  picking: 'Picking en Proceso',
  packing: 'Empacando',
  ready_to_ship: 'Empacado',
  shipped: 'Enviado',
};

export const PickingOrderDetailsModal: React.FC<PickingOrderDetailsModalProps> = ({ 
  orderId, 
  onClose,
  allOrderIds,
  onNavigate
}) => {
  const { orders, updateOrderStatus, updateOrderNotes, updateShopifyNote } = usePickingOrders();
  const [notes, setNotes] = useState('');
  const [shopifyNote, setShopifyNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingShopifyNote, setIsSavingShopifyNote] = useState(false);
  const [lineItems, setLineItems] = useState<ShopifyLineItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [localOrder, setLocalOrder] = useState<PickingOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [packedByName, setPackedByName] = useState<string | null>(null);

  const order = orders.find(o => o.id === orderId);
  const effectiveOrder = localOrder || order;

  // Navigation logic
  const currentIndex = allOrderIds.indexOf(orderId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allOrderIds.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      onNavigate(allOrderIds[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onNavigate(allOrderIds[currentIndex + 1]);
    }
  };

  // Keyboard navigation - J for previous, K for next, Ctrl+. for mark as packed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Ctrl + . → Marcar como Empacado
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        // Block if loading or data not synced with current orderId
        if (loadingOrder || localOrder?.id !== orderId) {
          console.log('⏳ Esperando carga de orden antes de marcar como empacado...');
          return;
        }
        // Only trigger if order is not already packed and not currently updating
        if (localOrder?.operational_status !== 'ready_to_ship' && !updatingStatus && !localOrder?.shopify_order?.cancelled_at) {
          handleMarkAsPackedAndPrint();
        }
        return;
      }
      
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (hasPrevious) {
          onNavigate(allOrderIds[currentIndex - 1]);
        }
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (hasNext) {
          onNavigate(allOrderIds[currentIndex + 1]);
        }
      }
    };

    if (orderId) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [orderId, currentIndex, allOrderIds, hasPrevious, hasNext, onNavigate, localOrder, loadingOrder, updatingStatus]);

  // Fetch packed_by user name
  useEffect(() => {
    const fetchPackedByName = async () => {
      const packedById = effectiveOrder?.packed_by;
      if (!packedById) {
        setPackedByName(null);
        return;
      }
      
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', packedById)
        .single();
      
      setPackedByName(data?.name || null);
    };
    
    fetchPackedByName();
  }, [effectiveOrder?.packed_by]);

  const refetchOrder = async () => {
    setLoadingOrder(true);
    try {
      const { data, error } = await supabase
        .from('picking_packing_orders')
        .select(`
          *,
          shopify_order:shopify_orders(
            id,
            shopify_order_id,
            order_number,
            email,
            created_at_shopify,
            financial_status,
            fulfillment_status,
            customer_first_name,
            customer_last_name,
            customer_phone,
            customer_email,
            total_price,
            currency,
            note,
            tags,
            cancelled_at,
            raw_data
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      
      setLocalOrder({
        ...data,
        line_items: []
      } as PickingOrder);
    } catch (error) {
      console.error('❌ Error fetching order:', error);
    } finally {
      setLoadingOrder(false);
    }
  };

  // Always fetch order to get raw_data with financial details
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;
      await refetchOrder();
    };

    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    if (effectiveOrder?.internal_notes) {
      setNotes(effectiveOrder.internal_notes);
    }
    if (effectiveOrder?.shopify_order?.note) {
      setShopifyNote(effectiveOrder.shopify_order.note);
    } else {
      setShopifyNote('');
    }
  }, [effectiveOrder]);

  // Reset local state when orderId changes
  useEffect(() => {
    setLocalOrder(null);
    setNotes('');
    setShopifyNote('');
    setLineItems([]);
    setLoadingItems(true);
  }, [orderId]);

  // Fetch line items separately
  useEffect(() => {
    // Helper function to fetch images from Shopify API (optimized)
    const fetchImageFromShopify = async (productId: number, variantId: number): Promise<string | null> => {
      try {
        const { data, error } = await supabase.functions.invoke('get-shopify-variant-image', {
          body: { product_id: productId, variant_id: variantId }
        });
        
        if (error) {
          console.error('Error fetching image:', error);
          return null;
        }
        
        return data?.image_url || null;
      } catch (error) {
        console.error('Error fetching image from Shopify:', error);
        return null;
      }
    };

    const fetchLineItems = async () => {
      if (!effectiveOrder?.shopify_order?.shopify_order_id) return;
      
      setLoadingItems(true);
      try {
        const { data, error } = await supabase
          .from('shopify_order_line_items')
          .select('id, title, variant_title, sku, price, quantity, product_id, variant_id, image_url, shopify_line_item_id, properties')
          .eq('shopify_order_id', effectiveOrder.shopify_order.shopify_order_id);
        
        if (error) throw error;
        
        // Enrich line items - Priority: Shopify API > raw_data > local products
        const rawLineItems = effectiveOrder.shopify_order.raw_data?.line_items || [];
        let enrichedItems = (data as ShopifyLineItem[]).map(item => {
          const rawItem = rawLineItems.find((ri: any) => ri.id === item.shopify_line_item_id);
          return {
            ...item,
            // Keep fallback image for now, will be replaced by Shopify API image if available
            fallback_image_url: item.image_url || rawItem?.image?.src || rawItem?.featured_image || null,
            image_url: null // Reset to fetch from Shopify API
          };
        });
        
        // ALWAYS fetch images from Shopify API for items with product_id and variant_id
        // This ensures we get the correct variant-specific image
        const itemsWithShopifyIds = enrichedItems.filter(item => item.product_id && item.variant_id);
        if (itemsWithShopifyIds.length > 0) {
          console.log(`🖼️ Fetching ${itemsWithShopifyIds.length} variant images from Shopify API...`);
          
          // Get images from Shopify in parallel
          const imagePromises = itemsWithShopifyIds.map(async (item) => {
            const shopifyImage = await fetchImageFromShopify(item.product_id!, item.variant_id!);
            return { sku: item.sku, image_url: shopifyImage };
          });
          
          const shopifyImages = await Promise.all(imagePromises);
          const skuToShopifyImageMap = new Map(
            shopifyImages.map(img => [img.sku, img.image_url])
          );
          
          // Apply Shopify API images (priority) or fallback to saved image
          enrichedItems = enrichedItems.map(item => ({
            ...item,
            image_url: skuToShopifyImageMap.get(item.sku) || (item as any).fallback_image_url || null
          }));
        } else {
          // No Shopify IDs available, use fallback images
          enrichedItems = enrichedItems.map(item => ({
            ...item,
            image_url: (item as any).fallback_image_url || null
          }));
        }
        
        // Final fallback: query product_variants (only if still no image)
        const itemsStillWithoutImages = enrichedItems.filter(item => !item.image_url && item.sku);
        if (itemsStillWithoutImages.length > 0) {
          console.log(`⚠️ ${itemsStillWithoutImages.length} items still without images, using local fallback...`);
          const skus = itemsStillWithoutImages.map(item => item.sku).filter((sku): sku is string => Boolean(sku));
          
          const variantResult = await supabase
            .from('product_variants')
            .select('sku_variant, products(image_url)')
            .in('sku_variant', skus);
          
          const variantData = variantResult.data as Array<{ sku_variant: string; products: { image_url: string | null } | null }> | null;
          
          if (variantData) {
            const skuToImageMap = new Map<string, string | null>();
            variantData.forEach((v) => {
              if (v.sku_variant) {
                skuToImageMap.set(v.sku_variant, v.products?.image_url || null);
              }
            });
            
            enrichedItems = enrichedItems.map(item => ({
              ...item,
              image_url: item.image_url || (item.sku ? skuToImageMap.get(item.sku) || null : null)
            }));
          }
        }
        
        setLineItems(enrichedItems);
      } catch (error) {
        console.error('Error fetching line items:', error);
        setLineItems([]);
      }
      setLoadingItems(false);
    };

    fetchLineItems();
  }, [effectiveOrder?.shopify_order?.shopify_order_id, effectiveOrder?.shopify_order?.raw_data]);

  // Use useCallback with explicit dependencies to prevent stale closures
  const handleStatusChange = useCallback(async (newStatus: OperationalStatus) => {
    // Verify we have the correct order loaded
    if (!localOrder || localOrder.id !== orderId) {
      console.error(`❌ handleStatusChange: Orden no sincronizada (localOrder.id=${localOrder?.id}, orderId=${orderId})`);
      return;
    }
    
    const currentShopifyOrderId = localOrder.shopify_order?.shopify_order_id;
    if (!currentShopifyOrderId) {
      console.error('❌ handleStatusChange: shopify_order_id no disponible');
      return;
    }
    
    console.log(`🔄 Actualizando estado de orden #${localOrder.shopify_order?.order_number} a ${newStatus}`);
    setUpdatingStatus(true);
    
    // Optimistic update - instant UI feedback with new tag and packed info
    const statusTagMap = {
      pending: 'PENDIENTE',
      picking: 'PICKING_EN_PROCESO',
      packing: 'EMPACANDO',
      ready_to_ship: 'EMPACADO',
      shipped: 'ENVIADO'
    };
    
    const existingTags = localOrder.shopify_order?.tags || '';
    const existingTagsArray = existingTags.split(',').map(t => t.trim()).filter(Boolean);
    const newTag = statusTagMap[newStatus];
    
    // Add new tag if not already present
    const updatedTags = existingTagsArray.includes(newTag)
      ? existingTags
      : [...existingTagsArray, newTag].join(', ');
    
    // Get current user for optimistic update
    const { data: { user } } = await supabase.auth.getUser();
    
    setLocalOrder({
      ...localOrder,
      operational_status: newStatus,
      // Set packed_at and packed_by for ready_to_ship
      ...(newStatus === 'ready_to_ship' ? {
        packed_at: new Date().toISOString(),
        packed_by: user?.id
      } : {}),
      shopify_order: localOrder.shopify_order ? {
        ...localOrder.shopify_order,
        tags: updatedTags
      } : undefined
    });
    
    // Also set current user name optimistically
    if (newStatus === 'ready_to_ship' && user?.id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();
      setPackedByName(profileData?.name || null);
    }
    
    try {
      // Update in database and Shopify - pass shopify_order_id directly from localOrder
      await updateOrderStatus(orderId, newStatus, currentShopifyOrderId);
      
      // SUCCESS: Keep the optimistic update (don't refetch)
      
    } catch (error) {
      console.error('Error updating status:', error);
      // ONLY on error: Refetch to get actual state and rollback
      await refetchOrder();
    } finally {
      setUpdatingStatus(false);
    }
  }, [orderId, localOrder, updateOrderStatus, refetchOrder]);

  const handleSaveNotes = async () => {
    setIsSaving(true);
    await updateOrderNotes(orderId, notes);
    setIsSaving(false);
  };

  const handleSaveShopifyNote = async () => {
    if (!effectiveOrder?.shopify_order?.shopify_order_id) return;
    
    setIsSavingShopifyNote(true);
    try {
      await updateShopifyNote(effectiveOrder.shopify_order.shopify_order_id.toString(), shopifyNote);
      
      // Update local state optimistically
      setLocalOrder(prev => prev ? {
        ...prev,
        shopify_order: {
          ...prev.shopify_order,
          note: shopifyNote
        }
      } : prev);
      
      // Re-fetch to confirm
      await refetchOrder();
    } catch (error) {
      console.error('Error saving Shopify note:', error);
    } finally {
      setIsSavingShopifyNote(false);
    }
  };

  // Use useCallback with localOrder to prevent stale closures
  const handlePrint = useCallback(() => {
    // Use localOrder directly to ensure we print the correct order
    if (!localOrder?.shopify_order_id) {
      console.warn('⚠️ handlePrint: Orden no cargada completamente, shopify_order_id no disponible');
      return;
    }
    console.log(`🖨️ Imprimiendo orden ${localOrder.shopify_order?.order_number} (shopify_order_id: ${localOrder.shopify_order_id})`);
    window.open(`/picking-packing/print/${localOrder.shopify_order_id}`, '_blank');
  }, [localOrder?.shopify_order_id, localOrder?.shopify_order?.order_number]);

  const handleMarkAsPackedAndPrint = useCallback(() => {
    // Verify consistency: localOrder must match current orderId
    if (localOrder?.id !== orderId) {
      console.warn(`⚠️ handleMarkAsPackedAndPrint: Orden no sincronizada (localOrder.id=${localOrder?.id}, orderId=${orderId})`);
      return;
    }
    if (!localOrder?.shopify_order?.shopify_order_id) {
      console.warn('⚠️ handleMarkAsPackedAndPrint: shopify_order_id no disponible');
      return;
    }
    
    console.log(`📦 Marcando como empacado: Orden #${localOrder.shopify_order.order_number}`);
    handlePrint();
    handleStatusChange('ready_to_ship');
  }, [orderId, localOrder, handlePrint, handleStatusChange]);

  const formatCurrency = (amount?: number, currency?: string) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Show loading state
  if (loadingOrder) {
    return (
      <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3">Cargando orden...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!effectiveOrder) {
    return (
      <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No se encontró la orden</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const shippingAddress = effectiveOrder.shopify_order?.raw_data?.shipping_address;
  const financialSummary = effectiveOrder.shopify_order?.raw_data || {};
  
  // Shipping type detection
  const shippingLines = effectiveOrder.shopify_order?.raw_data?.shipping_lines || [];
  const shippingMethod = shippingLines[0]?.title || null;
  
  const getShippingType = (shippingTitle: string | null) => {
    if (!shippingTitle) return null;
    const title = shippingTitle.toLowerCase();
    
    if (title.includes('express')) {
      return { label: 'Express', className: 'bg-red-500 text-white border-red-600', icon: '🚀' };
    }
    if (title.includes('recog') || title.includes('pickup') || title.includes('tienda') || title.includes('local') || title.includes('dosmicos')) {
      return { label: 'Recoger', className: 'bg-yellow-400 text-black border-yellow-500', icon: '🏪' };
    }
    return { label: 'Standard', className: 'bg-green-500 text-white border-green-600', icon: '📦' };
  };
  
  const shippingType = getShippingType(shippingMethod);
  
  const rawPaymentGateways = effectiveOrder.shopify_order?.raw_data?.payment_gateway_names;
  const paymentGateways = Array.isArray(rawPaymentGateways) 
    ? rawPaymentGateways 
    : (typeof rawPaymentGateways === 'string' ? [rawPaymentGateways] : []);
  
  const formatPaymentMethod = (gateway: string): string => {
    if (gateway.toLowerCase().includes('cash on delivery')) {
      return 'Contraentrega';
    }
    return gateway;
  };
  
  const paymentMethod = paymentGateways.length > 0 
    ? formatPaymentMethod(paymentGateways[0]) 
    : null;

  console.log('🔍 DEBUG Payment Method:', {
    rawPaymentGateways,
    paymentGateways,
    paymentMethod,
    order_number: effectiveOrder.shopify_order?.order_number,
    has_raw_data: !!effectiveOrder.shopify_order?.raw_data
  });

  return (
    <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <DialogTitle className="text-2xl">
                    Orden #{effectiveOrder.shopify_order?.order_number}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {effectiveOrder.shopify_order?.created_at_shopify 
                      ? new Date(effectiveOrder.shopify_order.created_at_shopify).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : ''
                    }
                  </p>
                </div>
                
                {effectiveOrder.shopify_order?.cancelled_at && (
                  <Badge variant="destructive" className="bg-red-600">
                    ⚠️ ORDEN CANCELADA
                  </Badge>
                )}
                
                <Badge className={statusColors[effectiveOrder.operational_status]}>
                  {statusLabels[effectiveOrder.operational_status]}
                </Badge>
                {effectiveOrder.shopify_order?.financial_status === 'pending' && paymentMethod !== 'Contraentrega' && (
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                    Pago Pendiente
                  </Badge>
                )}
                {paymentMethod && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                    💳 {paymentMethod}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Shipping Type Badge */}
                {shippingType && (
                  <Badge className={`${shippingType.className} font-bold text-sm px-3 py-1 shadow-sm`}>
                    {shippingType.icon} {shippingType.label}
                  </Badge>
                )}
                
                <Button onClick={handlePrint} variant="outline" className="gap-2">
                  <Printer className="w-4 h-4" />
                  Imprimir
                </Button>
                
                {/* Navigation buttons */}
                <div className="flex items-center gap-1 ml-2 border-l pl-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrevious}
                    disabled={!hasPrevious}
                    className="h-9 w-9"
                    title="Pedido anterior (J)"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNext}
                    disabled={!hasNext}
                    className="h-9 w-9"
                    title="Siguiente pedido (K)"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Left Column - Products */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Productos ({lineItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lineItems.map((item, index: number) => (
                    <div key={index} className="flex gap-4 p-4 border rounded-lg">
                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.title}
                            className="w-32 h-32 object-cover rounded-lg border"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML = '<div class="w-32 h-32 bg-muted rounded-lg flex items-center justify-center"><svg class="w-12 h-12 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg></div>';
                            }}
                          />
                        ) : (
                          <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center border">
                            <Package className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 space-y-2">
                        <div>
                          <h4 className="font-semibold text-lg">
                            {item.title}
                          </h4>
                          {item.variant_title && (
                            <p className="text-sm text-muted-foreground">
                              {item.variant_title}
                            </p>
                          )}
                          {/* Custom Properties - Para bordados y personalizaciones */}
                          {item.properties && item.properties.length > 0 && (
                            <div className="mt-2 space-y-1 p-2 bg-amber-50 border border-amber-200 rounded-md">
                              {item.properties.map((prop, propIndex) => (
                                <div key={propIndex} className="flex items-start gap-2 text-sm">
                                  <span className="text-amber-700 font-medium">{prop.name}:</span>
                                  <span className="text-amber-900">{prop.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">SKU: </span>
                            <span className="font-medium">{item.sku || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Precio: </span>
                            <span className="font-medium">
                              {formatCurrency(item.price, effectiveOrder.shopify_order?.currency)}
                            </span>
                          </div>
                        </div>

                        {/* Quantity Highlighted */}
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Cantidad:</span>
                          <span className="text-3xl font-bold text-primary">
                            {item.quantity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Financial Summary - Compact */}
              <div className="px-4 py-3 bg-muted/30 rounded-lg border border-muted">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(financialSummary.subtotal_price, effectiveOrder.shopify_order?.currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Envío</span>
                    <span className="font-medium">{formatCurrency(financialSummary.total_shipping_price_set?.shop_money?.amount, effectiveOrder.shopify_order?.currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Impuestos</span>
                    <span className="font-medium">{formatCurrency(financialSummary.total_tax, effectiveOrder.shopify_order?.currency)}</span>
                  </div>
                  <Separator className="my-1.5" />
                  <div className="flex justify-between text-sm font-semibold pt-1">
                    <span>Total</span>
                    <span>{formatCurrency(financialSummary.total_price, effectiveOrder.shopify_order?.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Status Actions - Only show when cancelled or already packed */}
              {(effectiveOrder.shopify_order?.cancelled_at || effectiveOrder.operational_status === 'ready_to_ship') && (
                <Card>
                  <CardHeader>
                    <CardTitle>Estado</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {effectiveOrder.shopify_order?.cancelled_at ? (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800 font-medium">
                          ⚠️ Esta orden fue cancelada en Shopify el {new Date(effectiveOrder.shopify_order.cancelled_at).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <p className="text-xs text-red-600 mt-2">
                          No se pueden realizar acciones de picking/packing en órdenes canceladas.
                        </p>
                      </div>
                    ) : effectiveOrder.operational_status === 'ready_to_ship' && effectiveOrder.packed_at && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                        <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                          <CheckCircle className="w-4 h-4" />
                          <span>Empacado</span>
                        </div>
                        <div className="space-y-1 text-green-700">
                          <p className="flex items-center gap-2">
                            <span>📅</span>
                            <span>{new Date(effectiveOrder.packed_at).toLocaleDateString('es-CO', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</span>
                          </p>
                          {packedByName && (
                            <p className="flex items-center gap-2">
                              <span>👤</span>
                              <span>Por: {packedByName}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="space-y-4">
              {/* Notas de Shopify - Bidirectional Sync */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Notas de Shopify
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Textarea
                    value={shopifyNote}
                    onChange={(e) => setShopifyNote(e.target.value)}
                    placeholder="Agregar notas visibles en Shopify..."
                    className="min-h-[100px] text-sm"
                    disabled={!!effectiveOrder?.shopify_order?.cancelled_at}
                  />
                  <Button
                    onClick={handleSaveShopifyNote}
                    disabled={isSavingShopifyNote || !!effectiveOrder?.shopify_order?.cancelled_at}
                    size="sm"
                    className="w-full"
                  >
                    {isSavingShopifyNote ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Nota en Shopify'
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    ℹ️ Los cambios se sincronizan automáticamente con Shopify
                  </p>
                </CardContent>
              </Card>

              {/* Shopify Tags */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tags className="w-4 h-4" />
                    Etiquetas de Shopify
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderTagsManager
                    orderId={effectiveOrder.id}
                    shopifyOrderId={effectiveOrder.shopify_order.shopify_order_id}
                    currentTags={effectiveOrder.shopify_order.tags || ''}
                    onTagsUpdate={(newTags) => {
                      setLocalOrder(prev => prev ? {
                        ...prev,
                        shopify_order: {
                          ...prev.shopify_order,
                          tags: newTags
                        }
                      } : prev);
                    }}
                  />
                </CardContent>
              </Card>

              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-medium">
                    {effectiveOrder.shopify_order?.customer_first_name} {effectiveOrder.shopify_order?.customer_last_name}
                  </p>
                  <p className="text-muted-foreground">{effectiveOrder.shopify_order?.customer_email}</p>
                  {effectiveOrder.shopify_order?.customer_phone && (
                    <p className="text-muted-foreground">{effectiveOrder.shopify_order.customer_phone}</p>
                  )}
                </CardContent>
              </Card>

              {/* Shipping Address */}
              {shippingAddress && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Dirección de Envío
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p className="font-medium">{shippingAddress.name}</p>
                    <p>{shippingAddress.address1}</p>
                    {shippingAddress.address2 && <p>{shippingAddress.address2}</p>}
                    <p>
                      {shippingAddress.city}, {shippingAddress.province} {shippingAddress.zip}
                    </p>
                    <p>{shippingAddress.country}</p>
                    {shippingAddress.phone && (
                      <p className="text-muted-foreground">{shippingAddress.phone}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Floating Action Button - Fixed at bottom right of modal */}
        {!effectiveOrder.shopify_order?.cancelled_at && effectiveOrder.operational_status !== 'ready_to_ship' && (
          <div className="absolute bottom-4 right-4 z-10 pointer-events-none">
            <Button
              onClick={handleMarkAsPackedAndPrint}
              disabled={updatingStatus}
              title="Ctrl + . para marcar rápidamente"
              className="h-14 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base gap-2 pointer-events-auto"
            >
              {updatingStatus ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Package className="w-5 h-5" />
                  Marcar como Empacado
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};