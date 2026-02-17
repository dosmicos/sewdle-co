import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';

interface ShopifyOrder {
  id: string;
  shopify_order_id: number;
  order_number: string;
  customer_email: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_phone: string;
  created_at_shopify: string;
  financial_status: string;
  fulfillment_status: string;
  total_price: number;
  currency: string;
  customer_segment?: string;
  line_items_count?: number;
}

interface CustomerAnalytics {
  customer_email: string;
  customer_name: string;
  orders_count: number;
  total_spent: number;
  avg_order_value: number;
  first_order_date: string;
  last_order_date: string;
  customer_segment: string;
}

interface ProductAnalytics {
  sku: string;
  product_title: string;
  variant_title: string;
  total_quantity: number;
  total_revenue: number;
  avg_price: number;
  orders_count: number;
  customers_count: number;
}

export const useShopifyOrders = () => {
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [customerAnalytics, setCustomerAnalytics] = useState<CustomerAnalytics[]>([]);
  const [productAnalytics, setProductAnalytics] = useState<ProductAnalytics[]>([]);
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;

  const fetchOrders = useCallback(async (limit = 50, offset = 0) => {
    setOrdersLoading(true);
    try {
      if (!organizationId) {
        setOrders([]);
        setTotalOrders(0);
        return [];
      }

      // Try to get full data first (for admins/designers)
      try {
        const { count } = await supabase
          .from('shopify_orders')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId);
        
        setTotalOrders(count || 0);

        const { data, error } = await supabase
          .from('shopify_orders')
          .select(`
            id,
            shopify_order_id,
            order_number,
            customer_email,
            customer_first_name,
            customer_last_name,
            customer_phone,
            created_at_shopify,
            financial_status,
            fulfillment_status,
            total_price,
            currency
          `)
          .eq('organization_id', organizationId)
          .order('created_at_shopify', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw error;
        setOrders(data || []);
        return data || [];
      } catch (fullDataError) {
        // If full data access fails (non-admin user), fall back to sanitized data
        console.log('Full data access denied, using sanitized data');
        
        const { data: sanitizedData, error: sanitizedError } = await supabase
          .rpc('get_shopify_orders_sanitized');

        if (sanitizedError) throw sanitizedError;
        
        // Transform sanitized data to match expected interface
        const transformedData = (sanitizedData || []).slice(offset, offset + limit).map((item: unknown) => ({
          id: item.id,
          shopify_order_id: item.shopify_order_id,
          order_number: item.order_number,
          customer_email: item.customer_email_masked,
          customer_first_name: item.customer_name_masked.split(' ')[0] || '',
          customer_last_name: item.customer_name_masked.split(' ')[1] || '',
          customer_phone: '***-***-****', // Fully masked for non-privileged users
          created_at_shopify: item.created_at_shopify,
          financial_status: item.financial_status,
          fulfillment_status: item.fulfillment_status,
          total_price: item.total_price,
          currency: item.currency
        }));
        
        setTotalOrders(sanitizedData?.length || 0);
        setOrders(transformedData);
        return transformedData;
      }
    } catch (error) {
      console.error('Error fetching Shopify orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes de Shopify",
        variant: "destructive",
      });
      return [];
    } finally {
      setOrdersLoading(false);
    }
  }, [organizationId, toast]);

  // Fetch all orders at once in chunks (use with caution for very large datasets)
  const fetchAllOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      if (!organizationId) return [] as ShopifyOrder[];

      const { count, error: countError } = await supabase
        .from('shopify_orders')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      if (countError) throw countError;
      const total = count || 0;
      setTotalOrders(total);

      const pageSize = 1000;
      const pages = Math.max(1, Math.ceil(total / pageSize));

      const queries = Array.from({ length: pages }, (_, i) => {
        const start = i * pageSize;
        const end = start + pageSize - 1;
        return supabase
          .from('shopify_orders')
          .select(`
            id,
            shopify_order_id,
            order_number,
            customer_email,
            customer_first_name,
            customer_last_name,
            customer_phone,
            created_at_shopify,
            financial_status,
            fulfillment_status,
            total_price,
            currency
          `)
          .eq('organization_id', organizationId)
          .order('created_at_shopify', { ascending: false })
          .range(start, end);
      });

      const results = await Promise.all(queries);
      const combined: ShopifyOrder[] = results.flatMap(r => r.data || []);
      setOrders(combined);
      return combined;
    } catch (error) {
      console.error('Error fetching ALL Shopify orders:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar todas las órdenes',
        variant: 'destructive',
      });
      return [] as ShopifyOrder[];
    } finally {
      setOrdersLoading(false);
    }
  }, [organizationId, toast]);

  const fetchCustomerAnalytics = useCallback(async (limit = 50, offset = 0, startDate?: string, endDate?: string) => {
    setCustomersLoading(true);
    try {
      if (!organizationId) {
        setCustomerAnalytics([]);
        setTotalCustomers(0);
        return [];
      }

      // First get total count filtered by organization
      const { count } = await supabase
        .from('shopify_orders')
        .select('customer_email', { count: 'exact', head: true })
        .eq('organization_id', organizationId);
      
      // Estimado aproximado de clientes únicos (será actualizado con datos reales)
      setTotalCustomers(Math.ceil((count || 0) / 3)); // Estimación: promedio 3 órdenes por cliente

      // Try to use secure customer analytics (for admins/designers only)
      const { data, error } = await supabase.rpc('get_customer_analytics', {
        start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0]
      });

      if (error) throw error;
      
      // Update total customers with real count
      if (data) {
        setTotalCustomers(data.length);
        // Apply pagination on client side since RPC doesn't support LIMIT/OFFSET
        const paginatedData = data.slice(offset, offset + limit);
        setCustomerAnalytics(paginatedData);
      } else {
        setCustomerAnalytics([]);
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching customer analytics:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los análisis de clientes",
        variant: "destructive",
      });
      return [];
    } finally {
      setCustomersLoading(false);
    }
  }, [organizationId, toast]);

  const fetchProductAnalytics = useCallback(async (startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
      if (!organizationId) {
        setProductAnalytics([]);
        return;
      }

      const { data, error } = await supabase.rpc('get_product_sales_analytics', {
        start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0]
      });

      if (error) throw error;
      setProductAnalytics(data || []);
    } catch (error) {
      console.error('Error fetching product analytics:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los análisis de productos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    if (organizationId) {
      fetchOrders();
      fetchCustomerAnalytics();
      fetchProductAnalytics();
    }
  }, [organizationId, fetchOrders, fetchCustomerAnalytics, fetchProductAnalytics]);

  return {
    orders,
    customerAnalytics,
    productAnalytics,
    loading,
    ordersLoading,
    customersLoading,
    totalOrders,
    totalCustomers,
    fetchOrders,
    fetchAllOrders,
    fetchCustomerAnalytics,
    fetchProductAnalytics,
    refetch: () => {
      fetchOrders(50, 0);
      fetchCustomerAnalytics(50, 0);
      fetchProductAnalytics();
    }
  };
};
