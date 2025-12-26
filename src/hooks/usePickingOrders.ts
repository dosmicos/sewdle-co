import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { logger } from '@/lib/logger';

export type OperationalStatus = 'pending' | 'picking' | 'packing' | 'ready_to_ship' | 'awaiting_pickup' | 'shipped';

// Helper function to map Shopify tags to operational status
const getOperationalStatusFromTags = (
  tags: string | undefined, 
  currentStatus: OperationalStatus
): OperationalStatus => {
  if (!tags) return currentStatus;
  
  const tagsLower = tags.toLowerCase().trim();
  
  // Priority 1: EMPACADO (overrides all statuses except shipped)
  if (tagsLower.includes('empacado') && currentStatus !== 'shipped') {
    return 'ready_to_ship';
  }
  
  // Priority 2: Confirmado (shows in pending filter)
  if (tagsLower.includes('confirmado') && currentStatus === 'pending') {
    return 'pending';
  }
  
  return currentStatus;
};

export interface PickingOrder {
  id: string;
  shopify_order_id: number;
  organization_id: string;
  operational_status: OperationalStatus;
  created_at: string;
  updated_at: string;
  picked_at?: string;
  picked_by?: string;
  packed_at?: string;
  packed_by?: string;
  shipped_at?: string;
  shipped_by?: string;
  internal_notes?: string;
  
  // Shopify order data
  shopify_order?: {
    id: string;
    shopify_order_id: number;
    order_number: string;
    email: string;
    created_at_shopify: string;
    financial_status?: string;
    fulfillment_status?: string;
    customer_first_name?: string;
    customer_last_name?: string;
    customer_phone?: string;
    customer_email?: string;
    total_price?: number;
    currency?: string;
    note?: string;
    tags?: string;
    cancelled_at?: string;
    raw_data?: any;
  };
  
  // Line items
  line_items?: any[];
}

export const usePickingOrders = () => {
  const [orders, setOrders] = useState<PickingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { currentOrganization } = useOrganization();
  
  const pageSize = 100;

  const autoInitializePickingOrders = async () => {
    if (!currentOrganization?.id) return;

    try {
      logger.info('[PickingOrders] Verificando órdenes recientes para inicializar');

      // Solo verificar las últimas 500 órdenes de Shopify (las más recientes)
      const { data: recentShopify, error: shopifyError } = await supabase
        .from('shopify_orders')
        .select('shopify_order_id, order_number')
        .eq('organization_id', currentOrganization.id)
        .order('created_at_shopify', { ascending: false })
        .limit(500);

      if (shopifyError) {
        logger.error('[PickingOrders] Error fetching Shopify orders', shopifyError);
        return;
      }

      // Obtener picking orders existentes (últimas 500)
      const { data: existingPicking, error: pickingError } = await supabase
        .from('picking_packing_orders')
        .select('shopify_order_id')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (pickingError) {
        logger.error('[PickingOrders] Error fetching picking orders', pickingError);
        return;
      }

      // Encontrar órdenes que necesitan inicialización
      const existingSet = new Set(existingPicking?.map(p => p.shopify_order_id) || []);
      const toInitialize = recentShopify
        ?.filter(s => !existingSet.has(s.shopify_order_id))
        .map(s => ({
          shopify_order_id: s.shopify_order_id,
          organization_id: currentOrganization.id,
          operational_status: 'pending' as OperationalStatus,
          order_number: s.order_number
        })) || [];

      if (toInitialize.length > 0) {
        logger.info(`[PickingOrders] Inicializando ${toInitialize.length} órdenes recientes`);
        
        const { error: insertError } = await supabase
          .from('picking_packing_orders')
          .upsert(toInitialize, {
            onConflict: 'organization_id,shopify_order_id',
            ignoreDuplicates: true
          });

        if (insertError) {
          logger.error('[PickingOrders] Error inicializando órdenes', insertError);
        }
      }
    } catch (error) {
      logger.error('[PickingOrders] Error inesperado en auto-init', error);
    }
  };

  const fetchOrders = async (filters?: {
    searchTerm?: string;
    operationalStatuses?: string[];
    financialStatuses?: string[];
    fulfillmentStatuses?: string[];
    tags?: string[];
    excludeTags?: string[];
    priceRange?: string;
    dateRange?: string;
    shippingMethod?: string;
    excludeShippingMethod?: string;
    page?: number;
  }) => {
    if (!currentOrganization?.id) {
      logger.warn('[PickingOrders] Organización no cargada aún, esperando...');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const page = filters?.page || currentPage;
      const MIN_ORDER_NUMBER = '62303';
      
      logger.info('[PickingOrders] Fetching orders (optimized)', { 
        organizationId: currentOrganization?.id,
        filters,
        page
      });
      
      // Build optimized query with DB-level filters
      let query = supabase
        .from('picking_packing_orders')
        .select(`
          *,
          shopify_order:shopify_orders!inner(
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
        `, { count: 'exact' })
        .eq('organization_id', currentOrganization?.id)
        // Apply MIN_ORDER_NUMBER filter at DB level
        .gte('order_number', MIN_ORDER_NUMBER);

      // Apply financial_status filter at DB level
      if (filters?.financialStatuses && filters.financialStatuses.length > 0) {
        query = query.in('shopify_order.financial_status', filters.financialStatuses);
      }

      // Apply cancelled_at filter at DB level when filtering by "confirmado"
      if (filters?.tags && filters.tags.some(tag => tag.toLowerCase() === 'confirmado')) {
        query = query.is('shopify_order.cancelled_at', null);
        // Also filter unfulfilled only
        query = query.or('fulfillment_status.is.null,fulfillment_status.eq.unfulfilled', { foreignTable: 'shopify_order' });
      }

      // Search filter - only filter by order_number at DB level
      // Customer name/email search will be done in-memory after fetch
      if (filters?.searchTerm) {
        const term = filters.searchTerm;
        query = query.ilike('order_number', `%${term}%`);
      }

      query = query.order('order_number', { ascending: false });

      // Fetch with reduced limit (most orders will be filtered at DB level now)
      const MAX_RECORDS = 500;
      const { data, error, count } = await query.limit(MAX_RECORDS);

      if (error) {
        logger.error('[PickingOrders] Error fetching orders', error);
        throw error;
      }

      if (!data || data.length === 0) {
        logger.info('[PickingOrders] No orders found');
        setOrders([]);
        setTotalCount(0);
        setCurrentPage(page);
        return;
      }

      // Map orders and apply tag-based status mapping
      let ordersData = data.map((order: any) => {
        const mappedStatus = getOperationalStatusFromTags(
          order.shopify_order?.tags,
          order.operational_status
        );
        
        return {
          ...order,
          operational_status: mappedStatus,
          line_items: []
        };
      });

      // Apply remaining in-memory filters (tags, excludeTags, operationalStatuses)
      
      // Filter by operational_status AFTER tag mapping
      if (filters?.operationalStatuses && filters.operationalStatuses.length > 0) {
        ordersData = ordersData.filter((order: any) => 
          filters.operationalStatuses?.includes(order.operational_status)
        );
      }

      // Filter by tags (INCLUIR) - requires ALL tags to be present (AND logic)
      if (filters?.tags && filters.tags.length > 0) {
        ordersData = ordersData.filter((order: any) => {
          const orderTags = (order.shopify_order?.tags || '').toLowerCase().split(',').map((t: string) => t.trim());
          return filters.tags?.every(tag => orderTags.includes(tag.toLowerCase()));
        });
      }

      // Filter by exclude_tags (EXCLUIR)
      if (filters?.excludeTags && filters.excludeTags.length > 0) {
        ordersData = ordersData.filter((order: any) => {
          const orderTags = (order.shopify_order?.tags || '').toLowerCase().split(',').map((t: string) => t.trim());
          return !filters.excludeTags?.some(tag => orderTags.includes(tag.toLowerCase()));
        });
      }

      // In-memory search filter for customer name/email (DB filter only catches order_number)
      if (filters?.searchTerm && filters.searchTerm.length > 0) {
        const searchLower = filters.searchTerm.toLowerCase();
        ordersData = ordersData.filter((order: any) => {
          const orderNumber = order.order_number?.toLowerCase() || '';
          const customerEmail = order.shopify_order?.customer_email?.toLowerCase() || '';
          const firstName = order.shopify_order?.customer_first_name?.toLowerCase() || '';
          const lastName = order.shopify_order?.customer_last_name?.toLowerCase() || '';
          
          return orderNumber.includes(searchLower) ||
                 customerEmail.includes(searchLower) ||
                 firstName.includes(searchLower) ||
                 lastName.includes(searchLower);
        });
      }

      // Filter by price range
      if (filters?.priceRange) {
        const [minStr, maxStr] = filters.priceRange.split('-');
        const min = parseFloat(minStr);
        const max = parseFloat(maxStr);
        
        ordersData = ordersData.filter((order: any) => {
          const price = order.shopify_order?.total_price || 0;
          return price >= min && price <= max;
        });
      }

      // Filter by date range
      if (filters?.dateRange) {
        const now = new Date();
        let startDate: Date;
        
        switch (filters.dateRange) {
          case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = new Date(yesterday.setHours(0, 0, 0, 0));
            break;
          case 'last_7_days':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case 'last_30_days':
            startDate = new Date(now.setDate(now.getDate() - 30));
            break;
          default:
            startDate = new Date(0);
        }
        
        ordersData = ordersData.filter((order: any) => {
          const orderDate = new Date(order.shopify_order?.created_at_shopify || order.created_at);
          return orderDate >= startDate;
        });
      }

      // Filter by shipping method
      if (filters?.shippingMethod) {
        const shippingFilter = filters.shippingMethod.toLowerCase();
        ordersData = ordersData.filter((order: any) => {
          const shippingTitle = order.shopify_order?.raw_data?.shipping_lines?.[0]?.title || '';
          return shippingTitle.toLowerCase().includes(shippingFilter);
        });
      }

      // Exclude by shipping method
      if (filters?.excludeShippingMethod) {
        const excludeFilter = filters.excludeShippingMethod.toLowerCase();
        ordersData = ordersData.filter((order: any) => {
          const shippingTitle = order.shopify_order?.raw_data?.shipping_lines?.[0]?.title || '';
          return !shippingTitle.toLowerCase().includes(excludeFilter);
        });
      }

      // Calculate total after all filters
      const filteredTotalCount = ordersData.length;

      // Apply pagination in memory
      const offset = (page - 1) * pageSize;
      const paginatedOrders = ordersData.slice(offset, offset + pageSize);

      logger.info(`[PickingOrders] Query optimizada: ${paginatedOrders.length} de ${filteredTotalCount} órdenes (${Date.now()}ms)`);

      setOrders(paginatedOrders as PickingOrder[]);
      setTotalCount(filteredTotalCount);
      setCurrentPage(page);
    } catch (error: any) {
      logger.error('[PickingOrders] Error fetching picking orders', error);
      toast.error('Error al cargar órdenes');
      setOrders([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (
    pickingOrderId: string,
    newStatus: OperationalStatus,
    shopifyOrderId?: number
  ) => {
    try {
      const updates: any = {
        operational_status: newStatus,
      };

      // Set timestamps based on status
      if (newStatus === 'picking' && !orders.find(o => o.id === pickingOrderId)?.picked_at) {
        updates.picked_at = new Date().toISOString();
        updates.picked_by = (await supabase.auth.getUser()).data.user?.id;
      } else if (newStatus === 'packing' && !orders.find(o => o.id === pickingOrderId)?.packed_at) {
        updates.packed_at = new Date().toISOString();
        updates.packed_by = (await supabase.auth.getUser()).data.user?.id;
      } else if (newStatus === 'ready_to_ship') {
        updates.packed_at = new Date().toISOString();
        updates.packed_by = (await supabase.auth.getUser()).data.user?.id;
      } else if (newStatus === 'shipped') {
        updates.shipped_at = new Date().toISOString();
        updates.shipped_by = (await supabase.auth.getUser()).data.user?.id;
      }

      const { error } = await supabase
        .from('picking_packing_orders')
        .update(updates)
        .eq('id', pickingOrderId);

      if (error) throw error;

      // Update tags in Shopify
      // Use provided shopifyOrderId or fallback to searching in orders array
      const order = orders.find(o => o.id === pickingOrderId);
      const effectiveShopifyOrderId = shopifyOrderId || order?.shopify_order_id;
      
      if (!effectiveShopifyOrderId) {
        console.error('❌ MISSING SHOPIFY_ORDER_ID:', {
          pickingOrderId,
          providedShopifyOrderId: shopifyOrderId,
          ordersCount: orders.length,
          foundInOrders: !!order
        });
        toast.error('Error: No se pudo actualizar etiquetas en Shopify (ID no encontrado)');
        return;
      }
      
      const statusTags: Record<OperationalStatus, string> = {
        pending: 'PENDIENTE',
        picking: 'PICKING_EN_PROCESO',
        packing: 'EMPACANDO',
        ready_to_ship: 'EMPACADO',
        awaiting_pickup: 'LISTO_PARA_RETIRO',
        shipped: 'ENVIADO'
      };

      try {
        console.log('🏷️ Updating Shopify tags for order:', effectiveShopifyOrderId, 'with tag:', statusTags[newStatus]);
        await updateShopifyTags(effectiveShopifyOrderId, [statusTags[newStatus]]);
      } catch (tagError) {
        console.error('❌ CRITICAL: Tag update failed:', tagError);
        toast.error('Error al actualizar etiquetas en Shopify');
        throw tagError;
      }

      toast.success('Estado actualizado correctamente');
      await fetchOrders();
    } catch (error: any) {
      console.error('Error updating order status:', error);
      toast.error('Error al actualizar estado');
    }
  };

  const updateShopifyTags = async (shopifyOrderId: number, newTags: string[]) => {
    try {
      console.log(`🏷️ Agregando tags a orden ${shopifyOrderId} usando merge:`, newTags);
      
      // Use add_tags action - reads from Shopify, merges, and updates
      const { data: shopifyResponse, error: shopifyError } = await supabase.functions.invoke('update-shopify-order', {
        body: {
          orderId: shopifyOrderId,
          action: 'add_tags',
          data: { tags: newTags }
        }
      });

      if (shopifyError) {
        console.error(`❌ Error Shopify para orden ${shopifyOrderId}:`, shopifyError);
        throw shopifyError;
      }
      
      if (!shopifyResponse?.success) {
        throw new Error(shopifyResponse?.error || 'Error updating Shopify');
      }
      
      console.log(`✅ Shopify actualizado para orden ${shopifyOrderId}`);
      
      // Update local DB with final tags from Shopify response
      const finalTagsString = shopifyResponse.finalTags 
        ? (Array.isArray(shopifyResponse.finalTags) ? shopifyResponse.finalTags.join(', ') : shopifyResponse.finalTags)
        : newTags.join(', ');
      
      const { error: dbError } = await supabase
        .from('shopify_orders')
        .update({ 
          tags: finalTagsString,
          updated_at: new Date().toISOString()
        })
        .eq('shopify_order_id', shopifyOrderId);
        
      if (dbError) {
        console.error(`❌ Error DB para orden ${shopifyOrderId}:`, dbError);
        throw dbError;
      }
      
      console.log(`✅ Tags actualizados en Shopify y DB para orden ${shopifyOrderId}:`, finalTagsString);
        
    } catch (error: any) {
      console.error(`❌ Error updating Shopify tags para orden ${shopifyOrderId}:`, error);
      throw error;
    }
  };

  const updateOrderNotes = async (pickingOrderId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('picking_packing_orders')
        .update({ internal_notes: notes })
        .eq('id', pickingOrderId);

      if (error) throw error;

      toast.success('Notas actualizadas');
      await fetchOrders();
    } catch (error: any) {
      console.error('Error updating notes:', error);
      toast.error('Error al actualizar notas');
    }
  };

  const updateShopifyNote = async (shopifyOrderId: string, note: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('update-shopify-order-note', {
        body: { shopifyOrderId, note }
      });

      if (error) throw error;

      logger.info('Shopify note updated', { shopifyOrderId });
      
      toast.success('Nota sincronizada con Shopify');
      await fetchOrders();
    } catch (error: any) {
      console.error('Error updating Shopify note:', error);
      toast.error('Error al actualizar nota en Shopify');
      throw error;
    }
  };

  const syncOrderToShopify = async (pickingOrderId: string) => {
    try {
      const order = orders.find(o => o.id === pickingOrderId);
      if (!order) return;

      // Update notes in Shopify if they exist
      if (order.internal_notes) {
        await supabase.functions.invoke('update-shopify-order', {
          body: {
            orderId: order.shopify_order_id,
            action: 'update_notes',
            data: { notes: order.internal_notes }
          }
        });
      }

      toast.success('Sincronizado con Shopify');
    } catch (error: any) {
      console.error('Error syncing to Shopify:', error);
      toast.error('Error al sincronizar');
    }
  };

  const bulkUpdateOrderStatus = async (
    pickingOrderIds: string[],
    newStatus: OperationalStatus
  ) => {
    const results = {
      successful: [] as string[],
      failed: [] as string[],
    };

    console.log(`🔄 Iniciando actualización masiva de ${pickingOrderIds.length} órdenes a estado: ${newStatus}`);

    // Process in batches of 5 to avoid overwhelming Shopify API
    const batchSize = 5;
    for (let i = 0; i < pickingOrderIds.length; i += batchSize) {
      const batch = pickingOrderIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (orderId) => {
        try {
          await updateOrderStatus(orderId, newStatus);
          results.successful.push(orderId);
          console.log(`✅ Orden ${orderId} actualizada correctamente`);
        } catch (error) {
          console.error(`❌ Error actualizando orden ${orderId}:`, error);
          results.failed.push(orderId);
        }
      });

      await Promise.all(batchPromises);
      
      // Show progress
      const processed = Math.min(i + batchSize, pickingOrderIds.length);
      console.log(`📊 Progreso: ${processed}/${pickingOrderIds.length}`);
    }

    // Show final results
    if (results.successful.length === pickingOrderIds.length) {
      toast.success(`✅ ${results.successful.length} órdenes actualizadas correctamente`);
    } else if (results.successful.length > 0) {
      toast.warning(
        `⚠️ ${results.successful.length} órdenes actualizadas, ${results.failed.length} fallaron`
      );
    } else {
      toast.error(`❌ Error al actualizar las órdenes`);
    }

    console.log('📊 Resultados finales:', results);
    
    // Refresh orders list
    await fetchOrders();
    
    return results;
  };

  const bulkUpdateOrdersByDate = async (
    beforeDate: string,
    newStatus: OperationalStatus
  ) => {
    if (!currentOrganization?.id) {
      throw new Error('No organization selected');
    }

    console.log(`🗓️ Actualizando órdenes antes de ${beforeDate} a estado: ${newStatus}`);

    // 1. Obtener todas las órdenes (excepto las ya enviadas)
    const { data: allOrders, error: fetchError } = await supabase
      .from('picking_packing_orders')
      .select(`
        id, 
        shopify_order_id, 
        operational_status,
        shopify_orders!inner(
          id,
          order_number,
          created_at_shopify
        )
      `)
      .eq('organization_id', currentOrganization.id)
      .neq('operational_status', 'shipped');

    if (fetchError) {
      console.error('❌ Error fetching orders:', fetchError);
      throw fetchError;
    }

    // 2. Filtrar en JavaScript las órdenes antiguas
    const ordersToUpdate = allOrders?.filter(order => {
      const shopifyDate = order.shopify_orders?.created_at_shopify;
      if (!shopifyDate) return false;
      return new Date(shopifyDate) < new Date(beforeDate);
    }) || [];

    if (ordersToUpdate.length === 0) {
      console.log('ℹ️ No hay órdenes para actualizar con ese criterio');
      toast.info('No hay órdenes para actualizar con ese criterio');
      return { successful: [], failed: [], total: 0 };
    }

    // 3. Ordenar por fecha de Shopify
    ordersToUpdate.sort((a, b) => {
      const dateA = new Date(a.shopify_orders.created_at_shopify);
      const dateB = new Date(b.shopify_orders.created_at_shopify);
      return dateA.getTime() - dateB.getTime();
    });

    console.log(`📦 Total de órdenes a procesar: ${ordersToUpdate.length}`);
    toast.info(`Iniciando actualización de ${ordersToUpdate.length} órdenes...`);

    const results = {
      successful: [] as string[],
      failed: [] as string[],
      total: ordersToUpdate.length
    };

    // 2. Procesar en lotes de 20 (solo actualización local)
    const batchSize = 20;
    for (let i = 0; i < ordersToUpdate.length; i += batchSize) {
      const batch = ordersToUpdate.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (order) => {
        try {
          // Solo actualizar estado local, SIN llamar a Shopify
          const { data: userData } = await supabase.auth.getUser();
          const { error } = await supabase
            .from('picking_packing_orders')
            .update({
              operational_status: newStatus,
              shipped_at: new Date().toISOString(),
              shipped_by: userData.user?.id
            })
            .eq('id', order.id);
          
          if (error) throw error;
          
          results.successful.push(order.id);
          console.log(`✅ Orden ${order.shopify_order_id} actualizada localmente (${results.successful.length}/${ordersToUpdate.length})`);
        } catch (error: any) {
          console.error(`❌ Error actualizando orden ${order.shopify_order_id}:`, error);
          results.failed.push(order.id);
        }
      });

      await Promise.all(batchPromises);
      
      // Mostrar progreso
      const processed = Math.min(i + batchSize, ordersToUpdate.length);
      console.log(`📊 Progreso: ${processed}/${ordersToUpdate.length}`);
      
      // Toast de progreso cada 20 órdenes
      if (processed % 20 === 0 || processed === ordersToUpdate.length) {
        toast.info(`Procesando: ${processed}/${ordersToUpdate.length} órdenes`);
      }
    }

    // Mostrar resultados finales
    if (results.successful.length === results.total) {
      toast.success(`✅ ${results.successful.length} órdenes actualizadas correctamente`);
    } else if (results.successful.length > 0) {
      toast.warning(
        `⚠️ ${results.successful.length} órdenes actualizadas, ${results.failed.length} fallaron`
      );
    } else {
      toast.error(`❌ Error al actualizar las órdenes`);
    }

    console.log('📊 Resultados finales:', results);
    
    // Refrescar lista
    await fetchOrders();
    
    return results;
  };

  const initializePickingOrder = async (shopifyOrderId: number) => {
    try {
      // Get order_number from shopify_orders
      const { data: shopifyOrder } = await supabase
        .from('shopify_orders')
        .select('order_number')
        .eq('shopify_order_id', shopifyOrderId)
        .eq('organization_id', currentOrganization?.id)
        .single();

      const { error } = await supabase
        .from('picking_packing_orders')
        .upsert({
          shopify_order_id: shopifyOrderId,
          organization_id: currentOrganization?.id,
          operational_status: 'pending',
          order_number: shopifyOrder?.order_number || ''
        }, { 
          onConflict: 'organization_id,shopify_order_id',
          ignoreDuplicates: true 
        });

      if (error) throw error;
      
      logger.info(`[PickingOrders] Orden ${shopifyOrderId} inicializada correctamente`);
    } catch (error: any) {
      console.error('Error initializing picking order:', error);
    }
  };

  // Nota: No hacemos fetch automático aquí - la página controla la carga con filtros de URL
  // Esto evita la condición de carrera donde un fetch sin filtros sobrescribía los datos filtrados
  // Mantenemos el useEffect para preservar el número de hooks (reglas de React)
  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(true);
    }
  }, [currentOrganization?.id]);

  return {
    orders,
    loading,
    currentPage,
    totalCount,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
    fetchOrders,
    updateOrderStatus,
    bulkUpdateOrderStatus,
    bulkUpdateOrdersByDate,
    updateOrderNotes,
    updateShopifyNote,
    syncOrderToShopify,
    initializePickingOrder,
  };
};