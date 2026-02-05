import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Printer, Package, User, MapPin, FileText, Loader2, Tags, CheckCircle, ChevronUp, ChevronDown, Truck, ScanLine, XCircle, Store, RefreshCw, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { OrderTagsManager } from '@/components/OrderTagsManager';
import { usePickingOrders, OperationalStatus, PickingOrder } from '@/hooks/usePickingOrders';
import { usePickingOrderDetails } from '@/hooks/usePickingOrderDetails';
import { usePickingLineItems } from '@/hooks/usePickingLineItems';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EnviaShippingButton, ShippingLabel, CARRIER_NAMES, CarrierCode } from '@/features/shipping';
import type { EnviaShippingButtonRef } from '@/features/shipping';
import { invokeEdgeFunction } from '@/features/shipping/lib/invokeEdgeFunction';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  awaiting_pickup: 'bg-orange-100 text-orange-800',
  shipped: 'bg-gray-100 text-gray-800',
};

const statusLabels = {
  pending: 'Por Procesar',
  picking: 'Picking en Proceso',
  packing: 'Empacando',
  ready_to_ship: 'Empacado',
  awaiting_pickup: 'Esperando Retiro',
  shipped: 'Enviado',
};

export const PickingOrderDetailsModal: React.FC<PickingOrderDetailsModalProps> = ({ 
  orderId, 
  onClose,
  allOrderIds,
  onNavigate
}) => {
  const { orders, updateOrderStatus, updateOrderNotes, updateShopifyNote } = usePickingOrders();
  
  // Use React Query cached order details - directly with orderId (no debounce needed, React Query handles caching)
  const { 
    order: cachedOrder, 
    isLoading: isCacheLoading, 
    updateOrderOptimistically,
    prefetchOrder,
    invalidateOrder,
    refetch: refetchCachedOrder
  } = usePickingOrderDetails(orderId);
  
  // State declarations
  const [notes, setNotes] = useState('');
  const [shopifyNote, setShopifyNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingShopifyNote, setIsSavingShopifyNote] = useState(false);
  const [localOrder, setLocalOrder] = useState<PickingOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [packedByName, setPackedByName] = useState<string | null>(null);
  const [shippingLabel, setShippingLabel] = useState<ShippingLabel | null>(null);
  const financialSummaryRef = useRef<HTMLDivElement>(null);
  const shippingButtonRef = useRef<EnviaShippingButtonRef>(null);
  const [isCreatingShippingLabel, setIsCreatingShippingLabel] = useState(false);
  const [isProcessingPickup, setIsProcessingPickup] = useState(false);
  const [selectedCarrierName, setSelectedCarrierName] = useState<string | null>(null);
  const [isProcessingExpressFulfillment, setIsProcessingExpressFulfillment] = useState(false);
  const [isSyncingFromShopify, setIsSyncingFromShopify] = useState(false);

  // Shopify note sync UX (auto-save + background sync)
  const [shopifyNoteSaveState, setShopifyNoteSaveState] = useState<'idle' | 'saving' | 'saved' | 'pending_sync'>('idle');
  const lastSavedShopifyNoteRef = useRef<string>('');
  const debounceSaveTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);
  
  // Separate refs for proper hydration & background sync control:
  // - hydratedKeyRef: tracks if we already hydrated from DB for this orderId
  // - syncInFlightKeyRef: prevents duplicate background sync requests
  // - shopifyFreshKeyRef: marks that we already have fresh data from Shopify (don't overwrite with stale cache)
  const hydratedKeyRef = useRef<string | null>(null);
  const syncInFlightKeyRef = useRef<string | null>(null);
  const shopifyFreshKeyRef = useRef<string | null>(null);
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
  const skuInputRef = useRef<HTMLInputElement>(null);
  
  // Ref to hold the latest handleMarkAsPackedAndPrint to avoid stale closure in useEffect
  const handleMarkAsPackedAndPrintRef = useRef<() => void>(() => {});
  
  // Guards to prevent duplicate pack/print operations (StrictMode-safe, idempotent)
  const packInFlightRef = useRef(false);
  const autoPackTriggeredRef = useRef<string | null>(null);
  const autoPrintTriggeredRef = useRef<string | null>(null);

  // Use cached order as base, fall back to list order - MUST match current orderId
  const order = orders.find(o => o.id === orderId);
  const effectiveOrder = useMemo(() => {
    // Priority: localOrder (if matches current - for optimistic updates) → cachedOrder → list order
    // This ensures UI reflects changes immediately after pack/status updates
    if (localOrder && localOrder.id === orderId) return localOrder;
    if (cachedOrder && cachedOrder.id === orderId) return cachedOrder;
    return order;
  }, [cachedOrder, localOrder, order, orderId]);

  // Use React Query for line items - completely independent of shipping
  const rawLineItems = useMemo(() => 
    effectiveOrder?.shopify_order?.raw_data?.line_items || [],
    [effectiveOrder?.shopify_order?.raw_data?.line_items]
  );
  
  const currentShopifyOrderIdForItems = effectiveOrder?.shopify_order?.shopify_order_id || null;
  
  const {
    lineItems,
    isLoading: loadingItems,
    hasError: lineItemsError,
    isTimeout: lineItemsTimeout,
    refetch: refetchLineItems
  } = usePickingLineItems(currentShopifyOrderIdForItems, rawLineItems);

  // Prefetch adjacent orders for faster navigation
  useEffect(() => {
    const currentIndex = allOrderIds.indexOf(orderId);
    
    // Prefetch previous order
    if (currentIndex > 0) {
      prefetchOrder(allOrderIds[currentIndex - 1]);
    }
    
    // Prefetch next order
    if (currentIndex < allOrderIds.length - 1) {
      prefetchOrder(allOrderIds[currentIndex + 1]);
    }
  }, [orderId, allOrderIds, prefetchOrder]);

  // Navigation logic
  const currentIndex = allOrderIds.indexOf(orderId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allOrderIds.length - 1;

  // Debounce navigation to avoid firing many requests when user navigates quickly
  const navigateDebounceRef = useRef<number | null>(null);
  const debouncedNavigate = useCallback((targetOrderId: string) => {
    if (navigateDebounceRef.current) {
      window.clearTimeout(navigateDebounceRef.current);
    }
    navigateDebounceRef.current = window.setTimeout(() => {
      onNavigate(targetOrderId);
    }, 300);
  }, [onNavigate]);

  useEffect(() => {
    return () => {
      if (navigateDebounceRef.current) {
        window.clearTimeout(navigateDebounceRef.current);
      }
    };
  }, []);

  const handlePrevious = () => {
    if (hasPrevious) {
      debouncedNavigate(allOrderIds[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      debouncedNavigate(allOrderIds[currentIndex + 1]);
    }
  };

  // Focus SKU input and scroll to verification section
  const focusScanInput = useCallback(() => {
    if (skuInputRef.current) {
      skuInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Small delay to ensure scroll completes before focusing
      setTimeout(() => {
        skuInputRef.current?.focus();
      }, 300);
    }
  }, []);

  // Keyboard navigation - J for previous, K for next, Ctrl+. for mark as packed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Ctrl + . → Enfocar campo de escaneo
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        // Solo enfocar si la orden no está empacada/enviada/cancelada
        if (effectiveOrder?.operational_status !== 'ready_to_ship' && 
            effectiveOrder?.operational_status !== 'awaiting_pickup' && 
            effectiveOrder?.operational_status !== 'shipped' && 
            !effectiveOrder?.shopify_order?.cancelled_at) {
          focusScanInput();
        }
        return;
      }
      
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (hasPrevious) {
          debouncedNavigate(allOrderIds[currentIndex - 1]);
        }
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (hasNext) {
          debouncedNavigate(allOrderIds[currentIndex + 1]);
        }
      }
    };

    if (orderId) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [orderId, currentIndex, allOrderIds, hasPrevious, hasNext, debouncedNavigate, effectiveOrder?.operational_status, effectiveOrder?.shopify_order?.cancelled_at, focusScanInput]);

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

  // Refetch order - now uses React Query refetch to update cache
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
      
      const updatedOrder = {
        ...data,
        line_items: []
      } as PickingOrder;
      
      setLocalOrder(updatedOrder);
      
      // Also update React Query cache for consistency
      updateOrderOptimistically(() => updatedOrder);
    } catch (error) {
      console.error('❌ Error fetching order:', error);
    } finally {
      setLoadingOrder(false);
    }
  }, [updateOrderOptimistically]);

  // Sync localOrder from cached order when it changes
  // This allows optimistic updates while still benefiting from React Query cache
  useEffect(() => {
    if (cachedOrder && cachedOrder.id === orderId) {
      setLocalOrder(cachedOrder);
      setLoadingOrder(false);
    }
  }, [cachedOrder, orderId]);

  // Set loading state only when we truly don't have data for current order
  useEffect(() => {
    const hasDataForCurrentOrder = 
      (cachedOrder && cachedOrder.id === orderId) ||
      (localOrder && localOrder.id === orderId) ||
      order;
    
    if (!hasDataForCurrentOrder) {
      setLoadingOrder(true);
    } else {
      setLoadingOrder(false);
    }
  }, [orderId, cachedOrder, localOrder, order]);

  // Sync notes when effectiveOrder changes AND matches current orderId
  // IMPORTANT: This effect ALWAYS hydrates from DB on first render for the order.
  // Subsequent cache updates are ignored if:
  // - We already got fresh data from Shopify (shopifyFreshKeyRef set)
  // - We already hydrated for this orderId (hydratedKeyRef set)
  useEffect(() => {
    if (effectiveOrder?.id !== orderId) return;

    const hydrateKey = orderId;

    // Always sync internal notes (they're local-only)
    setNotes(effectiveOrder.internal_notes || '');

    // If we already hydrated OR already have fresh Shopify data, don't overwrite
    if (hydratedKeyRef.current === hydrateKey || shopifyFreshKeyRef.current === hydrateKey) {
      return;
    }

    // First-time hydration from DB for this order
    const noteFromDb = effectiveOrder.shopify_order?.note || '';
    
    setShopifyNote(noteFromDb);
    lastSavedShopifyNoteRef.current = noteFromDb;
    retryAttemptRef.current = 0;
    setShopifyNoteSaveState(noteFromDb ? 'saved' : 'idle');
    
    // Mark as hydrated so subsequent cache updates don't overwrite
    hydratedKeyRef.current = hydrateKey;
  }, [effectiveOrder, orderId]);

  // Reset verification states when orderId changes (but NOT localOrder or lineItems - keep previous data visible during transition)
  // NOTE: Notes are NOT reset here - they sync from effectiveOrder in the effect above to prevent race conditions
  useEffect(() => {
    // Clear pending debounce/retry timers when navigating between orders
    if (debounceSaveTimerRef.current) {
      window.clearTimeout(debounceSaveTimerRef.current);
      debounceSaveTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    retryAttemptRef.current = 0;
    // Reset all hydration/sync refs for new order
    hydratedKeyRef.current = null;
    syncInFlightKeyRef.current = null;
    shopifyFreshKeyRef.current = null;
    setShopifyNoteSaveState('idle');

    // Reset verification and input states only - NOT notes!
    setSkuInput('');
    setVerificationResult(null);
    setVerifiedCounts(new Map());
    setShowScrollHint(false);

    // Reset guards for new order (allow pack/print for the new order)
    autoPackTriggeredRef.current = null;
    autoPrintTriggeredRef.current = null;
    packInFlightRef.current = false;

    // DON'T reset lineItems here - causes "0 unidades" flash
    // They will be replaced when fetchLineItems completes for the new order
    // Note: localOrder is NOT reset here to prevent effectiveOrder from becoming null
  }, [orderId]);

  // Background sync: when opening an order, silently refresh note from Shopify
  // - Only mark as "done" on SUCCESS (not before/during fetch)
  // - Use longer timeout (10s) to prevent aborts
  // - Allow retry on failure/timeout by clearing syncInFlightKeyRef
  useEffect(() => {
    const shopifyOrderId = effectiveOrder?.shopify_order?.shopify_order_id;
    if (!shopifyOrderId) return;

    const syncKey = orderId;
    
    // If sync already in-flight or already got fresh data for this order, skip
    if (syncInFlightKeyRef.current === syncKey || shopifyFreshKeyRef.current === syncKey) {
      return;
    }
    
    // Mark sync as in-flight (prevents duplicate requests)
    syncInFlightKeyRef.current = syncKey;

    const controller = new AbortController();

    void (async () => {
      try {
        const data = await invokeEdgeFunction<any>(
          'update-shopify-order',
          { orderId: shopifyOrderId.toString(), action: 'sync_from_shopify' },
          { timeoutMs: 10_000, signal: controller.signal }
        );

        // SUCCESS: mark as fresh so we don't overwrite with stale cache
        shopifyFreshKeyRef.current = syncKey;

        const syncedNote = data?.note || '';
        const syncedTags = data?.tags ?? null;

        // Update UI with fresh Shopify data
        setShopifyNote(syncedNote);
        lastSavedShopifyNoteRef.current = syncedNote;
        setShopifyNoteSaveState(syncedNote ? 'saved' : 'idle');

        // Update local UI cache so it persists when reopening the modal
        setLocalOrder((prev) =>
          prev && prev.id === orderId
            ? {
                ...prev,
                shopify_order: {
                  ...(prev.shopify_order ?? {}),
                  note: syncedNote,
                  ...(syncedTags ? { tags: syncedTags } : {}),
                } as any,
              }
            : prev
        );

        updateOrderOptimistically((prev) => {
          if (!prev || prev.id !== orderId) return prev;
          return {
            ...prev,
            shopify_order: {
              ...(prev.shopify_order ?? {}),
              note: syncedNote,
              ...(syncedTags ? { tags: syncedTags } : {}),
            } as any,
          } as PickingOrder;
        });
      } catch {
        // FAILURE/ABORT: clear in-flight so user can retry by reopening
        if (syncInFlightKeyRef.current === syncKey) {
          syncInFlightKeyRef.current = null;
        }
        // Silent failure by design - UI already shows DB data
      }
    })();

    return () => controller.abort();
  }, [orderId, effectiveOrder?.shopify_order?.shopify_order_id, updateOrderOptimistically]);

  // Auto-save (debounced): after 2s without typing, save locally + sync to Shopify in background
  useEffect(() => {
    const shopifyOrderId = effectiveOrder?.shopify_order?.shopify_order_id;
    if (!shopifyOrderId) return;
    if (effectiveOrder?.shopify_order?.cancelled_at) return;

    // No changes since last baseline/success
    if (shopifyNote === lastSavedShopifyNoteRef.current) return;

    if (debounceSaveTimerRef.current) {
      window.clearTimeout(debounceSaveTimerRef.current);
    }

    debounceSaveTimerRef.current = window.setTimeout(() => {
      void handleSaveShopifyNote(true);
    }, 2_000);

    return () => {
      if (debounceSaveTimerRef.current) {
        window.clearTimeout(debounceSaveTimerRef.current);
        debounceSaveTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopifyNote, effectiveOrder?.shopify_order?.shopify_order_id, effectiveOrder?.shopify_order?.cancelled_at]);

  // Show scroll hint when lineItems load and there are 3 or more
  useEffect(() => {
    if (lineItems.length >= 3) {
      setShowScrollHint(true);
    }
  }, [lineItems.length]);

  // Update selected carrier name from shipping button ref
  useEffect(() => {
    const interval = setInterval(() => {
      if (shippingButtonRef.current?.selectedCarrierName) {
        setSelectedCarrierName(shippingButtonRef.current.selectedCarrierName);
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

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

  // Determina si todos los artículos han sido verificados
  const allItemsVerified = totalRequiredUnits > 0 && totalVerifiedUnits === totalRequiredUnits;

  // Detect Express shipping type for auto-pack logic
  const shippingLinesForAutopack = effectiveOrder?.shopify_order?.raw_data?.shipping_lines || [];
  const shippingMethodForAutopack = shippingLinesForAutopack[0]?.title || '';
  const isExpressShipping = shippingMethodForAutopack.toLowerCase().includes('express');

  // NOTE: Line items now fetched via usePickingLineItems hook with React Query

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
      
      // SUCCESS: Update React Query cache immediately for consistency
      const updatedOrderForCache: PickingOrder = {
        ...localOrder,
        operational_status: newStatus,
        ...(newStatus === 'ready_to_ship' ? {
          packed_at: new Date().toISOString(),
          packed_by: user?.id
        } : {}),
        shopify_order: localOrder.shopify_order ? {
          ...localOrder.shopify_order,
          tags: updatedTags
        } : undefined
      };
      updateOrderOptimistically(() => updatedOrderForCache);
      
    } catch (error) {
      console.error('Error updating status:', error);
      // ONLY on error: Refetch to get actual state and rollback
      await refetchOrder(orderId);
      throw error; // Propagar error para que handleMarkAsPackedAndPrint lo capture
    } finally {
      setUpdatingStatus(false);
    }
  }, [orderId, localOrder, updateOrderStatus, refetchOrder, updateOrderOptimistically]);

  const handleSaveNotes = async () => {
    setIsSaving(true);
    await updateOrderNotes(orderId, notes);
    setIsSaving(false);
  };

  /**
   * Save note locally (Supabase) immediately and sync to Shopify in background.
   * - silent=true: no toasts/UI noise (used for debounce auto-save)
   * - retries up to 3 times (5s interval) if Shopify sync fails
   */
  const handleSaveShopifyNote = async (silent = false) => {
    const shopifyOrderId = effectiveOrder?.shopify_order?.shopify_order_id?.toString();
    if (!shopifyOrderId) return;
    if (effectiveOrder?.shopify_order?.cancelled_at) return;

    // Clear any pending retry when user saves again
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const noteToSave = shopifyNote;

    setIsSavingShopifyNote(true);
    setShopifyNoteSaveState('saving');

    try {
      // Optimistic update: immediately update local state AND React Query cache
      setLocalOrder((prev) =>
        prev && prev.id === orderId
          ? {
              ...prev,
              shopify_order: {
                ...(prev.shopify_order ?? {}),
                note: noteToSave,
              } as any,
            }
          : prev
      );

      updateOrderOptimistically((prev) => {
        if (!prev || prev.id !== orderId) return prev;
        return {
          ...prev,
          shopify_order: {
            ...(prev.shopify_order ?? {}),
            note: noteToSave,
          } as any,
        } as PickingOrder;
      });

      // Edge function: saves locally first, then attempts Shopify sync
      const { data, error } = await supabase.functions.invoke('update-shopify-order-note', {
        body: { shopifyOrderId, note: noteToSave },
      });

      if (error) throw error;

      const shopifySynced = (data as any)?.shopifySynced !== false;

      if (shopifySynced) {
        lastSavedShopifyNoteRef.current = noteToSave;
        retryAttemptRef.current = 0;
        setShopifyNoteSaveState(noteToSave ? 'saved' : 'idle');
        if (!silent) toast.success('Nota guardada');
      } else {
        setShopifyNoteSaveState('pending_sync');
        if (!silent) toast.message('Nota guardada localmente. Sincronización con Shopify pendiente.');
      }

      // If Shopify sync is pending, retry up to 3 times (5s interval)
      if (!shopifySynced) {
        const attempt = retryAttemptRef.current;
        if (attempt < 3) {
          retryAttemptRef.current = attempt + 1;
          const orderSnapshot = orderId;
          retryTimerRef.current = window.setTimeout(() => {
            if (orderId !== orderSnapshot) return;
            if (shopifyNote !== noteToSave) return; // user changed note again
            void handleSaveShopifyNote(true);
          }, 5_000);
        }
      }

      // Background refetch to confirm final state (don't block UI)
      refetchCachedOrder();
    } catch (error) {
      console.error('Error saving Shopify note:', error);
      setShopifyNoteSaveState('pending_sync');
      if (!silent) toast.message('Nota guardada localmente. Sincronización con Shopify pendiente.');

      const attempt = retryAttemptRef.current;
      if (attempt < 3) {
        retryAttemptRef.current = attempt + 1;
        const noteSnapshot = noteToSave;
        const orderSnapshot = orderId;
        retryTimerRef.current = window.setTimeout(() => {
          if (orderId !== orderSnapshot) return;
          if (shopifyNote !== noteSnapshot) return;
          void handleSaveShopifyNote(true);
        }, 5_000);
      }
    } finally {
      setIsSavingShopifyNote(false);
    }
  };

  // Manual sync button action (kept as "force refresh")
  const handleSyncFromShopify = async () => {
    if (!effectiveOrder?.shopify_order?.shopify_order_id) return;

    setIsSyncingFromShopify(true);
    try {
      const data = await invokeEdgeFunction<any>(
        'update-shopify-order',
        { orderId: effectiveOrder.shopify_order.shopify_order_id.toString(), action: 'sync_from_shopify' },
        { timeoutMs: 10_000 }
      );

      const syncedNote = data?.note || '';
      const syncedTags = data?.tags ?? null;

      setShopifyNote(syncedNote);
      lastSavedShopifyNoteRef.current = syncedNote;
      retryAttemptRef.current = 0;
      setShopifyNoteSaveState(syncedNote ? 'saved' : 'idle');

      setLocalOrder((prev) =>
        prev
          ? {
              ...prev,
              shopify_order: {
                ...(prev.shopify_order ?? {}),
                note: syncedNote,
                ...(syncedTags ? { tags: syncedTags } : {}),
              } as any,
            }
          : prev
      );

      updateOrderOptimistically((prev) => {
        if (!prev || prev.id !== orderId) return prev;
        return {
          ...prev,
          shopify_order: {
            ...(prev.shopify_order ?? {}),
            note: syncedNote,
            ...(syncedTags ? { tags: syncedTags } : {}),
          } as any,
        } as PickingOrder;
      });

      toast.success('Nota actualizada desde Shopify');
    } catch (error) {
      console.error('Error syncing from Shopify:', error);
      toast.error('Error al sincronizar desde Shopify');
    } finally {
      setIsSyncingFromShopify(false);
    }
  };

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
    // Guard: prevent duplicate execution
    if (packInFlightRef.current) {
      console.log('⚠️ handleMarkAsPackedAndPrint: Already in flight, skipping');
      return;
    }
    
    // Guard: check if already packed/shipped
    const currentStatus = localOrder?.operational_status;
    if (currentStatus === 'ready_to_ship' || currentStatus === 'awaiting_pickup' || currentStatus === 'shipped') {
      console.log(`⚠️ handleMarkAsPackedAndPrint: Order already ${currentStatus}, skipping`);
      return;
    }
    
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
    
    // Lock to prevent duplicate execution
    packInFlightRef.current = true;
    
    console.log(`📦 Marcando como empacado: Orden #${localOrder.shopify_order.order_number}`);
    
    // Print only once per order
    if (autoPrintTriggeredRef.current !== orderId) {
      autoPrintTriggeredRef.current = orderId;
      handlePrint();
    }
    
    // Luego actualizar estado asincrónicamente
    try {
      await handleStatusChange('ready_to_ship');
    } catch (error) {
      console.error('❌ Error al marcar como empacado:', error);
      toast.error('Error al aplicar etiqueta EMPACADO. Intenta de nuevo.', {
        duration: 5000,
      });
    } finally {
      packInFlightRef.current = false;
    }
  }, [orderId, localOrder, handlePrint, handleStatusChange]);

  // Handler for Express orders - auto-fulfill without shipping label
  const handleMarkAsPackedExpress = useCallback(async () => {
    // Guard: prevent duplicate execution
    if (packInFlightRef.current) {
      console.log('⚠️ handleMarkAsPackedExpress: Already in flight, skipping');
      return;
    }
    
    // Guard: check if already packed/shipped
    const currentStatus = localOrder?.operational_status;
    if (currentStatus === 'ready_to_ship' || currentStatus === 'awaiting_pickup' || currentStatus === 'shipped') {
      console.log(`⚠️ handleMarkAsPackedExpress: Order already ${currentStatus}, skipping`);
      return;
    }
    
    if (!localOrder?.shopify_order?.shopify_order_id) {
      toast.error('Error: ID de Shopify no disponible');
      return;
    }

    // Lock to prevent duplicate execution
    packInFlightRef.current = true;

    console.log(`🚀 Procesando pedido Express #${localOrder.shopify_order.order_number}`);
    
    // Print only once per order
    if (autoPrintTriggeredRef.current !== orderId) {
      autoPrintTriggeredRef.current = orderId;
      handlePrint();
    }
    
    setIsProcessingExpressFulfillment(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      const { data, error } = await supabase.functions.invoke('fulfill-express-order', {
        body: {
          shopify_order_id: localOrder.shopify_order.shopify_order_id,
          organization_id: localOrder.organization_id,
          user_id: user?.id
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Pedido Express enviado. Cliente notificado.');
        
        // Optimistic update
        const updatedOrder: PickingOrder = {
          ...localOrder,
          operational_status: 'shipped' as OperationalStatus,
          shipped_at: new Date().toISOString(),
          shipped_by: user?.id,
          packed_at: new Date().toISOString(),
          packed_by: user?.id
        };
        setLocalOrder(updatedOrder);
        updateOrderOptimistically(() => updatedOrder);
        
        await refetchOrder(orderId);
      } else {
        throw new Error(data?.error || 'Error procesando pedido Express');
      }
    } catch (error: any) {
      console.error('❌ Error procesando pedido Express:', error);
      toast.error(error.message || 'Error procesando pedido Express');
    } finally {
      setIsProcessingExpressFulfillment(false);
      packInFlightRef.current = false;
    }
  }, [localOrder, orderId, handlePrint, refetchOrder, updateOrderOptimistically]);

  // Keep ref updated with the latest function
  useEffect(() => {
    handleMarkAsPackedAndPrintRef.current = handleMarkAsPackedAndPrint;
  }, [handleMarkAsPackedAndPrint]);

  // Auto-pack when all items are verified (moved here to access handler functions)
  // Uses orderId-based guard to prevent double execution in React StrictMode
  useEffect(() => {
    // Guard: already triggered for this specific order
    if (autoPackTriggeredRef.current === orderId) {
      return;
    }
    
    // Guard: order already in terminal status
    const currentStatus = effectiveOrder?.operational_status;
    if (currentStatus === 'ready_to_ship' || currentStatus === 'awaiting_pickup' || currentStatus === 'shipped') {
      return;
    }
    
    if (allItemsVerified && 
        !effectiveOrder?.shopify_order?.cancelled_at &&
        !updatingStatus &&
        !isProcessingExpressFulfillment &&
        !packInFlightRef.current) {
      
      // Mark as triggered BEFORE the timeout to prevent race conditions
      autoPackTriggeredRef.current = orderId;
      
      // Small delay to show the green verification before auto-packing
      const timer = setTimeout(() => {
        if (isExpressShipping) {
          // Express: auto-fulfill without shipping label
          handleMarkAsPackedExpress();
        } else {
          // Standard: mark as ready_to_ship
          handleMarkAsPackedAndPrint();
        }
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [orderId, allItemsVerified, effectiveOrder?.operational_status, effectiveOrder?.shopify_order?.cancelled_at, updatingStatus, isExpressShipping, isProcessingExpressFulfillment, handleMarkAsPackedExpress, handleMarkAsPackedAndPrint]);

  // Handler for "Listo para Retiro" - creates fulfillment in Shopify and sets awaiting_pickup
  const handleReadyForPickup = useCallback(async () => {
    if (!localOrder?.shopify_order?.shopify_order_id) {
      toast.error('Error: ID de Shopify no disponible');
      return;
    }

    setIsProcessingPickup(true);
    try {
      const { data, error } = await supabase.functions.invoke('fulfill-pickup-order', {
        body: {
          shopify_order_id: localOrder.shopify_order.shopify_order_id,
          organization_id: localOrder.organization_id
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || 'Pedido listo para retiro. Cliente notificado.');
        
        // Update local state
        setLocalOrder(prev => prev ? {
          ...prev,
          operational_status: 'awaiting_pickup' as OperationalStatus
        } : prev);
        
        await refetchOrder(orderId);
      } else {
        throw new Error(data?.error || 'Error procesando pedido');
      }
    } catch (error: any) {
      console.error('Error en Listo para Retiro:', error);
      toast.error(error.message || 'Error procesando pedido para retiro');
    } finally {
      setIsProcessingPickup(false);
    }
  }, [localOrder, orderId, refetchOrder]);

  // Handler for "Marcar como Entregado" - confirms pickup delivery
  const handleConfirmPickupDelivery = useCallback(async () => {
    if (!localOrder?.shopify_order?.shopify_order_id) {
      toast.error('Error: ID de Shopify no disponible');
      return;
    }

    setIsProcessingPickup(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      const { data, error } = await supabase.functions.invoke('confirm-pickup-delivery', {
        body: {
          shopify_order_id: localOrder.shopify_order.shopify_order_id,
          organization_id: localOrder.organization_id,
          user_id: user?.id
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Entrega confirmada exitosamente');
        
        // Update local state
        setLocalOrder(prev => prev ? {
          ...prev,
          operational_status: 'shipped' as OperationalStatus,
          shipped_at: new Date().toISOString(),
          shipped_by: user?.id
        } : prev);
        
        await refetchOrder(orderId);
      } else {
        throw new Error(data?.error || 'Error confirmando entrega');
      }
    } catch (error: any) {
      console.error('Error confirmando entrega:', error);
      toast.error(error.message || 'Error confirmando entrega');
    } finally {
      setIsProcessingPickup(false);
    }
  }, [localOrder, orderId, refetchOrder]);

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
  const rawFinancialData = effectiveOrder.shopify_order?.raw_data || {};
  
  // Calculate financial summary dynamically based on active lineItems
  // This fixes the issue where Shopify doesn't update totals when items are deleted
  const calculatedSubtotal = lineItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Get original values for tax rate calculation
  const originalSubtotal = parseFloat(rawFinancialData.subtotal_price) || 0;
  const originalTax = parseFloat(rawFinancialData.total_tax) || 0;
  const taxRate = originalSubtotal > 0 ? (originalTax / originalSubtotal) : 0;
  
  // Calculate tax proportionally based on new subtotal
  const calculatedTax = calculatedSubtotal * taxRate;
  
  // Shipping stays the same (not affected by deleted items)
  const shippingAmount = parseFloat(rawFinancialData.total_shipping_price_set?.shop_money?.amount) || 0;
  
  // Check if taxes are included in prices (Shopify setting)
  const taxesIncluded = rawFinancialData.taxes_included === true;
  
  // Calculate total - if taxes are included, don't add them again
  const calculatedTotal = taxesIncluded 
    ? calculatedSubtotal + shippingAmount  // Taxes already in subtotal
    : calculatedSubtotal + calculatedTax + shippingAmount;
  
  // Create financial summary with calculated values
  const financialSummary = {
    subtotal_price: calculatedSubtotal,
    total_tax: calculatedTax,
    total_price: calculatedTotal,
    total_shipping_price_set: rawFinancialData.total_shipping_price_set
  };
  
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
  
  // El ÚLTIMO método de pago en el array es el efectivo (orden cronológico de Shopify)
  const actualPaymentMethod = paymentGateways.length > 0 
    ? formatPaymentMethod(paymentGateways[paymentGateways.length - 1]) 
    : null;

  console.log('🔍 DEBUG Payment Method:', {
    rawPaymentGateways,
    paymentGateways,
    actualPaymentMethod,
    effectivePaymentGateway: paymentGateways[paymentGateways.length - 1],
    order_number: effectiveOrder.shopify_order?.order_number,
    has_raw_data: !!effectiveOrder.shopify_order?.raw_data
  });

  // Determine if order is COD (Contraentrega) based on the EFFECTIVE (last) payment method
  const orderTags = effectiveOrder.shopify_order?.tags || '';
  const hasContraentregaTag = orderTags.toLowerCase().includes('contraentrega');
  const isPendingPayment = effectiveOrder.shopify_order?.financial_status === 'pending';
  
  // isCODOrder is true if the LAST payment method is COD, or has contraentrega tag with pending status
  const isCODOrder = actualPaymentMethod === 'Contraentrega' || 
    (isPendingPayment && hasContraentregaTag);

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
                  {effectiveOrder.shopify_order?.financial_status === 'pending' && actualPaymentMethod !== 'Contraentrega' && (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5">
                      Pendiente
                    </Badge>
                  )}
                  {actualPaymentMethod && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs px-2 py-0.5">
                      💳 {actualPaymentMethod}
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
                    {loadingItems && lineItems.length === 0 ? (
                      <Badge className="text-base md:text-xl font-bold bg-muted text-muted-foreground px-3 py-1 animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        Cargando...
                      </Badge>
                    ) : (
                      <Badge className="text-base md:text-xl font-bold bg-primary text-primary-foreground px-3 py-1">
                        {totalRequiredUnits} {totalRequiredUnits === 1 ? 'unidad' : 'unidades'}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0 space-y-2 md:space-y-4">
                  {/* Error state - show retry button */}
                  {(lineItemsError || lineItemsTimeout) && lineItems.length === 0 && (
                    <Alert className="border-destructive/50 bg-destructive/5">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <AlertTitle className="text-destructive">
                        {lineItemsTimeout ? 'Tiempo de espera agotado' : 'Error al cargar productos'}
                      </AlertTitle>
                      <AlertDescription className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {lineItemsTimeout 
                            ? 'La carga de productos tomó demasiado tiempo. Intenta de nuevo.'
                            : 'No se pudieron cargar los productos. Verifica tu conexión e intenta de nuevo.'}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => refetchLineItems()}
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Reintentar
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Normal product list */}
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

              {/* Financial Summary - Dynamically calculated based on active items */}
              <div ref={financialSummaryRef} className="px-4 py-3 bg-muted/30 rounded-lg border border-muted">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(financialSummary.subtotal_price, effectiveOrder.shopify_order?.currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Envío</span>
                    <span className="font-medium">{formatCurrency(shippingAmount, effectiveOrder.shopify_order?.currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Impuestos {taxesIncluded && <span className="text-xs opacity-70">(incluido)</span>}
                    </span>
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
                    ref={skuInputRef}
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
                  
                  {/* Success message when all items verified */}
                  {allItemsVerified && effectiveOrder.operational_status !== 'ready_to_ship' && effectiveOrder.operational_status !== 'awaiting_pickup' && effectiveOrder.operational_status !== 'shipped' && (
                    <div className="p-3 bg-green-100 border-2 border-green-400 rounded-lg animate-pulse">
                      <div className="flex items-center justify-center gap-2 text-green-700 font-bold">
                        <CheckCircle className="w-5 h-5" />
                        ¡Verificación completa! Marcando como empacado...
                      </div>
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
                        {shippingLabel && shippingLabel.status !== 'error' && shippingLabel.status !== 'cancelled' && (
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm md:text-base flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Notas de Shopify
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSyncFromShopify}
                      disabled={isSyncingFromShopify || !!effectiveOrder?.shopify_order?.cancelled_at}
                      className="h-7 w-7 p-0"
                      title="Sincronizar nota desde Shopify"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingFromShopify ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0 space-y-2">
                  <Textarea
                    value={shopifyNote}
                    onChange={(e) => {
                      setShopifyNote(e.target.value);
                      setShopifyNoteSaveState('idle');
                    }}
                    placeholder="Agregar notas visibles en Shopify..."
                    className="min-h-[60px] md:min-h-[100px] text-sm"
                    disabled={!!effectiveOrder?.shopify_order?.cancelled_at || isSyncingFromShopify}
                  />
                  <Button
                    onClick={() => void handleSaveShopifyNote(false)}
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
                    {shopifyNoteSaveState === 'saving'
                      ? 'Guardando…'
                      : shopifyNoteSaveState === 'saved'
                        ? 'Guardado ✓'
                        : shopifyNoteSaveState === 'pending_sync'
                          ? 'Guardado localmente. Sincronización con Shopify pendiente.'
                          : 'ℹ️ Los cambios se sincronizan automáticamente con Shopify'}
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
                      // Update local state for immediate UI response
                      setLocalOrder(prev => prev ? {
                        ...prev,
                        shopify_order: {
                          ...prev.shopify_order,
                          tags: newTags
                        }
                      } : prev);
                      // Also update React Query cache so changes persist across modal opens
                      updateOrderOptimistically(prev => prev ? {
                        ...prev,
                        shopify_order: {
                          ...prev.shopify_order,
                          tags: newTags
                        }
                      } : prev);
                      // Force refetch to sync with DB (which gets synced from Shopify)
                      setTimeout(() => {
                        refetchCachedOrder();
                      }, 500);
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

          {/* Shipping Label Section - Hidden for Express and Pickup orders */}
          {effectiveOrder.shopify_order?.shopify_order_id && 
           !effectiveOrder.shopify_order?.cancelled_at && 
           shippingType?.label !== 'Recoger' && 
           shippingType?.label !== 'Express' && (
            <div className="border-t pt-4 mt-6">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">Guía de Envío</span>
              </div>
              <EnviaShippingButton
                apiRef={shippingButtonRef}
                shopifyOrderId={effectiveOrder.shopify_order.shopify_order_id}
                orderNumber={effectiveOrder.shopify_order.order_number}
                shippingAddress={shippingAddress}
                customerEmail={effectiveOrder.shopify_order.customer_email}
                customerPhone={effectiveOrder.shopify_order.customer_phone}
                totalPrice={calculatedTotal}
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

        {/* Sticky Floating Action Button - "Escanear" - visible cuando la orden no está empacada */}
        {!effectiveOrder.shopify_order?.cancelled_at && 
         effectiveOrder.operational_status !== 'ready_to_ship' && 
         effectiveOrder.operational_status !== 'awaiting_pickup' && 
         effectiveOrder.operational_status !== 'shipped' && (
          <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 z-10 pointer-events-none">
            <Button
              onClick={focusScanInput}
              title="Ctrl + . para escanear"
              className="h-11 md:h-14 px-4 md:px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm md:text-base gap-1.5 md:gap-2 pointer-events-auto"
            >
              <ScanLine className="w-4 h-4 md:w-5 md:h-5" />
              Escanear
            </Button>
          </div>
        )}

        {/* Sticky Floating Action Button - "Listo para Retiro" (pickup orders after packing) */}
        {!effectiveOrder.shopify_order?.cancelled_at && 
         effectiveOrder.operational_status === 'ready_to_ship' && 
         shippingType?.label === 'Recoger' && (
          <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 z-10 pointer-events-none">
            <Button
              onClick={handleReadyForPickup}
              disabled={isProcessingPickup}
              className="h-11 md:h-14 px-4 md:px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm md:text-base gap-1.5 md:gap-2 pointer-events-auto"
            >
              {isProcessingPickup ? (
                <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
              ) : (
                <>
                  <Store className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Listo para</span> Retiro
                </>
              )}
            </Button>
          </div>
        )}

        {/* Sticky Floating Action Button - "Marcar como Entregado" (awaiting_pickup orders) */}
        {!effectiveOrder.shopify_order?.cancelled_at && 
         effectiveOrder.operational_status === 'awaiting_pickup' && (
          <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 z-10 pointer-events-none">
            <Button
              onClick={handleConfirmPickupDelivery}
              disabled={isProcessingPickup}
              className="h-11 md:h-14 px-4 md:px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm md:text-base gap-1.5 md:gap-2 pointer-events-auto"
            >
              {isProcessingPickup ? (
                <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Marcar como</span> Entregado
                </>
              )}
            </Button>
          </div>
        )}

        {/* Sticky Floating Action Button - "Crear Guía" (shipping orders after packing) */}
        {!effectiveOrder.shopify_order?.cancelled_at && 
         effectiveOrder.operational_status === 'ready_to_ship' && 
         shippingType?.label !== 'Recoger' &&
         shippingType?.label !== 'Express' &&
         (!shippingLabel || shippingLabel.status === 'cancelled' || shippingLabel.status === 'error') && (
          <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 z-10 pointer-events-none">
            <Button
              variant="info"
              onClick={async () => {
                setIsCreatingShippingLabel(true);
                try {
                  await shippingButtonRef.current?.createLabelWithDefaults();
                } finally {
                  setIsCreatingShippingLabel(false);
                }
              }}
              disabled={isCreatingShippingLabel}
              className="h-11 md:h-14 px-4 md:px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-semibold text-sm md:text-base gap-1.5 md:gap-2 pointer-events-auto"
            >
              {isCreatingShippingLabel ? (
                <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
              ) : (
                <>
                  <Truck className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Crear</span> Guía
                  {selectedCarrierName && <span className="text-xs opacity-90">({selectedCarrierName})</span>}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};