import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sortProductVariants } from '@/lib/variantSorting';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  base_price: number;
  image_url: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  sku_variant: string;
  additional_price: number;
  stock_quantity: number;
}

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const { toast } = useToast();
  const channelRef = useRef<any>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProducts = async (showNotification = false) => {
    try {
      if (showNotification) {
        setSyncStatus('syncing');
      } else {
        setLoading(true);
      }
      setError(null);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }

      console.log('Products fetched:', data);
      setProducts(data || []);
      setLastUpdated(new Date());
      setSyncStatus('idle');
      
      if (showNotification) {
        toast({
          title: "Inventario actualizado",
          description: "Los datos de productos han sido sincronizados.",
        });
      }
    } catch (err) {
      console.error('Error in fetchProducts:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setSyncStatus('error');
      
      if (showNotification) {
        toast({
          title: "Error de sincronización",
          description: "No se pudo actualizar el inventario.",
          variant: "destructive",
        });
      }
    } finally {
      if (!showNotification) {
        setLoading(false);
      }
    }
  };

  // Setup real-time subscription for product variants
  const setupRealtimeSubscription = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel('product-variants-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'product_variants'
        },
        (payload) => {
          console.log('🔄 Cambio en variante detectado:', payload);
          // Refresh products data when variants change
          fetchProducts(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'product_variants'
        },
        (payload) => {
          console.log('➕ Nueva variante detectada:', payload);
          fetchProducts(true);
        }
      )
      .subscribe();

    console.log('✅ Suscripción en tiempo real configurada para variantes de productos');
  };

  // Setup auto-refresh polling
  const setupAutoRefresh = () => {
    if (!autoRefreshEnabled) return;

    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Set up new interval (every 2 minutes)
    pollIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible' && autoRefreshEnabled) {
        console.log('🔄 Auto-refresh de productos ejecutado');
        fetchProducts(true);
      }
    }, 120000); // 2 minutes

    console.log('⏰ Auto-refresh configurado cada 2 minutos');
  };

  // Cleanup function
  const cleanup = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const fetchProductVariants = async (productId: string): Promise<ProductVariant[]> => {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId);

      if (error) {
        console.error('Error fetching product variants:', error);
        throw error;
      }

      // Ordenar las variantes antes de devolverlas
      const sortedVariants = data ? sortProductVariants(data) : [];
      console.log('Fetched and sorted product variants:', sortedVariants);
      
      return sortedVariants;
    } catch (err) {
      console.error('Error in fetchProductVariants:', err);
      return [];
    }
  };

  useEffect(() => {
    fetchProducts();
    setupRealtimeSubscription();
    setupAutoRefresh();

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && autoRefreshEnabled) {
        fetchProducts(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cleanup();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    setupAutoRefresh();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [autoRefreshEnabled]);

  return {
    products,
    loading,
    error,
    lastUpdated,
    autoRefreshEnabled,
    syncStatus,
    refetch: fetchProducts,
    fetchProductVariants,
    setAutoRefreshEnabled,
    refreshNow: () => fetchProducts(true)
  };
};
