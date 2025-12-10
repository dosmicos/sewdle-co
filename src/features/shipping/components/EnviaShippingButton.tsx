import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Truck, FileText, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { useEnviaShipping } from '../hooks/useEnviaShipping';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Badge } from '@/components/ui/badge';
import { CARRIER_NAMES, CarrierCode, ShippingLabel } from '../types/envia';

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

  // Check for existing label when component mounts or order changes
  useEffect(() => {
    if (currentOrganization?.id && shopifyOrderId) {
      clearLabel();
      setHasChecked(false);
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
      package_content: `Pedido ${orderNumber}`
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
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <Truck className="h-3 w-3 mr-1" />
            {carrierName}
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
        ) : (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span>Guía creada sin PDF disponible</span>
          </div>
        )}
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

  // Show create button
  return (
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
  );
};
