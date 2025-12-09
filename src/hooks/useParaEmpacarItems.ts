import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

const MIN_ORDER_NUMBER = 62303;

export interface ParaEmpacarItem {
  id: string;
  orderNumbers: number[];
  shopifyOrderIds: number[];
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  productId: number | null;
  variantId: number | null;
  imageUrl: string | null;
  properties: Array<{ name: string; value: string }> | null;
  hasCustomization: boolean;
}

// Detecta si un artículo tiene personalización (bordado)
const hasCustomization = (properties: Array<{ name: string; value: string }> | null): boolean => {
  if (!properties || properties.length === 0) return false;
  
  const customizationNames = ['nombre bordado', 'para', 'nombre'];
  
  return properties.some(prop => 
    customizationNames.includes(prop.name.toLowerCase()) && 
    prop.value && 
    prop.value.trim() !== ''
  );
};

// Genera clave de agrupación
const getGroupKey = (item: {
  sku: string | null;
  variantTitle: string | null;
  variantId: number | null;
  properties: Array<{ name: string; value: string }> | null;
  id: string;
}): string => {
  if (hasCustomization(item.properties)) {
    return `custom_${item.id}`;
  }
  return `${item.sku || 'no-sku'}_${item.variantTitle || 'no-variant'}_${item.variantId || 'no-id'}`;
};

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

      const orderMap = new Map(orders.map(o => [o.shopify_order_id, o.order_number]));
      const orderIds = orders.map(o => o.shopify_order_id);

      const { data: lineItems, error: lineItemsError } = await supabase
        .from('shopify_order_line_items')
        .select('id, shopify_order_id, title, variant_title, sku, quantity, price, product_id, variant_id, image_url, properties')
        .eq('organization_id', currentOrganization.id)
        .in('shopify_order_id', orderIds);

      if (lineItemsError) throw lineItemsError;

      // Obtener imágenes fallback de productos para items sin imagen
      const skusWithoutImage = [...new Set(
        (lineItems || [])
          .filter(item => !item.image_url && item.sku)
          .map(item => item.sku)
      )];

      let skuImageMap = new Map<string, string>();
      if (skusWithoutImage.length > 0) {
        const { data: variantsWithImages } = await supabase
          .from('product_variants')
          .select('sku_variant, products!inner(image_url)')
          .in('sku_variant', skusWithoutImage);

        if (variantsWithImages) {
          variantsWithImages.forEach((v: any) => {
            if (v.products?.image_url) {
              skuImageMap.set(v.sku_variant, v.products.image_url);
            }
          });
        }
      }

      // Agrupar artículos por SKU+variante (excepto los personalizados)
      const groupedItems = new Map<string, ParaEmpacarItem>();

      (lineItems || []).forEach(item => {
        const orderNumber = Number(orderMap.get(item.shopify_order_id)) || 0;
        const properties = item.properties as Array<{ name: string; value: string }> | null;
        const isCustomized = hasCustomization(properties);
        const groupKey = getGroupKey({
          sku: item.sku,
          variantTitle: item.variant_title,
          variantId: item.variant_id,
          properties,
          id: item.id
        });

        if (groupedItems.has(groupKey)) {
          const existing = groupedItems.get(groupKey)!;
          existing.quantity += item.quantity;
          if (!existing.orderNumbers.includes(orderNumber)) {
            existing.orderNumbers.push(orderNumber);
          }
          if (!existing.shopifyOrderIds.includes(item.shopify_order_id)) {
            existing.shopifyOrderIds.push(item.shopify_order_id);
          }
        } else {
          const fallbackImage = item.sku ? skuImageMap.get(item.sku) : null;
          groupedItems.set(groupKey, {
            id: item.id,
            orderNumbers: [orderNumber],
            shopifyOrderIds: [item.shopify_order_id],
            title: item.title,
            variantTitle: item.variant_title,
            sku: item.sku,
            quantity: item.quantity,
            price: Number(item.price) || 0,
            productId: item.product_id,
            variantId: item.variant_id,
            imageUrl: item.image_url || fallbackImage || null,
            properties: isCustomized ? properties : null,
            hasCustomization: isCustomized,
          });
        }
      });

      const consolidatedItems = Array.from(groupedItems.values());
      
      // Ordenar por cantidad descendente, luego por título
      consolidatedItems.sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return a.title.localeCompare(b.title);
      });

      setItems(consolidatedItems);
    } catch (err) {
      console.error('Error fetching para empacar items:', err);
      setError('Error al cargar los artículos');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueOrders = new Set(items.flatMap(item => item.orderNumbers)).size;

  return { items, loading, error, fetchItems, totalQuantity, uniqueOrders };
};
