import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Store {
  id: string;
  organization_id: string;
  name: string;
  country_code: string | null;
  currency: string;
  shopify_store_url: string | null;
  shopify_credentials: Record<string, string> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type StoreUpsert = {
  id?: string;
  organization_id: string;
  name: string;
  country_code?: string | null;
  currency?: string;
  shopify_store_url?: string | null;
  shopify_credentials?: Record<string, string> | null;
  is_active?: boolean;
};

export const useStores = (organizationId: string | null) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStores = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('stores')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setStores(data || []);
    } catch (err) {
      console.error('[useStores] fetchStores error:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const upsertStore = async (data: StoreUpsert): Promise<Store | null> => {
    try {
      const { data: result, error } = await (supabase as any)
        .from('stores')
        .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;
      toast.success(data.id ? 'Tienda actualizada' : 'Tienda creada');
      await fetchStores();
      return result;
    } catch (err: any) {
      console.error('[useStores] upsertStore error:', err);
      toast.error(err?.message || 'Error guardando tienda');
      return null;
    }
  };

  const toggleStoreActive = async (storeId: string, isActive: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('stores')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', storeId);

      if (error) throw error;
      toast.success(isActive ? 'Tienda activada' : 'Tienda desactivada');
      await fetchStores();
    } catch (err: any) {
      console.error('[useStores] toggleStoreActive error:', err);
      toast.error(err?.message || 'Error actualizando tienda');
    }
  };

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  return { stores, loading, fetchStores, upsertStore, toggleStoreActive };
};
