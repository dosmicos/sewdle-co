import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Truck, FileText, Loader2, ExternalLink, AlertCircle, PackageCheck, Edit3 } from 'lucide-react';
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
  onLabelChange?: (label: ShippingLabel | null) => void;
}

export const EnviaShippingButton: React.FC<EnviaShippingButtonProps> = ({
  shopifyOrderId,
  orderNumber,
  shippingAddress,
  customerEmail,
  customerPhone,
  totalPrice,
  disabled = false,
  isFulfilled = false,
  onLabelChange
}) => {
  const { currentOrganization } = useOrganization();
  const { 
    isCreatingLabel, 
    isLoadingLabel, 
    existingLabel, 
    getExistingLabel, 
    createLabel,
    clearLabel
  } = useEnviaShipping();
  
  const [hasChecked, setHasChecked] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTracking, setManualTracking] = useState('');
  const [manualCarrier, setManualCarrier] = useState('coordinadora');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('auto');

  // Check for existing label when component mounts or order changes
  useEffect(() => {
    if (currentOrganization?.id && shopifyOrderId) {
      clearLabel();
      setHasChecked(false);
      setShowManualEntry(false);
      setManualTracking('');
      setSelectedCarrier('auto'); // Reset carrier selection on order change
      getExistingLabel(shopifyOrderId, currentOrganization.id).then((label) => {
        setHasChecked(true);
        onLabelChange?.(label);
      });
    }
  }, [shopifyOrderId, currentOrganization?.id, getExistingLabel, clearLabel, onLabelChange]);

  const handleCreateLabel = async () => {
    if (!currentOrganization?.id || !shippingAddress) {
      return;
    }

    // Build full address
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

    const result = await createLabel({
      shopify_order_id: shopifyOrderId,
      organization_id: currentOrganization.id,
      order_number: orderNumber,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_email: recipientEmail,
      destination_address: fullAddress,
      destination_city: city,
      destination_department: department,
      destination_postal_code: postalCode,
      declared_value: totalPrice || 0,
      package_content: `Pedido ${orderNumber}`,
      preferred_carrier: selectedCarrier !== 'auto' ? selectedCarrier : undefined
    });

    if (result.success && result.label) {
      onLabelChange?.(result.label);
    }
  };

  const handleOpenLabel = () => {
    if (existingLabel?.label_url) {
      window.open(existingLabel.label_url, '_blank');
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
      
      // Refresh to show the saved label
      await getExistingLabel(shopifyOrderId, currentOrganization.id);
    } catch (error: any) {
      console.error('Error saving manual label:', error);
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setIsSavingManual(false);
    }
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

  // Show existing label info
  if (existingLabel) {
    const carrierName = CARRIER_NAMES[existingLabel.carrier as CarrierCode] || existingLabel.carrier;
    const isManual = existingLabel.status === 'manual';
    const isError = existingLabel.status === 'error';
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Badge 
            variant="secondary" 
            className={isError ? "bg-red-100 text-red-800" : isManual ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}
          >
            <Truck className="h-3 w-3 mr-1" />
            {carrierName}
            {isManual && " (Manual)"}
            {isError && " (Error)"}
          </Badge>
          {existingLabel.tracking_number && (
            <span className="font-mono text-xs">{existingLabel.tracking_number}</span>
          )}
        </div>
        
        {existingLabel.label_url ? (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleOpenLabel}
          >
            <FileText className="h-4 w-4 mr-2" />
            Ver Guía PDF
            <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>Error al crear guía - Intenta de nuevo</span>
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
      </div>
    );
  }

  // For fulfilled orders without a label - show special message
  if (isFulfilled) {
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

  // Check if we have enough info to create a label
  const canCreateLabel = shippingAddress?.city && shippingAddress?.address1;

  if (!canCreateLabel) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span>Dirección incompleta para crear guía</span>
      </div>
    );
  }

  // Show create button with carrier selector and manual entry option
  return (
    <div className="space-y-3">
      {/* Carrier selector */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Truck className="h-3 w-3" />
          Transportadora
        </label>
        <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
          <SelectTrigger className="w-full h-9 text-sm">
            <SelectValue placeholder="Seleccionar transportadora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automático (recomendado)</SelectItem>
            <SelectItem value="coordinadora">Coordinadora</SelectItem>
            <SelectItem value="interrapidisimo">Inter Rapidísimo</SelectItem>
            <SelectItem value="servientrega">Servientrega</SelectItem>
            <SelectItem value="deprisa">Deprisa</SelectItem>
            <SelectItem value="tcc">TCC</SelectItem>
            <SelectItem value="envia">Envía</SelectItem>
          </SelectContent>
        </Select>
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
            Crear Guía de Envío
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
    </div>
  );
};
