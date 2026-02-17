import { supabase } from '@/integrations/supabase/client';
import type { ValidationResult } from '@/components/alegra/InvoiceValidationModal';

interface ShopifyOrder {
  id: string;
  shopify_order_id: number;
  order_number: string;
  customer_phone: string | null;
  customer_email: string | null;
  billing_address: any;
  shipping_address: any;
  total_price: number;
  subtotal_price?: number;
  total_tax?: number;
  taxes_included?: boolean;
  financial_status: string;
  tags?: string;
  line_items: Array<{
    price: number;
    quantity: number;
    title?: string;
  }>;
}

interface EditedInvoiceData {
  customer: {
    identificationNumber: string;
    phone: string;
    email: string;
  };
  lineItems: Array<{
    price: number;
    quantity: number;
    title?: string;
  }>;
}

// Delivery status messages mapping
const DELIVERY_STATUS_MESSAGES: Record<string, { message: string; detail: string }> = {
  'sin_guia': { message: 'Sin registro de guía', detail: 'No hay guía de envío registrada en el sistema para este pedido' },
  'sin_tracking': { message: 'Guía incompleta', detail: 'Tiene guía registrada pero sin número de rastreo' },
  'pending': { message: 'Pendiente', detail: 'El envío está pendiente de procesamiento' },
  'in_transit': { message: 'En tránsito', detail: 'El paquete está en camino pero no ha sido entregado' },
  'en_transito': { message: 'En tránsito', detail: 'El paquete está en camino pero no ha sido entregado' },
  'recogido': { message: 'Recogido', detail: 'El paquete fue recogido pero aún no entregado' },
  'collected': { message: 'Recogido', detail: 'El paquete fue recogido pero aún no entregado' },
  'en_bodega': { message: 'En bodega', detail: 'El paquete está en bodega de la transportadora' },
  'in_warehouse': { message: 'En bodega', detail: 'El paquete está en bodega de la transportadora' },
  'devuelto': { message: 'Devuelto', detail: 'El paquete fue devuelto al remitente' },
  'returned': { message: 'Devuelto', detail: 'El paquete fue devuelto al remitente' },
  'cancelled': { message: 'Cancelado', detail: 'El envío fue cancelado' },
  'cancelado': { message: 'Cancelado', detail: 'El envío fue cancelado' },
  'novedad': { message: 'Con novedad', detail: 'El envío tiene una novedad pendiente de resolver' },
  'exception': { message: 'Con novedad', detail: 'El envío tiene una novedad pendiente de resolver' },
  'delivered': { message: 'Entregada', detail: 'Entrega confirmada por la transportadora' },
  'entregado': { message: 'Entregada', detail: 'Entrega confirmada por la transportadora' },
  'manual_confirmed': { message: 'Confirmada manualmente', detail: 'El usuario confirmó que el pedido fue entregado' },
  'error': { message: 'Error de verificación', detail: 'No se pudo verificar el estado del envío' },
  'unknown': { message: 'Estado desconocido', detail: 'No se pudo determinar el estado actual del envío' },
};

export const validateOrderForInvoice = async (
  order: ShopifyOrder,
  editedData?: EditedInvoiceData,
  manualDeliveryConfirmed?: boolean
): Promise<ValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Initialize checks
  const checks: ValidationResult['checks'] = {
    clientCheck: { passed: false, message: 'Verificando...' },
    priceCheck: { passed: false, invoiceTotal: 0, shopifyTotal: order.subtotal_price ?? order.total_price, message: 'Verificando...' },
    paymentCheck: { passed: false, message: 'Verificando...' },
  };

  // 1. CLIENT VALIDATION (phone → identification → email → create)
  try {
    const customerPhone = editedData?.customer?.phone ||
      order.customer_phone ||
      order.billing_address?.phone ||
      order.shipping_address?.phone;

    const identificationNumber = editedData?.customer?.identificationNumber ||
      (order.billing_address?.company || order.shipping_address?.company || '').replace(/[^0-9]/g, '');

    const customerEmail = editedData?.customer?.email ||
      order.customer_email ||
      order.billing_address?.email ||
      order.shipping_address?.email;

    console.log('Validación cliente - Datos del pedido:', {
      phone: customerPhone,
      identification: identificationNumber,
      email: customerEmail,
      orderNumber: order.order_number,
    });

    // Buscar cliente en Alegra (con paginación / filtros desde el edge function)
    const { data: findContactResponse, error: findContactError } = await supabase.functions.invoke('alegra-api', {
      body: {
        action: 'find-contact',
        data: {
          phone: customerPhone,
          identification: identificationNumber,
          email: customerEmail,
        },
      },
    });

    if (findContactError) throw findContactError;

    const payload = findContactResponse as any;
    const searchResult = payload?.data || payload;
    const rateLimited = Boolean(searchResult?.rateLimited);
    const retryAfterSec = searchResult?.retryAfterSec || 20;
    const found = Boolean(searchResult?.found);
    const matchedBy = (searchResult?.matchedBy || 'created') as 'phone' | 'identification' | 'email' | 'created' | 'rate_limited';

    console.log('Validación cliente - Resultado búsqueda:', {
      found,
      matchedBy,
      rateLimited,
      contactId: searchResult?.contact?.id,
      contactName: searchResult?.contact?.name,
    });

    if (rateLimited) {
      // Rate limit - mostrar mensaje claro sin bloquear como error fatal
      checks.clientCheck = {
        passed: false,
        message: `Alegra está limitando solicitudes. Espera ${retryAfterSec} segundos y reintenta.`,
      };
      warnings.push(`Rate limit de Alegra. Espera ${retryAfterSec}s y reintenta la validación.`);
    } else if (found) {
      checks.clientCheck = {
        passed: true,
        matchedBy,
        message: matchedBy === 'phone'
          ? 'Cliente encontrado por teléfono'
          : matchedBy === 'identification'
          ? 'Cliente encontrado por cédula'
          : 'Cliente encontrado por email',
      };
    } else {
      checks.clientCheck = {
        passed: true,
        matchedBy: 'created',
        message: 'Se creará un nuevo cliente en Alegra',
      };
      warnings.push('Se creará un nuevo cliente en Alegra');
    }
  } catch (error: any) {
    console.error('Validación cliente - Error:', error);
    const errorMsg = error?.message || String(error);
    // Detectar rate limit en errores
    if (errorMsg.toLowerCase().includes('too many requests') || errorMsg.toLowerCase().includes('rate limit')) {
      checks.clientCheck = {
        passed: false,
        message: 'Alegra está limitando solicitudes. Espera 20 segundos y reintenta.',
      };
      warnings.push('Rate limit de Alegra. Espera 20s y reintenta.');
    } else {
      checks.clientCheck = {
        passed: false,
        message: 'Error al verificar cliente: ' + errorMsg,
      };
      errors.push('Error al verificar cliente: ' + errorMsg);
    }
  }

  // 2. COD DELIVERY VALIDATION
  const orderTags = (order as any).tags || '';
  const isContraentrega = orderTags.toLowerCase().includes('contraentrega') || 
                          order.financial_status === 'pending';

  if (isContraentrega) {
    try {
      // Search for shipping label
      const { data: shippingLabel, error: labelError } = await supabase
        .from('shipping_labels')
        .select('tracking_number, carrier, status')
        .eq('shopify_order_id', order.shopify_order_id)
        .maybeSingle();

      if (labelError) throw labelError;

      if (!shippingLabel) {
        // No shipping label found - check if manual confirmation was provided
        const statusInfo = DELIVERY_STATUS_MESSAGES[manualDeliveryConfirmed ? 'manual_confirmed' : 'sin_guia'];
        if (manualDeliveryConfirmed) {
          checks.deliveryCheck = {
            passed: true,
            status: 'manual_confirmed',
            message: statusInfo.message,
            detail: statusInfo.detail,
          };
        } else {
          checks.deliveryCheck = {
            passed: false,
            status: 'sin_guia',
            message: statusInfo.message,
            detail: statusInfo.detail,
          };
          errors.push(`${statusInfo.message}: ${statusInfo.detail}`);
        }
      } else if (shippingLabel.tracking_number) {
        // Check tracking status
        const { data: trackingResult } = await supabase.functions.invoke('envia-track', {
          body: {
            tracking_number: shippingLabel.tracking_number,
            carrier: shippingLabel.carrier || 'coordinadora',
          },
        });

        const deliveryStatus = trackingResult?.status || shippingLabel.status || 'unknown';
        const deliveryStatusLower = deliveryStatus.toLowerCase();

        // Case-insensitive comparison for delivery status
        if (deliveryStatusLower === 'delivered' || deliveryStatusLower === 'entregado') {
          const statusInfo = DELIVERY_STATUS_MESSAGES['delivered'];
          checks.deliveryCheck = {
            passed: true,
            status: 'delivered',
            message: statusInfo.message,
            detail: statusInfo.detail,
          };
        } else if (manualDeliveryConfirmed) {
          // Status not delivered but manual confirmation provided
          const statusInfo = DELIVERY_STATUS_MESSAGES['manual_confirmed'];
          checks.deliveryCheck = {
            passed: true,
            status: 'manual_confirmed',
            message: statusInfo.message,
            detail: statusInfo.detail,
          };
        } else {
          // Get specific status info or fallback to unknown
          const statusInfo = DELIVERY_STATUS_MESSAGES[deliveryStatusLower] || DELIVERY_STATUS_MESSAGES['unknown'];
          checks.deliveryCheck = {
            passed: false,
            status: deliveryStatusLower,
            message: statusInfo.message,
            detail: statusInfo.detail,
          };
          errors.push(`No entregada (${statusInfo.message}): ${statusInfo.detail}`);
        }
      } else {
        // Has shipping label but no tracking number
        const statusInfo = DELIVERY_STATUS_MESSAGES[manualDeliveryConfirmed ? 'manual_confirmed' : 'sin_tracking'];
        if (manualDeliveryConfirmed) {
          checks.deliveryCheck = {
            passed: true,
            status: 'manual_confirmed',
            message: statusInfo.message,
            detail: statusInfo.detail,
          };
        } else {
          checks.deliveryCheck = {
            passed: false,
            status: 'sin_tracking',
            message: statusInfo.message,
            detail: statusInfo.detail,
          };
          errors.push(`${statusInfo.message}: ${statusInfo.detail}`);
        }
      }
    } catch (error: any) {
      const statusInfo = DELIVERY_STATUS_MESSAGES['error'];
      checks.deliveryCheck = {
        passed: false,
        status: 'error',
        message: statusInfo.message,
        detail: error.message,
      };
      // Don't block emission for tracking errors, just warn
      warnings.push(`${statusInfo.message}: ${error.message}`);
    }
  }

  // 3. PRICE VALIDATION - Compare invoice total with Shopify expected total
  // Calculate expected total from line items WITH their discounts applied
  const calculatedSubtotal = order.line_items.reduce((sum, item) => {
    const itemDiscount = (item as any).total_discount || 0;
    const priceWithDiscount = item.price - (itemDiscount / item.quantity);
    return sum + (priceWithDiscount * item.quantity);
  }, 0);
  
  // Invoice total from edited data or from calculated subtotal
  const invoiceTotal = editedData
    ? editedData.lineItems
        .filter((item: any) => !item.isShipping)
        .reduce((sum, item) => sum + (item.price * item.quantity), 0)
    : calculatedSubtotal;
  
  // Compare invoice total against calculated subtotal (with discounts applied)
  const priceDifference = Math.abs(invoiceTotal - calculatedSubtotal);
  
  // Stricter tolerance: $1000 COP max difference, otherwise block
  const priceMatch = priceDifference <= 1000;

  checks.priceCheck = {
    passed: priceMatch,
    invoiceTotal,
    shopifyTotal: calculatedSubtotal,
    message: priceMatch
      ? `Total productos: $${calculatedSubtotal.toLocaleString('es-CO')}`
      : `Diferencia de $${priceDifference.toLocaleString('es-CO')} (Factura: $${invoiceTotal.toLocaleString('es-CO')} vs Calculado: $${calculatedSubtotal.toLocaleString('es-CO')})`,
  };

  if (!priceMatch) {
    // BLOCK emission if difference is > $1000
    errors.push(`El total de la factura ($${invoiceTotal.toLocaleString('es-CO')}) difiere significativamente del esperado ($${calculatedSubtotal.toLocaleString('es-CO')}). Diferencia: $${priceDifference.toLocaleString('es-CO')}`);
  }

  // 4. PAID ORDER VALIDATION
  if (order.financial_status === 'paid') {
    const customerEmail = editedData?.customer?.email || order.customer_email || order.billing_address?.email;
    const customerPhone = editedData?.customer?.phone || order.customer_phone || order.billing_address?.phone;
    const hasAddress = order.billing_address?.address1 || order.shipping_address?.address1;

    const hasContactInfo = customerEmail || customerPhone;
    
    if (!hasContactInfo) {
      checks.paymentCheck = {
        passed: false,
        message: 'Pedido pagado sin datos de contacto del cliente',
      };
      errors.push('Pedido pagado sin datos de contacto del cliente (email o teléfono)');
    } else if (!hasAddress) {
      checks.paymentCheck = {
        passed: true,
        message: 'Pedido pagado verificado (sin dirección de facturación)',
      };
      warnings.push('Pedido pagado sin dirección de facturación completa');
    } else {
      checks.paymentCheck = {
        passed: true,
        message: 'Pedido pagado con datos completos',
      };
    }
  } else {
    checks.paymentCheck = {
      passed: true,
      message: `Estado de pago: ${order.financial_status}`,
    };
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks,
  };
};
