import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sortProductVariants } from '@/lib/variantSorting';

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

  const fetchProducts = async () => {
    try {
      setLoading(true);
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
    } catch (err) {
      console.error('Error in fetchProducts:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
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
  }, []);

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
    fetchProductVariants
  };
};
