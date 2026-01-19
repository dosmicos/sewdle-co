import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Truck, FileText, Loader2, ExternalLink, AlertCircle, PackageCheck, Edit3, XCircle, Printer, RotateCcw, ChevronDown, ChevronUp, History } from 'lucide-react';
import { useEnviaShipping } from '../hooks/useEnviaShipping';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Badge } from '@/components/ui/badge';
import { CARRIER_NAMES, CarrierCode, ShippingLabel } from '../types/envia';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ShippingAddress {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

interface EnviaShippingButtonProps {
  shopifyOrderId: number;
  orderNumber: string;
  shippingAddress?: ShippingAddress | null;
  customerEmail?: string;
  customerPhone?: string;
  totalPrice?: number;
  disabled?: boolean;
  isFulfilled?: boolean;
  isCOD?: boolean;
  onLabelChange?: (label: ShippingLabel | null) => void;
  apiRef?: React.MutableRefObject<EnviaShippingButtonRef | null>;
}

// Ref interface for external control
export interface EnviaShippingButtonRef {
  createLabelWithDefaults: () => Promise<void>;
  isReady: boolean;
  isCreatingLabel: boolean;
  hasExistingLabel: boolean;
  selectedCarrierName: string | null;
}

// Helper to get proxied label URL
const getProxyLabelUrl = (labelUrl: string): string => {
  return `https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/proxy-label?url=${encodeURIComponent(labelUrl)}`;
};

// Format date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Municipios grandes de Cundinamarca donde Coordinadora es preferido
const CUNDINAMARCA_COORDINADORA_CITIES = [
  'bogota', 'soacha', 'chia', 'zipaquira', 'facatativa', 'subachoque',
  'cajica', 'cota', 'funza', 'mosquera', 'madrid', 'tenjo', 'tabio',
  'la calera', 'tocancipa', 'gachancipa', 'sibate', 'fusagasuga',
  'girardot', 'villeta', 'choconta', 'suesca', 'guaduas'
];

// Municipios del Valle de Aburrá (Antioquia) donde Coordinadora es preferido
const VALLE_ABURRA_CITIES = [
  'medellin', 'bello', 'itagui', 'envigado', 'sabaneta',
  'la estrella', 'caldas', 'copacabana', 'girardota', 'barbosa'
];

export const EnviaShippingButton: React.FC<EnviaShippingButtonProps> = ({
  shopifyOrderId,
  orderNumber,
  shippingAddress,
  customerEmail,
  customerPhone,
  totalPrice,
  disabled = false,
  isFulfilled = false,
  isCOD = false,
  onLabelChange,
  apiRef
}) => {
  const { currentOrganization } = useOrganization();
  const { 
    isCreatingLabel, 
    isLoadingLabel, 
    existingLabel, 
    labelHistory,
    getExistingLabel, 
    createLabel,
    clearLabel,
    checkCoverage,
    isCancellingLabel,
    cancelLabel,
    isDeletingLabel,
    deleteFailedLabel,
    isLoadingQuotes,
    quotes,
    getQuotes,
    clearQuotes
  } = useEnviaShipping();
  
  const [hasChecked, setHasChecked] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTracking, setManualTracking] = useState('');
  const [manualCarrier, setManualCarrier] = useState('coordinadora');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [recommendedCarrier, setRecommendedCarrier] = useState<string>('coordinadora');
  const [codAmount, setCodAmount] = useState<number>(totalPrice || 0);
  const [isEditingCod, setIsEditingCod] = useState(false);
  const [quotesLoaded, setQuotesLoaded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Update COD amount when totalPrice changes
  useEffect(() => {
    if (totalPrice !== undefined) {
      setCodAmount(totalPrice);
    }
  }, [totalPrice]);

  // Check for existing label when component mounts or order changes
  useEffect(() => {
    if (currentOrganization?.id && shopifyOrderId) {
      clearLabel();
      clearQuotes();
      setHasChecked(false);
      setShowManualEntry(false);
      setManualTracking('');
      setSelectedCarrier('');
      setQuotesLoaded(false);
      setShowHistory(false);
      getExistingLabel(shopifyOrderId, currentOrganization.id).then((label) => {
        setHasChecked(true);
        onLabelChange?.(label);
      });
    }
  }, [shopifyOrderId, currentOrganization?.id, getExistingLabel, clearLabel, clearQuotes, onLabelChange]);

  // Auto-load quotes when address is valid and no existing label
  useEffect(() => {
    if (
      currentOrganization?.id && 
      shippingAddress?.city && 
      shippingAddress?.province && 
      !existingLabel && 
      !quotesLoaded &&
      hasChecked
    ) {
      getQuotes({
        destination_city: shippingAddress.city,
        destination_department: shippingAddress.province,
        destination_postal_code: shippingAddress.zip,
        declared_value: totalPrice || 100000
      }).then(() => setQuotesLoaded(true));
    }
  }, [shippingAddress, currentOrganization?.id, existingLabel, quotesLoaded, hasChecked, totalPrice, getQuotes]);

  // Determine recommended carrier based on business rules
  useEffect(() => {
    const determineCarrier = () => {
      if (!shippingAddress?.city || !shippingAddress?.province) {
        setRecommendedCarrier('coordinadora');
        return;
      }

      const normalizeText = (text: string) => 
        text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

      const city = normalizeText(shippingAddress.city);
      const dept = normalizeText(shippingAddress.province);

      // Cundinamarca: solo Coordinadora para Bogotá y municipios grandes
      if (dept.includes('cundinamarca') || dept.includes('bogota') || 
          dept === 'dc' || dept === 'bog') {
        const isBigCundinamarcaCity = CUNDINAMARCA_COORDINADORA_CITIES.some(
          bigCity => city.includes(bigCity) || city === bigCity
        );
        
        if (isBigCundinamarcaCity || city.includes('bogota')) {
          setRecommendedCarrier('coordinadora');
          return;
        }
        // Municipios pequeños de Cundinamarca → default (Interrapidísimo)
      }

      // Valle de Aburrá (Antioquia) → Coordinadora
      if (dept.includes('antioquia') || dept === 'ant') {
        const isValleAburraCity = VALLE_ABURRA_CITIES.some(
          valleCity => city.includes(valleCity) || city === valleCity
        );
        
        if (isValleAburraCity) {
          setRecommendedCarrier('coordinadora');
          return;
        }
        // Otros municipios de Antioquia → default (Interrapidísimo)
      }

      // Jamundí, Valle del Cauca → Coordinadora
      if ((dept.includes('valle') || dept === 'val') && city.includes('jamundi')) {
        setRecommendedCarrier('coordinadora');
        return;
      }

      // Cali, Valle del Cauca → Coordinadora
      if ((dept.includes('valle') || dept === 'val') && city.includes('cali')) {
        setRecommendedCarrier('coordinadora');
        return;
      }

      // Calima (El Darién), Valle del Cauca → Interrapidísimo Domicilio
      if ((dept.includes('valle') || dept === 'val') && 
          (city.includes('calima') || city.includes('darien'))) {
        setRecommendedCarrier('interrapidisimo_domicilio');
        return;
      }

      // Floridablanca, Santander → Coordinadora (COD y Sin COD)
      if (dept.includes('santander') && city.includes('floridablanca')) {
        setRecommendedCarrier('coordinadora');
        return;
      }

      // Girón, Santander → Coordinadora (COD y Sin COD)
      if (dept.includes('santander') && city.includes('giron')) {
        setRecommendedCarrier('coordinadora');
        return;
      }

      // Tunja, Boyacá → Interrapidisimo Domicilio (COD y Sin COD)
      if (dept.includes('boyaca') && city.includes('tunja')) {
        setRecommendedCarrier('interrapidisimo_domicilio');
        return;
      }

      // Labranzagrande, Boyacá → ServiEntrega Premier (COD y Sin COD)
      if (dept.includes('boyaca') && city.includes('labranzagrande')) {
        setRecommendedCarrier('servientrega');
        return;
      }

      // Dosquebradas, Risaralda → Coordinadora (COD y Sin COD)
      if (dept.includes('risaralda') && city.includes('dosquebradas')) {
        setRecommendedCarrier('coordinadora');
        return;
      }

      // La Ceja, Antioquia → Coordinadora (COD y Sin COD)
      if (dept.includes('antioquia') && city.includes('la ceja')) {
        setRecommendedCarrier('coordinadora');
        return;
      }

      const MAIN_CITIES = [
        'barranquilla', 'cartagena', 'bucaramanga', 'cucuta',
        'pereira', 'villavicencio', 'pasto', 'santa marta', 'monteria',
        'armenia', 'popayan', 'sincelejo', 'valledupar', 'tunja', 
        'florencia', 'riohacha'
      ];

      const isMainCity = MAIN_CITIES.some(mainCity => city.includes(mainCity));

      if (isMainCity && !isCOD) {
        setRecommendedCarrier('deprisa');
      } else if (isMainCity && isCOD) {
        setRecommendedCarrier('coordinadora');  // COD en ciudades principales → Coordinadora
      } else {
        setRecommendedCarrier('interrapidisimo');  // Resto del país
      }
    };

    determineCarrier();
  }, [shippingAddress?.city, shippingAddress?.province, isCOD]);

  // Auto-select best carrier when quotes load
  useEffect(() => {
    if (quotes.length > 0 && !selectedCarrier) {
      const bestQuote = quotes.find(q => 
        q.carrier.toLowerCase() === recommendedCarrier.toLowerCase() &&
        q.deliveryType === 'domicilio'
      ) || quotes.find(q => 
        q.carrier.toLowerCase() === recommendedCarrier.toLowerCase()
      ) || quotes[0];
      
      if (bestQuote) {
        const autoKey = `${bestQuote.carrier}:${bestQuote.service}:${bestQuote.deliveryType}`;
        setSelectedCarrier(autoKey);
      }
    }
  }, [quotes, recommendedCarrier, selectedCarrier]);

  // Check if component is ready to create labels
  const isActiveLabel = existingLabel && existingLabel.status !== 'cancelled' && existingLabel.status !== 'error';
  const canCreateLabel = shippingAddress?.city && shippingAddress?.address1;
  const isReady = hasChecked && !isLoadingQuotes && canCreateLabel && !isActiveLabel;

  const handleCreateLabel = async () => {
    if (!currentOrganization?.id || !shippingAddress) {
      return;
    }

    const fullAddress = [
      shippingAddress.address1,
      shippingAddress.address2
    ].filter(Boolean).join(', ');

    const recipientName = shippingAddress.name || 'Cliente';
    const recipientPhone = shippingAddress.phone || customerPhone || '';
    const recipientEmail = customerEmail || '';
    const city = shippingAddress.city || '';
    const department = shippingAddress.province || '';
    const postalCode = shippingAddress.zip || '';

    let preferredCarrier: string | undefined;
    let preferredService: string | undefined;
    let deliveryType: 'domicilio' | 'oficina' | undefined;
    
    if (selectedCarrier && selectedCarrier !== 'auto') {
      const parts = selectedCarrier.split(':');
      if (parts.length === 3) {
        preferredCarrier = parts[0];
        preferredService = parts[1];
        deliveryType = parts[2] as 'domicilio' | 'oficina';
      } else {
        preferredCarrier = selectedCarrier;
      }
    }

    const result = await createLabel({
      shopify_order_id: shopifyOrderId,
      organization_id: currentOrganization.id,
      order_number: orderNumber,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_email: recipientEmail,
      destination_address: shippingAddress.address1 || '',
      destination_address2: shippingAddress.address2 || '',
      destination_city: city,
      destination_department: department,
      destination_postal_code: postalCode,
      declared_value: totalPrice || 0,
      package_content: `Pedido ${orderNumber}`,
      preferred_carrier: preferredCarrier,
      preferred_service: preferredService,
      delivery_type: deliveryType,
      is_cod: isCOD,
      cod_amount: isCOD ? codAmount : undefined
    });

    if (result.success && result.label) {
      onLabelChange?.(result.label);
      
      if (result.label.label_url) {
        const proxyUrl = getProxyLabelUrl(result.label.label_url);
        const printWindow = window.open(proxyUrl, '_blank', 'width=800,height=600');
        if (printWindow) {
          setTimeout(() => {
            try {
              printWindow.focus();
              printWindow.print();
            } catch (e) {
              console.log('Print dialog may need to be triggered manually');
            }
          }, 1500);
        }
      }
    }
  };

  // Helper to get the selected carrier display name
  const getSelectedCarrierDisplayName = (): string | null => {
    if (selectedCarrier && selectedCarrier !== 'auto') {
      // If quotes are available and selectedCarrier is in format "carrier:service:type"
      if (quotes.length > 0 && selectedCarrier.includes(':')) {
        const [carrierCode] = selectedCarrier.split(':');
        return CARRIER_NAMES[carrierCode as CarrierCode] || carrierCode;
      }
      // Direct carrier code
      return CARRIER_NAMES[selectedCarrier as CarrierCode] || selectedCarrier;
    }
    // Auto or no selection - use recommended carrier
    return CARRIER_NAMES[recommendedCarrier as CarrierCode] || 'Coordinadora';
  };

  // Expose methods via apiRef for external control
  useEffect(() => {
    if (!apiRef) return;

    apiRef.current = {
      createLabelWithDefaults: async () => {
        if (!isReady || isCreatingLabel) {
          toast.error('No es posible crear guía en este momento');
          return;
        }
        await handleCreateLabel();
      },
      isReady: !!isReady,
      isCreatingLabel,
      hasExistingLabel: !!isActiveLabel,
      selectedCarrierName: getSelectedCarrierDisplayName(),
    };

    return () => {
      apiRef.current = null;
    };
  }, [apiRef, isReady, isCreatingLabel, isActiveLabel, handleCreateLabel, selectedCarrier, quotes, recommendedCarrier]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleOpenLabel = () => {
    if (existingLabel?.label_url) {
      const proxyUrl = getProxyLabelUrl(existingLabel.label_url);
      window.open(proxyUrl, '_blank');
    }
  };

  const handlePrintLabel = () => {
    if (!existingLabel?.label_url) return;
    
    const proxyUrl = getProxyLabelUrl(existingLabel.label_url);
    const printWindow = window.open(proxyUrl, '_blank', 'width=800,height=600');
    
    if (printWindow) {
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (e) {
          console.log('Print dialog may need to be triggered manually');
        }
      }, 1500);
    }
  };

  const handleSaveManualLabel = async () => {
    if (!currentOrganization?.id || !manualTracking.trim()) {
      toast.error('Ingresa un número de tracking');
      return;
    }

    setIsSavingManual(true);
    try {
      const labelRecord = {
        organization_id: currentOrganization.id,
        shopify_order_id: shopifyOrderId,
        order_number: orderNumber,
        carrier: manualCarrier,
        tracking_number: manualTracking.trim(),
        status: 'manual',
        destination_city: shippingAddress?.city || '',
        destination_department: shippingAddress?.province || '',
        destination_address: [shippingAddress?.address1, shippingAddress?.address2].filter(Boolean).join(', '),
        recipient_name: shippingAddress?.name || '',
        recipient_phone: shippingAddress?.phone || customerPhone || ''
      };

      const { data, error } = await supabase
        .from('shipping_labels')
        .insert(labelRecord)
        .select()
        .single();

      if (error) throw error;

      toast.success('Guía registrada manualmente');
      onLabelChange?.(data as ShippingLabel);
      setShowManualEntry(false);
      setManualTracking('');
      
      await getExistingLabel(shopifyOrderId, currentOrganization.id);
    } catch (error: any) {
      console.error('Error saving manual label:', error);
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleCancelLabel = async () => {
    if (!existingLabel?.id || !currentOrganization?.id) return;

    const confirmed = window.confirm(
      '¿Estás seguro de cancelar esta guía? Se cancelará el fulfillment en Shopify y podrás crear una nueva guía.'
    );

    if (!confirmed) return;

    const result = await cancelLabel(existingLabel.id);

    if (result.success) {
      // Check if Shopify fulfillment was cancelled
      if (result.shopifyFulfillmentCancelled === false) {
        // Shopify fulfillment NOT cancelled - show warning with link but order still goes to packing
        toast.warning(
          'Guía cancelada. El pedido volvió a preparación. Recuerda cancelar el fulfillment manualmente en Shopify.',
          { 
            duration: 10000,
            action: {
              label: 'Ir a Shopify',
              onClick: () => {
                const shopifyAdminUrl = `https://admin.shopify.com/store/sewdle/orders/${shopifyOrderId}`;
                window.open(shopifyAdminUrl, '_blank');
              }
            }
          }
        );
      } else {
        toast.success(
          result.balanceReturned 
            ? 'Guía cancelada. El pedido volvió a preparación y el saldo fue devuelto.' 
            : 'Guía cancelada. El pedido volvió a preparación.'
        );
      }
      onLabelChange?.(null);
      // Refresh to get updated history
      await getExistingLabel(shopifyOrderId, currentOrganization.id);
      setShowHistory(true);
    } else {
      toast.error('Error al cancelar: ' + (result.error || 'Error desconocido'));
    }
  };

  // Label History Component
  const LabelHistorySection = () => {
    if (labelHistory.length === 0) return null;

    return (
      <Collapsible open={showHistory} onOpenChange={setShowHistory}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs text-muted-foreground hover:text-foreground justify-between"
          >
            <span className="flex items-center gap-1.5">
              <History className="h-3 w-3" />
              Historial de guías ({labelHistory.length})
            </span>
            {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 mt-2">
          {labelHistory.map((label) => {
            const carrierName = CARRIER_NAMES[label.carrier as CarrierCode] || label.carrier;
            const rawResponse = label.raw_response as { cancelled_at?: string } | null;
            const cancelledAt = rawResponse?.cancelled_at;
            
            return (
              <div 
                key={label.id} 
                className="p-2 bg-muted/50 rounded-md border border-border/50 text-xs"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge 
                    variant="secondary" 
                    className={
                      label.status === 'cancelled' 
                        ? "bg-gray-100 text-gray-600 text-[10px]" 
                        : "bg-red-100 text-red-600 text-[10px]"
                    }
                  >
                    {label.status === 'cancelled' ? 'Cancelada' : 'Error'}
                  </Badge>
                  <span className="font-medium">{carrierName}</span>
                  {label.tracking_number && (
                    <span className="font-mono text-muted-foreground">#{label.tracking_number}</span>
                  )}
                </div>
                <div className="mt-1 text-muted-foreground">
                  <span>Creada: {formatDate(label.created_at)}</span>
                  {cancelledAt && (
                    <span className="ml-2">• Cancelada: {formatDate(cancelledAt)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Show loading state while checking for existing label
  if (isLoadingLabel || !hasChecked) {
    return (
      <Button variant="outline" disabled className="w-full">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Verificando guía...
      </Button>
    );
  }

  // Show existing label info (only for active labels - not cancelled or error)
  // isActiveLabel already defined above for ref
  
  if (isActiveLabel) {
    const carrierName = CARRIER_NAMES[existingLabel.carrier as CarrierCode] || existingLabel.carrier;
    const isManual = existingLabel.status === 'manual';
    const canCancel = !isManual && existingLabel.tracking_number;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Badge 
            variant="secondary" 
            className={isManual ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}
          >
            <Truck className="h-3 w-3 mr-1" />
            {carrierName}
            {isManual && " (Manual)"}
          </Badge>
          {existingLabel.tracking_number && (
            <span className="font-mono text-xs">{existingLabel.tracking_number}</span>
          )}
        </div>
        
        {existingLabel.label_url ? (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleOpenLabel}
            >
              <FileText className="h-4 w-4 mr-2" />
              Ver PDF
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button 
              variant="default" 
              className="flex-1"
              onClick={handlePrintLabel}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        ) : isManual ? (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <PackageCheck className="h-4 w-4" />
            <span>Guía registrada manualmente</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span>Guía creada sin PDF disponible</span>
          </div>
        )}

        {/* Cancel button */}
        {canCancel && (
          <Button 
            variant="ghost" 
            size="sm"
            className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleCancelLabel}
            disabled={isCancellingLabel}
          >
            {isCancellingLabel ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Cancelando guía...
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Cancelar Guía
              </>
            )}
          </Button>
        )}

        {/* History section */}
        <LabelHistorySection />
      </div>
    );
  }

  // Show manual entry form
  if (showManualEntry) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Edit3 className="h-4 w-4" />
          Registrar guía manualmente
        </div>
        
        <div className="space-y-2">
          <Input
            placeholder="Número de tracking"
            value={manualTracking}
            onChange={(e) => setManualTracking(e.target.value)}
            className="text-sm"
          />
          
          <select
            value={manualCarrier}
            onChange={(e) => setManualCarrier(e.target.value)}
            className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
          >
            <option value="coordinadora">Coordinadora</option>
            <option value="interrapidisimo">Inter Rapidísimo</option>
            <option value="servientrega">Servientrega</option>
            <option value="deprisa">Deprisa</option>
            <option value="envia">Envía</option>
            <option value="tcc">TCC</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1"
            onClick={() => setShowManualEntry(false)}
          >
            Cancelar
          </Button>
          <Button 
            size="sm"
            className="flex-1"
            onClick={handleSaveManualLabel}
            disabled={isSavingManual || !manualTracking.trim()}
          >
            {isSavingManual ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            Guardar
          </Button>
        </div>

        {/* History section in manual entry view */}
        <LabelHistorySection />
      </div>
    );
  }

  // For fulfilled orders without a label - show special message
  if (isFulfilled && !labelHistory.length) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PackageCheck className="h-4 w-4" />
          <span>Pedido ya enviado - Guía no registrada</span>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          className="w-full"
          onClick={() => setShowManualEntry(true)}
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Registrar guía manualmente
        </Button>
      </div>
    );
  }

  // canCreateLabel already defined above

  if (!canCreateLabel) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>Dirección incompleta para crear guía</span>
        </div>
        <LabelHistorySection />
      </div>
    );
  }

  // Show create button with carrier selector and manual entry option
  return (
    <div className="space-y-3">
      {/* COD Amount Editor - only show for COD orders */}
      {isCOD && (
        <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
              💵 Valor a cobrar (Contraentrega)
            </label>
            {!isEditingCod && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                onClick={() => setIsEditingCod(true)}
              >
                <Edit3 className="h-3 w-3 mr-1" />
                Editar
              </Button>
            )}
          </div>
          
          {isEditingCod ? (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={codAmount}
                  onChange={(e) => setCodAmount(Number(e.target.value))}
                  className="pl-7 h-9 text-sm bg-white"
                  min={0}
                />
              </div>
              <Button
                size="sm"
                className="h-9 px-3"
                onClick={() => setIsEditingCod(false)}
              >
                Listo
              </Button>
            </div>
          ) : (
            <div className="text-lg font-bold text-amber-900">
              {formatCurrency(codAmount)}
            </div>
          )}
          
          {codAmount !== totalPrice && (
            <p className="text-xs text-amber-700">
              ⚠️ El valor difiere del total del pedido ({formatCurrency(totalPrice || 0)})
            </p>
          )}
        </div>
      )}

      {/* Carrier selector with quotes */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Truck className="h-3 w-3" />
          Transportadora
        </label>
        
        {isLoadingQuotes ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Obteniendo precios...
          </div>
        ) : quotes.length > 0 ? (
          <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
            <SelectTrigger className="w-full h-auto min-h-10 py-2">
              <SelectValue placeholder="Seleccionar transportadora y servicio">
                {selectedCarrier && (() => {
                  const [carrier, service, type] = selectedCarrier.split(':');
                  const quote = quotes.find(q => 
                    q.carrier === carrier && q.service === service && q.deliveryType === type
                  );
                  if (quote) {
                    return (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{CARRIER_NAMES[quote.carrier.toLowerCase() as CarrierCode] || quote.carrier}</span>
                        <span className="text-muted-foreground">{quote.serviceDisplayName}</span>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {quote.deliveryType === 'domicilio' ? '🏠' : '🏢'}
                        </Badge>
                        <span className="text-green-600 font-semibold">{formatCurrency(quote.price)}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {quotes.map((quote) => {
                const quoteKey = `${quote.carrier}:${quote.service}:${quote.deliveryType}`;
                return (
                  <SelectItem key={quoteKey} value={quoteKey} className="py-2">
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-medium min-w-[100px]">
                        {CARRIER_NAMES[quote.carrier.toLowerCase() as CarrierCode] || quote.carrier}
                      </span>
                      <span className="text-muted-foreground text-xs min-w-[70px]">
                        {quote.serviceDisplayName}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] h-5 ${
                          quote.deliveryType === 'domicilio' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {quote.deliveryType === 'domicilio' ? '🏠 Domicilio' : '🏢 Sucursal'}
                      </Badge>
                      {quote.estimated_days > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          ~{quote.estimated_days}d
                        </span>
                      )}
                      <span className="font-semibold text-green-600 ml-auto">
                        {formatCurrency(quote.price)}
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        ) : (
          <Select value={selectedCarrier || 'auto'} onValueChange={setSelectedCarrier}>
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue placeholder="Seleccionar transportadora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automático ({CARRIER_NAMES[recommendedCarrier as CarrierCode] || 'Coordinadora'})</SelectItem>
              <SelectItem value="coordinadora">Coordinadora</SelectItem>
              <SelectItem value="interrapidisimo">Inter Rapidísimo</SelectItem>
              <SelectItem value="deprisa">Deprisa</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <Button 
        variant="outline" 
        className="w-full"
        onClick={handleCreateLabel}
        disabled={disabled || isCreatingLabel}
      >
        {isCreatingLabel ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Creando guía...
          </>
        ) : (
          <>
            <Truck className="h-4 w-4 mr-2" />
            {isCOD ? `Crear Guía COD (${formatCurrency(codAmount)})` : 'Crear Guía de Envío'}
          </>
        )}
      </Button>
      
      <Button 
        variant="ghost" 
        size="sm"
        className="w-full text-xs text-muted-foreground"
        onClick={() => setShowManualEntry(true)}
      >
        <Edit3 className="h-3 w-3 mr-1" />
        O registrar guía existente
      </Button>

      {/* History section */}
      <LabelHistorySection />
    </div>
  );
};

EnviaShippingButton.displayName = 'EnviaShippingButton';
