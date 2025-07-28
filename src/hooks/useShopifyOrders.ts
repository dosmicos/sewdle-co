import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  const fetchOrders = async (limit = 50, offset = 0) => {
    setLoading(true);
    try {
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
        .order('created_at_shopify', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching Shopify orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes de Shopify",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerAnalytics = async (startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_customer_analytics', {
        start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0]
      });

      if (error) throw error;
      setCustomerAnalytics(data || []);
    } catch (error) {
      console.error('Error fetching customer analytics:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los análisis de clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProductAnalytics = async (startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
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
  };

  useEffect(() => {
    fetchOrders();
    fetchCustomerAnalytics();
    fetchProductAnalytics();
  }, []);

  return {
    orders,
    customerAnalytics,
    productAnalytics,
    loading,
    fetchOrders,
    fetchCustomerAnalytics,
    fetchProductAnalytics,
    refetch: () => {
      fetchOrders();
      fetchCustomerAnalytics();
      fetchProductAnalytics();
    }
  };
};