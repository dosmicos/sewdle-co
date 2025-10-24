import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';

export type OperationalStatus = 'pending' | 'picking' | 'packing' | 'ready_to_ship' | 'shipped';

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
    raw_data?: any;
  };
  
  // Line items
  line_items?: any[];
}

export const usePickingOrders = () => {
  const [orders, setOrders] = useState<PickingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  const autoInitializePickingOrders = async () => {
    try {
      // Find Shopify orders without a picking_packing_order
      const { data: shopifyOrders, error: fetchError } = await supabase
        .from('shopify_orders')
        .select(`
          id,
          shopify_order_id,
          picking_packing_orders!left(id)
        `)
        .eq('organization_id', currentOrganization?.id)
        .is('picking_packing_orders.id', null);

      if (fetchError) throw fetchError;

      if (!shopifyOrders || shopifyOrders.length === 0) {
        return; // All orders already initialized
      }

      // Create picking_packing_orders for new Shopify orders
      const ordersToInitialize = shopifyOrders.map(order => ({
        shopify_order_id: order.shopify_order_id,
        organization_id: currentOrganization?.id,
        operational_status: 'pending' as OperationalStatus
      }));

      const { error: insertError } = await supabase
        .from('picking_packing_orders')
        .insert(ordersToInitialize);

      if (insertError) {
        console.error('Error auto-inicializando órdenes:', insertError);
      } else {
        console.log(`✅ ${ordersToInitialize.length} órdenes auto-inicializadas`);
      }
    } catch (error: any) {
      console.error('Error en auto-inicialización:', error);
    }
  };

  const fetchOrders = async (filters?: {
    status?: OperationalStatus;
    searchTerm?: string;
  }) => {
    try {
      setLoading(true);
      
      // First, auto-initialize any new Shopify orders
      await autoInitializePickingOrders();
      
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
            raw_data
          )
        `)
        .eq('organization_id', currentOrganization?.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('operational_status', filters.status);
      }

      if (filters?.searchTerm) {
        query = query.or(`order_number.ilike.%${filters.searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        setOrders([]);
        return;
      }

      // Simply set orders without line items for now to avoid type errors
      // Line items will be fetched in the modal when needed
      const ordersData = data.map((order: any) => ({
        ...order,
        line_items: []
      }));

      setOrders(ordersData as PickingOrder[]);
    } catch (error: any) {
      console.error('Error fetching picking orders:', error);
      toast.error('Error al cargar órdenes');
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
          ready_to_ship: 'LISTO_PARA_ENVIO',
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

  const updateShopifyTags = async (shopifyOrderId: number, tags: string[]) => {
    try {
      const { error } = await supabase.functions.invoke('update-shopify-order', {
        body: {
          orderId: shopifyOrderId,
          action: 'update_tags',
          data: { tags }
        }
      });

      if (error) throw error;
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
      const { data: existingOrder } = await supabase
        .from('picking_packing_orders')
        .select('id')
        .eq('shopify_order_id', shopifyOrderId)
        .single();

      if (existingOrder) return;

      const { error } = await supabase
        .from('picking_packing_orders')
        .insert({
          shopify_order_id: shopifyOrderId,
          organization_id: currentOrganization?.id,
          operational_status: 'pending'
        });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error initializing picking order:', error);
    }
  };

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchOrders();
    }
  }, [currentOrganization?.id]);

  return {
    orders,
    loading,
    fetchOrders,
    updateOrderStatus,
    updateOrderNotes,
    syncOrderToShopify,
    initializePickingOrder,
  };
};