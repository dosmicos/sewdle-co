import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { logger } from '@/lib/logger';

export type OperationalStatus = 'pending' | 'picking' | 'packing' | 'ready_to_ship' | 'shipped';

// Helper function to map Shopify tags to operational status
const getOperationalStatusFromTags = (
  tags: string | undefined, 
  currentStatus: OperationalStatus
): OperationalStatus => {
  if (!tags) return currentStatus;
  
  const tagsLower = tags.toLowerCase().trim();
  
  // Priority 1: EMPACADO (overrides all statuses except shipped)
  if (tagsLower.includes('empacado') && currentStatus !== 'shipped') {
    return 'packing';
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
  operational_status: OperationalStatus;
  created_at: string;
  updated_at: string;
  picked_at?: string;
  packed_at?: string;
  shipped_at?: string;
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
        .select('shopify_order_id')
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
          operational_status: 'pending' as OperationalStatus
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
    status?: OperationalStatus;
    searchTerm?: string;
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
      const offset = (page - 1) * pageSize;
      
      logger.info('[PickingOrders] Fetching orders', { 
        organizationId: currentOrganization?.id,
        filters,
        page,
        offset
      });
      
      // First, auto-initialize any new Shopify orders
      await autoInitializePickingOrders();
      
      // Step 1: If searchTerm exists, find matching shopify_order_ids
      let matchingShopifyOrderIds: number[] | null = null;
      
      if (filters?.searchTerm) {
        logger.info('[PickingOrders] Buscando órdenes con término:', filters.searchTerm);
        
        const { data: matchingOrders, error: searchError } = await supabase
          .from('shopify_orders')
          .select('shopify_order_id')
          .eq('organization_id', currentOrganization.id)
          .or(`order_number.ilike.%${filters.searchTerm}%,customer_email.ilike.%${filters.searchTerm}%,customer_first_name.ilike.%${filters.searchTerm}%,customer_last_name.ilike.%${filters.searchTerm}%`);
        
        if (searchError) {
          logger.error('[PickingOrders] Error en búsqueda de Shopify orders', searchError);
          throw searchError;
        }
        
        matchingShopifyOrderIds = matchingOrders?.map(o => o.shopify_order_id) || [];
        
        logger.info(`[PickingOrders] Encontradas ${matchingShopifyOrderIds.length} órdenes coincidentes`);
        
        // Si no hay coincidencias, devolver vacío
        if (matchingShopifyOrderIds.length === 0) {
          setOrders([]);
          setTotalCount(0);
          setCurrentPage(page);
          return;
        }
      }
      
      // Step 2: Query picking_packing_orders
      let query = supabase
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
      `, { count: 'exact' })
        .eq('organization_id', currentOrganization?.id)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (filters?.status) {
        query = query.eq('operational_status', filters.status);
      }

      // Apply search filter using the matching IDs
      if (matchingShopifyOrderIds !== null) {
        query = query.in('shopify_order_id', matchingShopifyOrderIds);
      }

      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

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

      // Special filter for "No preparados" (pending)
      // Must have "Confirmado" tag AND NOT have "EMPACADO" or "Empacado" tag
      if (filters?.status === 'pending') {
        ordersData = ordersData.filter((order: any) => {
          const tags = (order.shopify_order?.tags || '').toLowerCase().trim();
          
          // Must have "confirmado"
          const hasConfirmado = tags.includes('confirmado');
          
          // Must NOT have "empacado" (catches both "EMPACADO" and "Empacado")
          const hasEmpacado = tags.includes('empacado');
          
          return hasConfirmado && !hasEmpacado;
        });
        
        logger.info(`[PickingOrders] Filtered "No preparados": ${ordersData.length} orders with "Confirmado" but without "EMPACADO"`);
      }

      logger.info(`[PickingOrders] Órdenes cargadas exitosamente: ${ordersData.length}`, {
        count: ordersData.length,
        totalCount: count,
        page,
        firstOrder: ordersData[0]?.shopify_order?.order_number,
        hasShopifyOrder: !!ordersData[0]?.shopify_order
      });

      setOrders(ordersData as PickingOrder[]);
      setTotalCount(count || 0);
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
    newStatus: OperationalStatus
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
      } else if (newStatus === 'ready_to_ship' || newStatus === 'shipped') {
        updates.shipped_at = new Date().toISOString();
        updates.shipped_by = (await supabase.auth.getUser()).data.user?.id;
      }

      const { error } = await supabase
        .from('picking_packing_orders')
        .update(updates)
        .eq('id', pickingOrderId);

      if (error) throw error;

      // Update tags in Shopify
      const order = orders.find(o => o.id === pickingOrderId);
      if (order) {
        const statusTags = {
          pending: 'PENDIENTE',
          picking: 'PICKING_EN_PROCESO',
          packing: 'EMPACANDO',
          ready_to_ship: 'EMPACADO',
          shipped: 'ENVIADO'
        };

        await updateShopifyTags(order.shopify_order_id, [statusTags[newStatus]]);
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
      // 1. Obtener etiquetas existentes del pedido
      const order = orders.find(o => o.shopify_order_id === shopifyOrderId);
      const existingTags = order?.shopify_order?.tags 
        ? order.shopify_order.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];
      
      // 2. Combinar con nuevas etiquetas (sin duplicados)
      const allTags = [...new Set([...existingTags, ...newTags])];
      
      // 3. Actualizar en Shopify
      const { error } = await supabase.functions.invoke('update-shopify-order', {
        body: {
          orderId: shopifyOrderId,
          action: 'update_tags',
          data: { tags: allTags }
        }
      });

      if (error) throw error;
      
      // 4. Actualizar localmente la orden de Shopify en nuestra DB
      await supabase
        .from('shopify_orders')
        .update({ tags: allTags.join(', ') })
        .eq('shopify_order_id', shopifyOrderId);
        
    } catch (error: any) {
      console.error('Error updating Shopify tags:', error);
      // Don't throw - tags are supplementary
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

  const initializePickingOrder = async (shopifyOrderId: number) => {
    try {
      const { error } = await supabase
        .from('picking_packing_orders')
        .upsert({
          shopify_order_id: shopifyOrderId,
          organization_id: currentOrganization?.id,
          operational_status: 'pending'
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

  useEffect(() => {
    if (currentOrganization?.id) {
      logger.info('[PickingOrders] Organización cargada, iniciando fetch');
      fetchOrders();
    } else {
      logger.info('[PickingOrders] Esperando carga de organización...');
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
    updateOrderNotes,
    syncOrderToShopify,
    initializePickingOrder,
  };
};