import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ShippingManifest {
  id: string;
  organization_id: string;
  manifest_number: string;
  carrier: string;
  manifest_date: string;
  status: string;
  total_packages: number;
  total_verified: number;
  notes: string | null;
  created_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  pickup_confirmed_at: string | null;
  pickup_confirmed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManifestItem {
  id: string;
  manifest_id: string;
  shipping_label_id: string;
  shopify_order_id: number;
  order_number: string;
  tracking_number: string;
  recipient_name: string | null;
  destination_city: string | null;
  scanned_at: string | null;
  scanned_by: string | null;
  scan_status: string;
  notes: string | null;
  created_at: string;
}

export interface ManifestWithItems extends ShippingManifest {
  items: ManifestItem[];
}

interface CreateManifestParams {
  carrier: string;
  labelIds: string[];
  notes?: string;
}

interface ScanResult {
  success: boolean;
  status: 'verified' | 'already_scanned' | 'not_found' | 'wrong_manifest' | 'error';
  message: string;
  item?: ManifestItem;
}

export const useShippingManifests = () => {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [manifests, setManifests] = useState<ShippingManifest[]>([]);
  const [currentManifest, setCurrentManifest] = useState<ManifestWithItems | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all manifests with optional filters
  const fetchManifests = useCallback(async (filters?: {
    status?: string;
    carrier?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('shipping_manifests')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.carrier) {
        query = query.eq('carrier', filters.carrier);
      }
      if (filters?.dateFrom) {
        query = query.gte('manifest_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('manifest_date', filters.dateTo);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setManifests(data || []);
    } catch (err: unknown) {
      console.error('Error fetching manifests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  // Fetch a single manifest with its items
  const fetchManifestWithItems = useCallback(async (manifestId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: manifest, error: manifestError } = await supabase
        .from('shipping_manifests')
        .select('*')
        .eq('id', manifestId)
        .single();

      if (manifestError) throw manifestError;

      const { data: items, error: itemsError } = await supabase
        .from('manifest_items')
        .select('*')
        .eq('manifest_id', manifestId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      const manifestWithItems: ManifestWithItems = {
        ...manifest,
        items: items || []
      };

      setCurrentManifest(manifestWithItems);
      return manifestWithItems;
    } catch (err: unknown) {
      console.error('Error fetching manifest:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new manifest
  const createManifest = useCallback(async ({ carrier, labelIds, notes }: CreateManifestParams) => {
    if (!currentOrganization?.id || !user?.id) {
      toast.error('Sesión no válida');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate manifest number
      const { data: manifestNumber, error: numError } = await supabase
        .rpc('generate_manifest_number', {
          org_id: currentOrganization.id,
          carrier_code: carrier
        });

      if (numError) throw numError;

      // Create manifest
      const { data: manifest, error: createError } = await supabase
        .from('shipping_manifests')
        .insert({
          organization_id: currentOrganization.id,
          manifest_number: manifestNumber,
          carrier,
          notes,
          created_by: user.id,
          total_packages: labelIds.length
        })
        .select()
        .single();

      if (createError) throw createError;

      // Fetch label details and create items
      const { data: labels, error: labelsError } = await supabase
        .from('shipping_labels')
        .select('id, shopify_order_id, order_number, tracking_number, recipient_name, destination_city')
        .in('id', labelIds);

      if (labelsError) throw labelsError;

      const itemsToInsert = (labels || []).map(label => ({
        manifest_id: manifest.id,
        shipping_label_id: label.id,
        shopify_order_id: label.shopify_order_id,
        order_number: label.order_number,
        tracking_number: label.tracking_number || '',
        recipient_name: label.recipient_name,
        destination_city: label.destination_city
      }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('manifest_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast.success(`Manifiesto ${manifestNumber} creado con ${labelIds.length} guías`);
      await fetchManifests();
      return manifest;
    } catch (err: unknown) {
      console.error('Error creating manifest:', err);
      setError(err.message);
      toast.error('Error al crear manifiesto: ' + err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, user?.id, fetchManifests]);

  // Scan a tracking number
  const scanTrackingNumber = useCallback(async (
    manifestId: string,
    trackingNumber: string
  ): Promise<ScanResult> => {
    if (!user?.id) {
      return { success: false, status: 'error', message: 'Sesión no válida' };
    }

    try {
      // First check if this tracking exists in any manifest
      const { data: existingItem, error: checkError } = await supabase
        .from('manifest_items')
        .select('*, shipping_manifests!inner(manifest_number)')
        .eq('tracking_number', trackingNumber)
        .maybeSingle();

      if (checkError) throw checkError;

      if (!existingItem) {
        return {
          success: false,
          status: 'not_found',
          message: `Guía ${trackingNumber} no encontrada en ningún manifiesto`
        };
      }

      if (existingItem.manifest_id !== manifestId) {
        return {
          success: false,
          status: 'wrong_manifest',
          message: `Guía pertenece al manifiesto ${(existingItem as Record<string, unknown>).shipping_manifests.manifest_number}`
        };
      }

      if (existingItem.scanned_at) {
        return {
          success: false,
          status: 'already_scanned',
          message: `Guía ya escaneada el ${new Date(existingItem.scanned_at).toLocaleString()}`,
          item: existingItem
        };
      }

      // Update item as scanned
      const { data: updatedItem, error: updateError } = await supabase
        .from('manifest_items')
        .update({
          scanned_at: new Date().toISOString(),
          scanned_by: user.id,
          scan_status: 'verified'
        })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update manifest totals
      const { data: currentManifestData } = await supabase
        .from('shipping_manifests')
        .select('total_verified')
        .eq('id', manifestId)
        .single();

      if (currentManifestData) {
        await supabase
          .from('shipping_manifests')
          .update({ total_verified: (currentManifestData.total_verified || 0) + 1 })
          .eq('id', manifestId);
      }

      return {
        success: true,
        status: 'verified',
        message: `✓ Guía ${trackingNumber} verificada - Pedido ${existingItem.order_number}`,
        item: updatedItem
      };
    } catch (err: unknown) {
      console.error('Error scanning:', err);
      return {
        success: false,
        status: 'error',
        message: 'Error al escanear: ' + err.message
      };
    }
  }, [user?.id]);

  // Close a manifest
  const closeManifest = useCallback(async (manifestId: string) => {
    if (!user?.id) {
      toast.error('Sesión no válida');
      return false;
    }

    try {
      const { error } = await supabase
        .from('shipping_manifests')
        .update({
          status: 'closed',
          closed_by: user.id,
          closed_at: new Date().toISOString()
        })
        .eq('id', manifestId);

      if (error) throw error;

      toast.success('Manifiesto cerrado');
      await fetchManifests();
      return true;
    } catch (err: unknown) {
      console.error('Error closing manifest:', err);
      toast.error('Error al cerrar manifiesto: ' + err.message);
      return false;
    }
  }, [user?.id, fetchManifests]);

  // Confirm pickup
  const confirmPickup = useCallback(async (manifestId: string) => {
    if (!user?.id) {
      toast.error('Sesión no válida');
      return false;
    }

    try {
      const { error } = await supabase
        .from('shipping_manifests')
        .update({
          status: 'picked_up',
          pickup_confirmed_at: new Date().toISOString(),
          pickup_confirmed_by: user.id
        })
        .eq('id', manifestId);

      if (error) throw error;

      toast.success('Retiro confirmado');
      await fetchManifests();
      return true;
    } catch (err: unknown) {
      console.error('Error confirming pickup:', err);
      toast.error('Error al confirmar retiro: ' + err.message);
      return false;
    }
  }, [user?.id, fetchManifests]);

  // Delete a manifest (only open ones)
  const deleteManifest = useCallback(async (manifestId: string) => {
    try {
      const { error } = await supabase
        .from('shipping_manifests')
        .delete()
        .eq('id', manifestId);

      if (error) throw error;

      toast.success('Manifiesto eliminado');
      await fetchManifests();
      return true;
    } catch (err: unknown) {
      console.error('Error deleting manifest:', err);
      toast.error('Error al eliminar manifiesto: ' + err.message);
      return false;
    }
  }, [fetchManifests]);

  // Get available labels for manifest creation
  const getAvailableLabels = useCallback(async (carrier?: string, dateFrom?: string, dateTo?: string) => {
    if (!currentOrganization?.id) return [];

    try {
      let query = supabase
        .from('shipping_labels')
        .select('id, shopify_order_id, order_number, tracking_number, carrier, recipient_name, destination_city, created_at')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'created')
        .not('tracking_number', 'is', null);

      if (carrier) {
        query = query.eq('carrier', carrier);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59');
      }

      const { data: labels, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out labels already in a manifest
      const { data: usedLabels } = await supabase
        .from('manifest_items')
        .select('shipping_label_id');

      const usedIds = new Set((usedLabels || []).map(l => l.shipping_label_id));
      
      return (labels || []).filter(l => !usedIds.has(l.id));
    } catch (err: unknown) {
      console.error('Error fetching available labels:', err);
      return [];
    }
  }, [currentOrganization?.id]);

  // Mark item as missing
  const markItemMissing = useCallback(async (itemId: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('manifest_items')
        .update({
          scan_status: 'missing',
          notes
        })
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (err: unknown) {
      console.error('Error marking item missing:', err);
      return false;
    }
  }, []);

  return {
    manifests,
    currentManifest,
    loading,
    error,
    fetchManifests,
    fetchManifestWithItems,
    createManifest,
    scanTrackingNumber,
    closeManifest,
    confirmPickup,
    deleteManifest,
    getAvailableLabels,
    markItemMissing
  };
};
