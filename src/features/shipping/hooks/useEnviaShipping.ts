import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  ShippingLabel, 
  CreateLabelRequest, 
  CreateLabelResponse, 
  ShippingCoverage,
  QuoteRequest,
  QuoteResponse,
  CarrierQuote,
  TrackingRequest,
  TrackingResponse,
  CityMatchInfo
} from '../types/envia';
import { toast } from 'sonner';

export const useEnviaShipping = () => {
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [isLoadingLabel, setIsLoadingLabel] = useState(false);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);
  const [isCancellingLabel, setIsCancellingLabel] = useState(false);
  const [isDeletingLabel, setIsDeletingLabel] = useState(false);
  const [existingLabel, setExistingLabel] = useState<ShippingLabel | null>(null);
  const [labelHistory, setLabelHistory] = useState<ShippingLabel[]>([]);
  const [quotes, setQuotes] = useState<CarrierQuote[]>([]);
  const [trackingInfo, setTrackingInfo] = useState<TrackingResponse | null>(null);
  const [matchInfo, setMatchInfo] = useState<CityMatchInfo | null>(null);

  // Get all labels for an order (active + history)
  const getExistingLabel = useCallback(async (shopifyOrderId: number, organizationId: string): Promise<ShippingLabel | null> => {
    setIsLoadingLabel(true);
    try {
      // Fetch ALL labels for this order (including cancelled)
      const { data, error } = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('shopify_order_id', shopifyOrderId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching labels:', error);
        return null;
      }

      const allLabels = (data || []) as ShippingLabel[];
      
      // Separate active label from history
      const activeLabel = allLabels.find(l => l.status !== 'cancelled' && l.status !== 'error') || null;
      const history = allLabels.filter(l => l.status === 'cancelled' || l.status === 'error');

      setExistingLabel(activeLabel);
      setLabelHistory(history);
      
      return activeLabel;
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
        
        // Revisar si el body contiene nuestro código de error personalizado
        if (data?.errorCode === 'DIFFICULT_ACCESS_ZONE') {
          toast.error(
            'Algunos envíos tienen como destino zonas de difícil acceso, seguridad y movilidad; por favor remítalos con tipo de entrega reclamo en oficina.',
            { duration: 8000 }
          );
        } else {
          toast.error('Error al crear la guía: ' + (data?.error || error.message));
        }
        
        return { success: false, error: data?.error || error.message, errorCode: data?.errorCode };
      }

      if (!data.success) {
        console.error('Label creation failed:', data.error);
        
        // Mostrar mensaje amigable para zonas de difícil acceso
        if (data.errorCode === 'DIFFICULT_ACCESS_ZONE') {
          toast.error(
            'Algunos envíos tienen como destino zonas de difícil acceso, seguridad y movilidad; por favor remítalos con tipo de entrega reclamo en oficina.',
            { duration: 8000 }
          );
        } else {
          toast.error('Error al crear la guía: ' + (data.error || 'Error desconocido'));
        }
        
        return { success: false, error: data.error, errorCode: data.errorCode };
      }

      console.log('✅ Label created successfully:', data);
      if (data.tracking_number) {
        toast.success(`Guía creada: ${data.tracking_number}`);
      }
      
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

  // Get shipping quotes (optimized: no toast errors to avoid spam when API is down)
  const getQuotes = useCallback(async (request: QuoteRequest): Promise<QuoteResponse | null> => {
    setIsLoadingQuotes(true);
    setQuotes([]);
    setMatchInfo(null);
    try {
      console.log('💰 Getting shipping quotes for:', request.destination_city);

      const { data, error } = await supabase.functions.invoke('envia-quote', {
        body: request
      });

      if (error) {
        console.error('Error getting quotes:', error);
        // Solo log, NO toast para errores de conexión (evitar spam cuando API está caída)
        return null;
      }

      if (!data.success) {
        console.error('Quote request failed:', data.error);
        // NO toast para errores de autenticación (API caída)
        return null;
      }

      console.log('✅ Quotes received:', data.quotes?.length || 0, 'Match:', data.matchInfo?.matchType);
      setQuotes(data.quotes || []);
      
      // Store matchInfo for city validation
      if (data.matchInfo) {
        setMatchInfo(data.matchInfo);
      }
      
      return data as QuoteResponse;
    } catch (error: any) {
      console.error('Error in getQuotes:', error);
      // NO toast para errores de timeout o conexión
      return null;
    } finally {
      setIsLoadingQuotes(false);
    }
  }, []);

  // Track shipment
  const trackShipment = useCallback(async (request: TrackingRequest): Promise<TrackingResponse | null> => {
    setIsLoadingTracking(true);
    setTrackingInfo(null);
    try {
      console.log('📍 Tracking shipment:', request.tracking_number);

      const { data, error } = await supabase.functions.invoke('envia-track', {
        body: request
      });

      if (error) {
        console.error('Error tracking shipment:', error);
        toast.error('Error al rastrear envío: ' + error.message);
        return null;
      }

      if (!data.success) {
        console.error('Tracking request failed:', data.error);
        toast.error('Error al rastrear: ' + (data.error || 'Error desconocido'));
        return null;
      }

      console.log('✅ Tracking info received:', data.status, data.events?.length || 0, 'events');
      setTrackingInfo(data as TrackingResponse);
      
      return data as TrackingResponse;
    } catch (error: any) {
      console.error('Error in trackShipment:', error);
      toast.error('Error al rastrear envío: ' + error.message);
      return null;
    } finally {
      setIsLoadingTracking(false);
    }
  }, []);

  // Clear existing label (for re-fetching)
  const clearLabel = useCallback(() => {
    setExistingLabel(null);
    setLabelHistory([]);
  }, []);

  // Clear quotes
  const clearQuotes = useCallback(() => {
    setQuotes([]);
    setMatchInfo(null);
  }, []);

  // Clear tracking info
  const clearTracking = useCallback(() => {
    setTrackingInfo(null);
  }, []);

  // Cancel shipping label
  const cancelLabel = useCallback(async (labelId: string): Promise<{ 
    success: boolean; 
    error?: string; 
    balanceReturned?: boolean;
    shopifyFulfillmentCancelled?: boolean;
    shopifyFulfillmentError?: string | null;
  }> => {
    setIsCancellingLabel(true);
    try {
      console.log('🚫 Cancelling shipping label:', labelId);

      const { data, error } = await supabase.functions.invoke('envia-cancel', {
        body: { label_id: labelId }
      });

      if (error) {
        console.error('Error cancelling label:', error);
        return { success: false, error: error.message };
      }

      if (!data.success) {
        console.error('Label cancellation failed:', data.error);
        return { success: false, error: data.error };
      }

      console.log('✅ Label cancelled successfully. Balance returned:', data.balanceReturned, 'Shopify fulfillment cancelled:', data.shopifyFulfillmentCancelled);
      
      // Move the cancelled label to history
      if (existingLabel) {
        const cancelledLabel = { ...existingLabel, status: 'cancelled' as const };
        setLabelHistory(prev => [cancelledLabel, ...prev]);
        setExistingLabel(null);
      }
      
      return { 
        success: true, 
        balanceReturned: data.balanceReturned,
        shopifyFulfillmentCancelled: data.shopifyFulfillmentCancelled,
        shopifyFulfillmentError: data.shopifyFulfillmentError
      };
    } catch (error: any) {
      console.error('Error in cancelLabel:', error);
      return { success: false, error: error.message };
    } finally {
      setIsCancellingLabel(false);
    }
  }, [existingLabel]);

  // Delete failed label to allow retry
  const deleteFailedLabel = useCallback(async (labelId: string): Promise<{ success: boolean; error?: string }> => {
    setIsDeletingLabel(true);
    try {
      console.log('🗑️ Deleting failed shipping label:', labelId);

      const { error } = await supabase
        .from('shipping_labels')
        .delete()
        .eq('id', labelId);

      if (error) {
        console.error('Error deleting label:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Failed label deleted successfully');
      clearLabel();
      
      return { success: true };
    } catch (error: any) {
      console.error('Error in deleteFailedLabel:', error);
      return { success: false, error: error.message };
    } finally {
      setIsDeletingLabel(false);
    }
  }, [clearLabel]);

  return {
    // Label operations
    isCreatingLabel,
    isLoadingLabel,
    existingLabel,
    labelHistory,
    getExistingLabel,
    createLabel,
    clearLabel,
    
    // Coverage
    checkCoverage,
    
    // Quote operations
    isLoadingQuotes,
    quotes,
    getQuotes,
    clearQuotes,
    
    // City match info
    matchInfo,
    clearMatchInfo: () => setMatchInfo(null),
    
    // Tracking operations
    isLoadingTracking,
    trackingInfo,
    trackShipment,
    clearTracking,
    
    // Cancel operations
    isCancellingLabel,
    cancelLabel,
    
    // Delete failed label
    isDeletingLabel,
    deleteFailedLabel
  };
};
