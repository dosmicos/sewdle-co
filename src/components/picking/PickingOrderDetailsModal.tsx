import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Printer, Package, User, MapPin, FileText, Loader2, Tags, CheckCircle, ChevronUp, ChevronDown, Truck, ScanLine, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { OrderTagsManager } from '@/components/OrderTagsManager';
import { usePickingOrders, OperationalStatus, PickingOrder } from '@/hooks/usePickingOrders';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EnviaShippingButton, ShippingLabel, CARRIER_NAMES, CarrierCode } from '@/features/shipping';

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
  const [shippingLabel, setShippingLabel] = useState<ShippingLabel | null>(null);
  const financialSummaryRef = useRef<HTMLDivElement>(null);
  
  // SKU Verification states
  const [skuInput, setSkuInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    status: 'correct' | 'incorrect' | 'already_verified';
    item?: ShopifyLineItem;
    scannedCount?: number;
    requiredCount?: number;
  } | null>(null);
  const [verifiedCounts, setVerifiedCounts] = useState<Map<string, number>>(new Map());
  
  // Scroll hint state
  const [showScrollHint, setShowScrollHint] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Ref to hold the latest handleMarkAsPackedAndPrint to avoid stale closure in useEffect
  const handleMarkAsPackedAndPrintRef = useRef<() => void>(() => {});

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
          toast.info('Cargando orden, intenta de nuevo...', { duration: 2000 });
          return;
        }
        // Block if already updating
        if (updatingStatus) {
          toast.info('Procesando, espera un momento...', { duration: 2000 });
          return;
        }
        // Only trigger if order is not already packed and not cancelled
        if (localOrder?.operational_status !== 'ready_to_ship' && !localOrder?.shopify_order?.cancelled_at) {
          // Use ref to get latest function without circular dependency
          handleMarkAsPackedAndPrintRef.current();
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

  const refetchOrder = useCallback(async (targetOrderId: string) => {
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
        .eq('id', targetOrderId)
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
  }, []);

  // Always fetch order to get raw_data with financial details - with AbortController
  useEffect(() => {
    if (!orderId) return;
    
    const abortController = new AbortController();
    let isCancelled = false;

    const fetchOrder = async () => {
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
          .abortSignal(abortController.signal)
          .single();

        // Ignore if cancelled while waiting
        if (isCancelled) {
          console.log(`🚫 Ignorando respuesta obsoleta para orden ${orderId}`);
          return;
        }

        if (error) throw error;
        
        setLocalOrder({
          ...data,
          line_items: []
        } as PickingOrder);
      } catch (error: any) {
        // Ignore abort errors (expected)
        if (error.name === 'AbortError' || isCancelled) {
          console.log(`🚫 Solicitud cancelada para orden ${orderId}`);
          return;
        }
        console.error('❌ Error fetching order:', error);
      } finally {
        if (!isCancelled) {
          setLoadingOrder(false);
        }
      }
    };

    fetchOrder();

    // Cleanup: cancel request if orderId changes
    return () => {
      isCancelled = true;
      abortController.abort();
    };
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
    // Reset SKU verification states
    setSkuInput('');
    setVerificationResult(null);
    setVerifiedCounts(new Map());
    setShowScrollHint(false);
  }, [orderId]);

  // Show scroll hint when lineItems load and there are 3 or more
  useEffect(() => {
    if (lineItems.length >= 3) {
      setShowScrollHint(true);
    }
  }, [lineItems.length]);

  // Hide scroll hint when financial summary section becomes visible, show again when scrolling up
  const handleContentScroll = useCallback(() => {
    if (contentRef.current && financialSummaryRef.current && lineItems.length >= 3) {
      const containerRect = contentRef.current.getBoundingClientRect();
      const financialRect = financialSummaryRef.current.getBoundingClientRect();
      
      // If the financial summary section is visible within the container
      const isTotalsVisible = financialRect.top < containerRect.bottom;
      
      if (isTotalsVisible) {
        setShowScrollHint(false);
      } else {
        setShowScrollHint(true);
      }
    }
  }, [lineItems.length]);

  // SKU verification function - now tracks quantity
  const handleSkuVerification = useCallback((inputSku: string) => {
    if (!inputSku.trim()) {
      setVerificationResult(null);
      return;
    }
    
    const normalizedInput = inputSku.trim().toLowerCase();
    
    // Search for SKU in order line items (skip "Bordado Personalizado" - it's a service, not a physical product)
    const matchingItem = lineItems.find(item => {
      if (item.title?.toLowerCase() === 'bordado personalizado') return false;
      return item.sku?.toLowerCase() === normalizedInput;
    });
    
    if (matchingItem && matchingItem.sku) {
      const currentCount = verifiedCounts.get(matchingItem.sku) || 0;
      const requiredCount = matchingItem.quantity;
      
      if (currentCount < requiredCount) {
        // Increment verification counter
        const newCount = currentCount + 1;
        setVerifiedCounts(prev => new Map(prev).set(matchingItem.sku!, newCount));
        
        setVerificationResult({ 
          status: 'correct', 
          item: matchingItem,
          scannedCount: newCount,
          requiredCount: requiredCount
        });
      } else {
        // Already verified all units
        setVerificationResult({ 
          status: 'already_verified', 
          item: matchingItem 
        });
      }
    } else {
      setVerificationResult({ status: 'incorrect' });
    }
    
    // Clear input after 1.5s for continuous scanning
    setTimeout(() => setSkuInput(''), 1500);
  }, [lineItems, verifiedCounts]);

  // Calculate verification totals (exclude "Bordado Personalizado" - it's a service, not a physical product)
  const totalVerifiedUnits = Array.from(verifiedCounts.values()).reduce((sum, count) => sum + count, 0);
  const totalRequiredUnits = lineItems
    .filter(item => item.title?.toLowerCase() !== 'bordado personalizado')
    .reduce((sum, item) => sum + item.quantity, 0);

  // Fetch line items separately - with isCancelled check
  useEffect(() => {
    let isCancelled = false;
    
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
      // Capture current shopify_order_id at start
      const currentShopifyOrderId = effectiveOrder?.shopify_order?.shopify_order_id;
      if (!currentShopifyOrderId) return;
      
      setLoadingItems(true);
      try {
        const { data, error } = await supabase
          .from('shopify_order_line_items')
          .select('id, title, variant_title, sku, price, quantity, product_id, variant_id, image_url, shopify_line_item_id, properties')
          .eq('shopify_order_id', currentShopifyOrderId);
        
        // Check if cancelled or shopify_order_id changed while waiting
        if (isCancelled || effectiveOrder?.shopify_order?.shopify_order_id !== currentShopifyOrderId) {
          console.log('🚫 Ignorando line items de orden anterior');
          return;
        }
        
        if (error) throw error;
        
        // Enrich line items - Priority: Shopify API > raw_data > local products
        const rawLineItems = effectiveOrder.shopify_order?.raw_data?.line_items || [];
        let enrichedItems = (data as ShopifyLineItem[]).map(item => {
          const rawItem = rawLineItems.find((ri: any) => ri.id === item.shopify_line_item_id);
          return {
            ...item,
            // Keep fallback image for now, will be replaced by Shopify API image if available
            fallback_image_url: item.image_url || rawItem?.image?.src || rawItem?.featured_image || null,
            image_url: null // Reset to fetch from Shopify API
          };
        });
        
        // Check again before making more async calls
        if (isCancelled) return;
        
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
          
          // Check again after parallel fetch
          if (isCancelled) return;
          
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
        
        // Check before final async operation
        if (isCancelled) return;
        
        // Final fallback: query product_variants (only if still no image)
        const itemsStillWithoutImages = enrichedItems.filter(item => !item.image_url && item.sku);
        if (itemsStillWithoutImages.length > 0) {
          console.log(`⚠️ ${itemsStillWithoutImages.length} items still without images, using local fallback...`);
          const skus = itemsStillWithoutImages.map(item => item.sku).filter((sku): sku is string => Boolean(sku));
          
          const variantResult = await supabase
            .from('product_variants')
            .select('sku_variant, products(image_url)')
            .in('sku_variant', skus);
          
          // Final check before setting state
          if (isCancelled) return;
          
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
        
        // Only set state if not cancelled
        if (!isCancelled) {
          setLineItems(enrichedItems);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Error fetching line items:', error);
          setLineItems([]);
        }
      }
      if (!isCancelled) {
        setLoadingItems(false);
      }
    };

    fetchLineItems();
    
    // Cleanup: mark as cancelled if effect re-runs
    return () => {
      isCancelled = true;
    };
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
      await refetchOrder(orderId);
      throw error; // Propagar error para que handleMarkAsPackedAndPrint lo capture
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
      await refetchOrder(orderId);
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

  const handleMarkAsPackedAndPrint = useCallback(async () => {
    // Validación robusta con mensajes específicos
    if (!localOrder) {
      console.warn('⚠️ handleMarkAsPackedAndPrint: No hay orden cargada');
      toast.error('Error: Orden no cargada. Intenta de nuevo.');
      return;
    }
    
    if (localOrder.id !== orderId) {
      console.warn(`⚠️ handleMarkAsPackedAndPrint: Orden desincronizada (localOrder.id=${localOrder.id}, orderId=${orderId})`);
      toast.error('Error: Orden desincronizada. Actualiza la página.');
      return;
    }
    
    if (!localOrder.shopify_order?.shopify_order_id) {
      console.warn('⚠️ handleMarkAsPackedAndPrint: shopify_order_id no disponible');
      toast.error('Error: ID de Shopify no disponible. Intenta de nuevo.');
      return;
    }
    
    console.log(`📦 Marcando como empacado: Orden #${localOrder.shopify_order.order_number}`);
    
    // Imprimir PRIMERO para feedback instantáneo
    handlePrint();
    
    // Luego actualizar estado asincrónicamente
    try {
      await handleStatusChange('ready_to_ship');
    } catch (error) {
      console.error('❌ Error al marcar como empacado:', error);
      toast.error('Error al aplicar etiqueta EMPACADO. Intenta de nuevo.', {
        duration: 5000,
      });
    }
  }, [orderId, localOrder, handlePrint, handleStatusChange]);

  // Keep ref updated with the latest function
  useEffect(() => {
    handleMarkAsPackedAndPrintRef.current = handleMarkAsPackedAndPrint;
  }, [handleMarkAsPackedAndPrint]);

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

  // Determine if order is COD (Contraentrega) based on multiple criteria
  const orderTags = effectiveOrder.shopify_order?.tags || '';
  const hasContraentregaTag = orderTags.toLowerCase().includes('contraentrega');
  const isPendingPayment = effectiveOrder.shopify_order?.financial_status === 'pending';
  const isCODOrder = paymentMethod === 'Contraentrega' || isPendingPayment || hasContraentregaTag;

  return (
    <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Scrollable content area */}
        <div ref={contentRef} onScroll={handleContentScroll} className="flex-1 overflow-y-auto p-3 md:p-6 relative">
          <DialogHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                <div>
                  <DialogTitle className="text-lg md:text-2xl">
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
                
                {/* Badges - Wrap on mobile */}
                <div className="flex flex-wrap gap-1 md:gap-2">
                  {effectiveOrder.shopify_order?.cancelled_at && (
                    <Badge variant="destructive" className="bg-red-600 text-xs px-2 py-0.5">
                      ⚠️ CANCELADA
                    </Badge>
                  )}
                  
                  <Badge className={`${statusColors[effectiveOrder.operational_status]} text-xs px-2 py-0.5`}>
                    {statusLabels[effectiveOrder.operational_status]}
                  </Badge>
                  
                  {/* Badge "Enviado" cuando hay guía de envío válida */}
                  {shippingLabel && shippingLabel.status !== 'error' && shippingLabel.status !== 'cancelled' && (
                    <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5">
                      🚚 Enviado
                    </Badge>
                  )}
                  {effectiveOrder.shopify_order?.financial_status === 'pending' && paymentMethod !== 'Contraentrega' && (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5">
                      Pendiente
                    </Badge>
                  )}
                  {paymentMethod && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs px-2 py-0.5">
                      💳 {paymentMethod}
                    </Badge>
                  )}
                  {/* Shipping Type Badge - inline on mobile */}
                  {shippingType && (
                    <Badge className={`${shippingType.className} text-xs px-2 py-0.5 md:hidden`}>
                      {shippingType.icon} {shippingType.label}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Shipping Type Badge - Desktop only (larger) */}
                {shippingType && (
                  <Badge className={`${shippingType.className} font-bold text-sm px-3 py-1 shadow-sm hidden md:flex`}>
                    {shippingType.icon} {shippingType.label}
                  </Badge>
                )}
                
                <Button onClick={handlePrint} variant="outline" size="sm" className="h-8 px-2 md:px-3 gap-1 md:gap-2">
                  <Printer className="w-4 h-4" />
                  <span className="hidden md:inline">Imprimir</span>
                </Button>
                
                {/* Navigation buttons - Desktop only */}
                <div className="hidden md:flex items-center gap-1 ml-2 border-l pl-2">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 mt-3 md:mt-6">
            {/* Left Column - Products */}
            <div className="lg:col-span-2 space-y-3 md:space-y-4">
              <Card>
                <CardHeader className="p-3 md:p-6 pb-2 md:pb-3">
                  <CardTitle className="flex items-center justify-between text-sm md:text-base">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 md:w-5 md:h-5" />
                      Productos
                    </div>
                    <Badge className="text-base md:text-xl font-bold bg-primary text-primary-foreground px-3 py-1">
                      {totalRequiredUnits} {totalRequiredUnits === 1 ? 'unidad' : 'unidades'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0 space-y-2 md:space-y-4">
                  {lineItems.map((item, index: number) => (
                    <div key={index} className="flex gap-2 md:gap-4 p-2 md:p-4 border rounded-lg">
                      {/* Product Image - Smaller on mobile */}
                      <div className="flex-shrink-0">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.title}
                            className="w-16 h-16 md:w-32 md:h-32 object-cover rounded-lg border"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML = '<div class="w-16 h-16 md:w-32 md:h-32 bg-muted rounded-lg flex items-center justify-center"><svg class="w-6 h-6 md:w-12 md:h-12 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg></div>';
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 md:w-32 md:h-32 bg-muted rounded-lg flex items-center justify-center border">
                            <Package className="w-6 h-6 md:w-12 md:h-12 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Product Details - Compact on mobile */}
                      <div className="flex-1 min-w-0 space-y-1 md:space-y-2">
                        <div>
                          <h4 className="font-semibold text-sm md:text-lg line-clamp-2">
                            {item.title}
                          </h4>
                          {item.variant_title && (
                            <p className="text-xs md:text-sm text-muted-foreground">
                              {item.variant_title}
                            </p>
                          )}
                          {/* Custom Properties - Compact on mobile */}
                          {item.properties && item.properties.length > 0 && (
                            <div className="mt-1 md:mt-2 space-y-0.5 p-1.5 md:p-2 bg-amber-50 border border-amber-200 rounded-md">
                              {item.properties.map((prop, propIndex) => (
                                <div key={propIndex} className="flex items-start gap-1 text-xs md:text-sm">
                                  <span className="text-amber-700 font-medium">{prop.name}:</span>
                                  <span className="text-amber-900">{prop.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* SKU and Price - Inline compact */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs md:text-sm">
                          <span className="text-muted-foreground">SKU:</span>
                          <span className="font-medium truncate">{item.sku || 'N/A'}</span>
                          <span className="text-muted-foreground hidden md:inline">•</span>
                          <span className="font-medium">{formatCurrency(item.price, effectiveOrder.shopify_order?.currency)}</span>
                        </div>

                        {/* Quantity Highlighted - Smaller on mobile */}
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="text-muted-foreground text-xs md:text-sm">Cantidad:</span>
                          <span className="text-xl md:text-3xl font-bold text-primary">
                            {item.quantity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Financial Summary - Compact */}
              <div ref={financialSummaryRef} className="px-4 py-3 bg-muted/30 rounded-lg border border-muted">
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


              {/* SKU Verification Section */}
              <Card className="border-2 border-dashed border-primary/30">
                <CardHeader className="p-3 md:p-4 pb-2">
                  <CardTitle className="flex items-center justify-between text-sm md:text-base">
                    <div className="flex items-center gap-2">
                      <ScanLine className="w-4 h-4 md:w-5 md:h-5" />
                      Verificar Artículos
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-sm md:text-base font-bold px-3 py-1 ${totalVerifiedUnits === totalRequiredUnits && totalRequiredUnits > 0 ? 'bg-green-100 text-green-700 border-green-300' : ''}`}
                    >
                      {totalVerifiedUnits}/{totalRequiredUnits}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0 space-y-3">
                  <Input
                    value={skuInput}
                    onChange={(e) => {
                      setSkuInput(e.target.value);
                      handleSkuVerification(e.target.value);
                    }}
                    placeholder="🔍 Escanea o escribe el SKU..."
                    className="text-center text-base md:text-lg"
                    disabled={!!effectiveOrder?.shopify_order?.cancelled_at}
                  />
                  
                  {/* Verification Result */}
                  {verificationResult?.status === 'correct' && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 font-semibold">
                        <CheckCircle className="w-5 h-5" />
                        ¡Correcto! ({verificationResult.scannedCount}/{verificationResult.requiredCount})
                      </div>
                      <p className="text-sm text-green-600 mt-1">
                        {verificationResult.item?.title} - {verificationResult.item?.variant_title}
                      </p>
                      {verificationResult.scannedCount! < verificationResult.requiredCount! && (
                        <p className="text-xs text-amber-600 font-medium mt-1">
                          ⚠️ Faltan {verificationResult.requiredCount! - verificationResult.scannedCount!} unidades por escanear
                        </p>
                      )}
                    </div>
                  )}

                  {verificationResult?.status === 'already_verified' && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-700 font-semibold">
                        <CheckCircle className="w-5 h-5" />
                        Ya verificado completamente
                      </div>
                      <p className="text-sm text-blue-600 mt-1">
                        {verificationResult.item?.title} - {verificationResult.item?.variant_title}
                      </p>
                    </div>
                  )}
                  
                  {verificationResult?.status === 'incorrect' && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 text-red-700 font-semibold">
                        <XCircle className="w-5 h-5" />
                        ¡SKU no encontrado!
                      </div>
                      <p className="text-sm text-red-600">
                        El artículo no pertenece a la orden #{effectiveOrder?.shopify_order?.order_number}
                      </p>
                    </div>
                  )}
                  
                  {/* Verified items progress */}
                  {verifiedCounts.size > 0 && (
                    <div className="flex flex-wrap gap-1 text-xs">
                      {lineItems.map((item) => {
                        if (!item.sku) return null;
                        const scanned = verifiedCounts.get(item.sku) || 0;
                        const isComplete = scanned >= item.quantity;
                        return (
                          <Badge 
                            key={item.sku} 
                            variant="outline" 
                            className={isComplete ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
                          >
                            {isComplete ? '✓' : '⏳'} {item.title?.slice(0, 12)}... ({scanned}/{item.quantity})
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Status Actions - Only show when cancelled, packed, or shipped */}
              {(effectiveOrder.shopify_order?.cancelled_at || effectiveOrder.operational_status === 'ready_to_ship' || effectiveOrder.operational_status === 'shipped') && (
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
                    ) : (effectiveOrder.operational_status === 'ready_to_ship' || effectiveOrder.operational_status === 'shipped') && effectiveOrder.packed_at && (
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
                        
                        {/* Shipping Label Info */}
                        {shippingLabel && shippingLabel.status !== 'error' && (
                          <div className="mt-3 pt-3 border-t border-green-200 space-y-1">
                            <div className="flex items-center gap-2 text-green-700 font-medium">
                              <Truck className="w-4 h-4" />
                              <span>Guía de Envío</span>
                            </div>
                            <p className="flex items-center gap-2">
                              <span>🚚</span>
                              <span>{CARRIER_NAMES[shippingLabel.carrier as CarrierCode] || shippingLabel.carrier}</span>
                            </p>
                            {shippingLabel.tracking_number && (
                              <p className="flex items-center gap-2">
                                <span>📦</span>
                                <span className="font-mono">{shippingLabel.tracking_number}</span>
                              </p>
                            )}
                            {shippingLabel.total_price && (
                              <p className="flex items-center gap-2">
                                <span>💰</span>
                                <span>${shippingLabel.total_price.toLocaleString('es-CO')} COP</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

            </div>

            {/* Right Column - Details */}
            <div className="space-y-3 md:space-y-4">
              {/* Mobile: Compact Customer + Address Info */}
              <div className="md:hidden bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="text-sm min-w-0">
                    <p className="font-medium">
                      {effectiveOrder.shopify_order?.customer_first_name} {effectiveOrder.shopify_order?.customer_last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{effectiveOrder.shopify_order?.customer_email}</p>
                    {effectiveOrder.shopify_order?.customer_phone && (
                      <p className="text-xs text-muted-foreground">{effectiveOrder.shopify_order.customer_phone}</p>
                    )}
                  </div>
                </div>
                {shippingAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="text-xs text-muted-foreground min-w-0">
                      <p className="truncate">{shippingAddress.address1}</p>
                      <p>{shippingAddress.city}, {shippingAddress.province}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Notas de Shopify - Bidirectional Sync */}
              <Card>
                <CardHeader className="p-3 md:p-6 pb-2 md:pb-3">
                  {effectiveOrder?.shopify_order?.customer_first_name && (
                    <Badge className="bg-blue-500 text-white hover:bg-blue-500 font-semibold text-xs md:text-sm px-2 md:px-3 py-0.5 md:py-1 w-fit mb-2 hidden md:flex">
                      <User className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-1.5" />
                      {effectiveOrder.shopify_order.customer_first_name} {effectiveOrder.shopify_order.customer_last_name}
                    </Badge>
                  )}
                  <CardTitle className="text-sm md:text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Notas de Shopify
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0 space-y-2">
                  <Textarea
                    value={shopifyNote}
                    onChange={(e) => setShopifyNote(e.target.value)}
                    placeholder="Agregar notas visibles en Shopify..."
                    className="min-h-[60px] md:min-h-[100px] text-sm"
                    disabled={!!effectiveOrder?.shopify_order?.cancelled_at}
                  />
                  <Button
                    onClick={handleSaveShopifyNote}
                    disabled={isSavingShopifyNote || !!effectiveOrder?.shopify_order?.cancelled_at}
                    size="sm"
                    className="w-full text-xs md:text-sm"
                  >
                    {isSavingShopifyNote ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Nota'
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground hidden md:block">
                    ℹ️ Los cambios se sincronizan automáticamente con Shopify
                  </p>
                </CardContent>
              </Card>

              {/* Shopify Tags */}
              <Card>
                <CardHeader className="p-3 md:p-6 pb-2 md:pb-3">
                  <CardTitle className="text-sm md:text-base flex items-center gap-2">
                    <Tags className="w-4 h-4" />
                    Etiquetas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0">
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

              {/* Customer Info - Desktop only */}
              <Card className="hidden md:block">
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

              {/* Shipping Address - Desktop only */}
              {shippingAddress && (
                <Card className="hidden md:block">
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

          {/* Shipping Label Section - At the very bottom of scrollable content */}
          {effectiveOrder.shopify_order?.shopify_order_id && !effectiveOrder.shopify_order?.cancelled_at && (
            <div className="border-t pt-4 mt-6">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">Guía de Envío</span>
              </div>
              <EnviaShippingButton
                shopifyOrderId={effectiveOrder.shopify_order.shopify_order_id}
                orderNumber={effectiveOrder.shopify_order.order_number}
                shippingAddress={shippingAddress}
                customerEmail={effectiveOrder.shopify_order.customer_email}
                customerPhone={effectiveOrder.shopify_order.customer_phone}
                totalPrice={Number(effectiveOrder.shopify_order.total_price) || 0}
                isFulfilled={effectiveOrder.shopify_order.fulfillment_status === 'fulfilled'}
                isCOD={isCODOrder}
                onLabelChange={setShippingLabel}
              />
            </div>
          )}
        </div>

        {/* Centered scroll hint arrow - independent sticky element */}
        {showScrollHint && lineItems.length >= 3 && (
          <div className="sticky bottom-20 inset-x-0 flex justify-center pointer-events-none z-10 -mt-10">
            <div className="flex items-center gap-2 animate-bounce bg-orange-500 text-white rounded-full px-5 py-2.5 shadow-xl border-2 border-orange-400">
              <ChevronDown className="w-6 h-6" />
              <span className="text-sm font-bold">Más productos abajo</span>
            </div>
          </div>
        )}

        {/* Sticky Floating Action Button - Fixed at bottom right of modal */}
        {!effectiveOrder.shopify_order?.cancelled_at && effectiveOrder.operational_status !== 'ready_to_ship' && (
          <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 z-10 pointer-events-none">
            <Button
              onClick={handleMarkAsPackedAndPrint}
              disabled={updatingStatus}
              title="Ctrl + . para marcar rápidamente"
              className="h-11 md:h-14 px-4 md:px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm md:text-base gap-1.5 md:gap-2 pointer-events-auto"
            >
              {updatingStatus ? (
                <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
              ) : (
                <>
                  <Package className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Marcar como</span> Empacado
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};