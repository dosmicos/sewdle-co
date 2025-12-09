import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { sortVariants } from '@/lib/variantSorting';

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
  size?: string; // Para ordenamiento por tallas
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

      // Filtrar "Bordado Personalizado" antes de procesar
      const filteredLineItems = (lineItems || []).filter(item => 
        item.title.toLowerCase() !== 'bordado personalizado'
      );

      // Obtener SKUs sin imagen para buscar fallbacks
      const skusWithoutImage = [...new Set(
        filteredLineItems
          .filter(item => !item.image_url && item.sku)
          .map(item => item.sku)
      )] as string[];

      // Fallback 1: Imágenes desde tabla products via product_variants
      let skuProductImageMap = new Map<string, string>();
      if (skusWithoutImage.length > 0) {
        const { data: variantsWithImages } = await supabase
          .from('product_variants')
          .select('sku_variant, products!inner(image_url)')
          .in('sku_variant', skusWithoutImage);

        if (variantsWithImages) {
          variantsWithImages.forEach((v: any) => {
            if (v.products?.image_url) {
              skuProductImageMap.set(v.sku_variant, v.products.image_url);
            }
          });
        }
      }

      // Fallback 2: Imágenes desde otros line items con el mismo SKU
      const skusStillWithoutImage = skusWithoutImage.filter(sku => !skuProductImageMap.has(sku));
      let skuLineItemImageMap = new Map<string, string>();
      if (skusStillWithoutImage.length > 0) {
        const { data: skuImages } = await supabase
          .from('shopify_order_line_items')
          .select('sku, image_url')
          .eq('organization_id', currentOrganization.id)
          .in('sku', skusStillWithoutImage)
          .not('image_url', 'is', null)
          .limit(500);

        skuImages?.forEach(item => {
          if (item.sku && item.image_url && !skuLineItemImageMap.has(item.sku)) {
            skuLineItemImageMap.set(item.sku, item.image_url);
          }
        });
      }

      // Agrupar artículos por SKU+variante (excepto los personalizados)
      const groupedItems = new Map<string, ParaEmpacarItem>();

      filteredLineItems.forEach(item => {
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
          // Buscar imagen con prioridad: line_item > products > otros line_items
          let finalImage = item.image_url;
          if (!finalImage && item.sku) {
            finalImage = skuProductImageMap.get(item.sku) || skuLineItemImageMap.get(item.sku) || null;
          }

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
            imageUrl: finalImage,
            properties: isCustomized ? properties : null,
            hasCustomization: isCustomized,
            size: item.variant_title || '', // Para sortVariants
          });
        }
      });

      const consolidatedItems = Array.from(groupedItems.values());
      
      // Ordenar por talla usando sortVariants, luego por título
      const sortedBySize = sortVariants(consolidatedItems);
      
      // Agrupar por título para mantener productos juntos, ordenados por talla dentro de cada grupo
      const groupedByTitle = new Map<string, ParaEmpacarItem[]>();
      sortedBySize.forEach(item => {
        const titleKey = item.title.toLowerCase();
        if (!groupedByTitle.has(titleKey)) {
          groupedByTitle.set(titleKey, []);
        }
        groupedByTitle.get(titleKey)!.push(item);
      });

      // Ordenar grupos por cantidad total descendente, mantener orden de tallas dentro
      const groupsWithTotals = Array.from(groupedByTitle.entries()).map(([title, items]) => ({
        title,
        items,
        totalQty: items.reduce((sum, item) => sum + item.quantity, 0)
      }));
      
      groupsWithTotals.sort((a, b) => b.totalQty - a.totalQty);
      
      const finalItems = groupsWithTotals.flatMap(group => group.items);

      setItems(finalItems);
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
