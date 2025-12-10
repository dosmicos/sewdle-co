import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { sortVariants } from '@/lib/variantSorting';

const MIN_ORDER_NUMBER = 62303;

// Extrae solo la talla del variantTitle, ignorando colores
const extractSize = (variantTitle: string | null): string | null => {
  if (!variantTitle) return null;
  
  const sizePatterns = [
    /\d+\s*\([^)]+\)/i,                  // "4 (1-2 años)", "2 (3-12 meses)"
    /\d+\s*a\s*\d+\s*(mes|meses|año|años)/i,   // "0 a 1 mes", "3 a 6 meses", "1 a 2 años"
    /\d+-\d+\s*(meses?|años?)/i,         // "3-12 meses", "1-2 años"
    /talla\s+\w+/i,                      // "Talla M", "Talla 4"
    /^(XXS|XS|S|M|L|XL|XXL|XXXL)$/i,     // Tallas estándar solas
    /^\d{1,2}$/,                         // Solo número: "4", "6", "12"
  ];
  
  // Si tiene "/" puede ser "Color / Talla" o "Talla / Color"
  const parts = variantTitle.split('/').map(p => p.trim());
  
  for (const part of parts) {
    for (const pattern of sizePatterns) {
      if (pattern.test(part)) {
        return part;
      }
    }
  }
  
  return null;
};

// Determina el pasillo basado en el tipo de producto y talla
const determineAisle = (title: string, size: string | null): number => {
  const titleLower = title.toLowerCase();
  const sizeClean = (size || '').trim();
  
  // Detectar tipo de producto
  const isRuana = titleLower.includes('ruana');
  const isSleeping = titleLower.includes('sleeping'); // Incluye "Sleeping Walker" y variantes
  const isChaqueta = titleLower.includes('chaqueta');
  
  // Detectar si es talla de adulto
  const isAdultSize = /^(XXS|XS|S|M|L|XL|XXL|XXXL)$/i.test(sizeClean);
  
  // Extraer talla numérica del size (puede ser "4", "4 (1-2 años)", etc.)
  const numericMatch = sizeClean.match(/^(\d+)/);
  const numericSize = numericMatch ? parseInt(numericMatch[1]) : 0;
  
  // PASILLO 1: Ruanas tallas 2, 4, 6, 8
  if (isRuana && !isAdultSize && [2, 4, 6, 8].includes(numericSize)) {
    return 1;
  }
  
  // PASILLO 2: Ruanas tallas 10, 12 + Todos los Sleeping
  if (isSleeping) {
    return 2;
  }
  if (isRuana && !isAdultSize && [10, 12].includes(numericSize)) {
    return 2;
  }
  
  // PASILLO 3: Ruanas adulto + Chaquetas + Todo lo demás
  return 3;
};

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
  size?: string;
  aisle: number;
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
  
  // Filtros
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedAisles, setSelectedAisles] = useState<number[]>([]);
  const [showOnlyEmbroidery, setShowOnlyEmbroidery] = useState(false);

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

        const itemSize = extractSize(item.variant_title) || '';
        const itemAisle = determineAisle(item.title, itemSize);

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
            imageUrl: item.image_url,
            properties: isCustomized ? properties : null,
            hasCustomization: isCustomized,
            size: itemSize,
            aisle: itemAisle,
          });
        }
      });

      const consolidatedItems = Array.from(groupedItems.values());
      
      // Ordenar por talla usando sortVariants
      const sortedBySize = sortVariants(consolidatedItems);
      
      // Agrupar por título para mantener productos juntos
      const groupedByTitle = new Map<string, ParaEmpacarItem[]>();
      sortedBySize.forEach(item => {
        const titleKey = item.title.toLowerCase();
        if (!groupedByTitle.has(titleKey)) {
          groupedByTitle.set(titleKey, []);
        }
        groupedByTitle.get(titleKey)!.push(item);
      });

      // Ordenar grupos por cantidad total descendente
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

  // Tallas disponibles extraídas de los items (solo tallas, no colores)
  const availableSizes = useMemo(() => {
    const sizes = [...new Set(
      items
        .map(i => i.size)
        .filter(Boolean)
    )] as string[];
    return sortVariants(sizes.map(s => ({ size: s }))).map(s => s.size);
  }, [items]);

  // Pasillos disponibles
  const availableAisles = useMemo(() => {
    return [...new Set(items.map(i => i.aisle))].sort((a, b) => a - b);
  }, [items]);

  // Items filtrados por tallas, pasillos y bordado
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (showOnlyEmbroidery && !item.hasCustomization) return false;
      if (selectedSizes.length > 0 && !selectedSizes.includes(item.size)) return false;
      if (selectedAisles.length > 0 && !selectedAisles.includes(item.aisle)) return false;
      return true;
    });
  }, [items, selectedSizes, selectedAisles, showOnlyEmbroidery]);

  const totalQuantity = filteredItems.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueOrders = new Set(filteredItems.flatMap(item => item.orderNumbers)).size;

  const clearAllFilters = useCallback(() => {
    setSelectedSizes([]);
    setSelectedAisles([]);
    setShowOnlyEmbroidery(false);
  }, []);

  const hasActiveFilters = selectedSizes.length > 0 || selectedAisles.length > 0 || showOnlyEmbroidery;

  return { 
    items: filteredItems, 
    allItems: items,
    loading, 
    error, 
    fetchItems, 
    totalQuantity, 
    uniqueOrders,
    // Filtros de talla
    availableSizes,
    selectedSizes,
    setSelectedSizes,
    // Filtros de pasillo
    availableAisles,
    selectedAisles,
    setSelectedAisles,
    // Filtro de bordados
    showOnlyEmbroidery,
    setShowOnlyEmbroidery,
    clearAllFilters,
    hasActiveFilters,
  };
};
