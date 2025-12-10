import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShippingLabel, CreateLabelRequest, CreateLabelResponse, ShippingCoverage } from '../types/envia';
import { toast } from 'sonner';

export const useEnviaShipping = () => {
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [isLoadingLabel, setIsLoadingLabel] = useState(false);
  const [existingLabel, setExistingLabel] = useState<ShippingLabel | null>(null);

  // Get existing label for an order
  const getExistingLabel = useCallback(async (shopifyOrderId: number, organizationId: string): Promise<ShippingLabel | null> => {
    setIsLoadingLabel(true);
    try {
      const { data, error } = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('shopify_order_id', shopifyOrderId)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching existing label:', error);
        return null;
      }

      setExistingLabel(data as ShippingLabel | null);
      return data as ShippingLabel | null;
    } catch (error) {
      console.error('Error in getExistingLabel:', error);
      return null;
    } finally {
      setIsLoadingLabel(false);
    }
  }, []);

  // Check coverage for a municipality
  const checkCoverage = useCallback(async (municipality: string, department: string, organizationId: string): Promise<ShippingCoverage | null> => {
    try {
      // Normalize search terms
      const normalizedMunicipality = municipality.trim().toUpperCase();
      const normalizedDepartment = department.trim().toUpperCase();

      const { data, error } = await supabase
        .from('shipping_coverage')
        .select('*')
        .eq('organization_id', organizationId)
        .ilike('municipality', normalizedMunicipality)
        .ilike('department', normalizedDepartment)
        .maybeSingle();

      if (error) {
        console.error('Error checking coverage:', error);
        return null;
      }

      return data as ShippingCoverage | null;
    } catch (error) {
      console.error('Error in checkCoverage:', error);
      return null;
    }
  }, []);

  // Create shipping label
  const createLabel = useCallback(async (request: CreateLabelRequest): Promise<CreateLabelResponse> => {
    setIsCreatingLabel(true);
    try {
      console.log('📦 Creating shipping label for order:', request.order_number);

      const { data, error } = await supabase.functions.invoke('create-envia-label', {
        body: request
      });

      if (error) {
        console.error('Error creating label:', error);
        toast.error('Error al crear la guía: ' + error.message);
        return { success: false, error: error.message };
      }

      if (!data.success) {
        console.error('Label creation failed:', data.error);
        toast.error('Error al crear la guía: ' + (data.error || 'Error desconocido'));
        return { success: false, error: data.error };
      }

      console.log('✅ Label created successfully:', data);
      toast.success(`Guía creada: ${data.tracking_number}`);
      
      // Update local state
      if (data.label) {
        setExistingLabel(data.label);
      }

      return {
        success: true,
        label: data.label,
        tracking_number: data.tracking_number,
        label_url: data.label_url,
        carrier: data.carrier
      };
    } catch (error: any) {
      console.error('Error in createLabel:', error);
      toast.error('Error al crear la guía: ' + error.message);
      return { success: false, error: error.message };
    } finally {
      setIsCreatingLabel(false);
    }
  }, []);

  // Clear existing label (for re-fetching)
  const clearLabel = useCallback(() => {
    setExistingLabel(null);
  }, []);

  return {
    isCreatingLabel,
    isLoadingLabel,
    existingLabel,
    getExistingLabel,
    checkCoverage,
    createLabel,
    clearLabel
  };
};
