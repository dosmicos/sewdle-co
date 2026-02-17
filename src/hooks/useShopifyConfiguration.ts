import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

interface ShopifyConnectionTest {
  success: boolean;
  message: string;
  storeInfo?: {
    name: string;
    domain: string;
    email: string;
    plan: string;
  };
}

export const useShopifyConfiguration = () => {
  const { currentOrganization, updateOrganization } = useOrganization();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const testConnection = useCallback(async (
    storeUrl: string, 
    accessToken: string
  ): Promise<ShopifyConnectionTest> => {
    setTesting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-shopify-connection', {
        body: {
          storeUrl,
          accessToken
        }
      });

      if (error) throw error;

      return data;
    } catch (error: unknown) {
      console.error('Error testing Shopify connection:', error);
      return {
        success: false,
        message: error.message || 'Error al probar la conexión'
      };
    } finally {
      setTesting(false);
    }
  }, []);

  const saveConfiguration = useCallback(async (
    storeUrl: string,
    accessToken: string
  ): Promise<boolean> => {
    if (!currentOrganization) {
      toast.error('No hay organización seleccionada');
      return false;
    }

    setSaving(true);
    
    try {
      await updateOrganization(currentOrganization.id, {
        shopify_store_url: storeUrl,
        shopify_credentials: {
          access_token: accessToken,
          configured_at: new Date().toISOString()
        }
      });

      toast.success('Configuración de Shopify guardada exitosamente');
      return true;
    } catch (error: unknown) {
      console.error('Error saving Shopify configuration:', error);
      toast.error('Error al guardar la configuración');
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentOrganization, updateOrganization]);

  const triggerSync = useCallback(async (
    syncType: 'initial' | 'daily' | 'monthly' = 'daily'
  ): Promise<boolean> => {
    if (!currentOrganization?.id) {
      toast.error('No hay organización seleccionada');
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('sync-shopify-sales', {
        body: {
          organizationId: currentOrganization.id,
          syncMode: syncType
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Sincronización iniciada exitosamente');
        return true;
      } else {
        toast.error(data.error || 'Error al iniciar la sincronización');
        return false;
      }
    } catch (error: unknown) {
      console.error('Error triggering sync:', error);
      toast.error('Error al iniciar la sincronización');
      return false;
    }
  }, [currentOrganization]);

  const removeConfiguration = useCallback(async (): Promise<boolean> => {
    if (!currentOrganization) {
      toast.error('No hay organización seleccionada');
      return false;
    }

    setSaving(true);
    
    try {
      await updateOrganization(currentOrganization.id, {
        shopify_store_url: null,
        shopify_credentials: null
      });

      toast.success('Configuración de Shopify removida');
      return true;
    } catch (error: unknown) {
      console.error('Error removing Shopify configuration:', error);
      toast.error('Error al remover la configuración');
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentOrganization, updateOrganization]);

  return {
    testing,
    saving,
    testConnection,
    saveConfiguration,
    triggerSync,
    removeConfiguration
  };
};