import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

const MIN_ORDER_NUMBER = 62303;

export interface ParaEmpacarItem {
  id: string;
  orderNumber: number;
  shopifyOrderId: number;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  productId: number | null;
  variantId: number | null;
  imageUrl: string | null;
  properties: Array<{ name: string; value: string }> | null;
}

export const useParaEmpacarItems = () => {
  const { currentOrganization } = useOrganization();
  const [items, setItems] = useState<ParaEmpacarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    setError(null);

    try {
      // First get the orders that match "Para empacar" criteria
      const { data: orders, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('shopify_order_id, order_number')
        .eq('organization_id', currentOrganization.id)
        .gte('order_number', MIN_ORDER_NUMBER)
        .is('cancelled_at', null)
        .ilike('tags', '%confirmado%')
        .not('tags', 'ilike', '%empacado%')
        .in('financial_status', ['paid', 'pending', 'partially_paid'])
        .or('fulfillment_status.is.null,fulfillment_status.eq.unfulfilled');

      if (ordersError) throw ordersError;
      if (!orders || orders.length === 0) {
        setItems([]);
        return;
      }

      // Create a map of shopify_order_id to order_number
      const orderMap = new Map(orders.map(o => [o.shopify_order_id, o.order_number]));
      const orderIds = orders.map(o => o.shopify_order_id);

      // Fetch line items for these orders
      const { data: lineItems, error: lineItemsError } = await supabase
        .from('shopify_order_line_items')
        .select('id, shopify_order_id, title, variant_title, sku, quantity, price, product_id, variant_id, image_url, properties')
        .eq('organization_id', currentOrganization.id)
        .in('shopify_order_id', orderIds);

      if (lineItemsError) throw lineItemsError;

      const mappedItems: ParaEmpacarItem[] = (lineItems || []).map(item => ({
        id: item.id,
        orderNumber: Number(orderMap.get(item.shopify_order_id)) || 0,
        shopifyOrderId: item.shopify_order_id,
        title: item.title,
        variantTitle: item.variant_title,
        sku: item.sku,
        quantity: item.quantity,
        price: Number(item.price) || 0,
        productId: item.product_id,
        variantId: item.variant_id,
        imageUrl: item.image_url,
        properties: item.properties as Array<{ name: string; value: string }> | null,
      }));

      // Sort by order number descending
      mappedItems.sort((a, b) => b.orderNumber - a.orderNumber);

      setItems(mappedItems);
    } catch (err) {
      console.error('Error fetching para empacar items:', err);
      setError('Error al cargar los artículos');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueOrders = new Set(items.map(item => item.orderNumber)).size;

  return { items, loading, error, fetchItems, totalQuantity, uniqueOrders };
};
