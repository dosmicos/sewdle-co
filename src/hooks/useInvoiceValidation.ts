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

export const validateOrderForInvoice = async (
  order: ShopifyOrder,
  editedData?: EditedInvoiceData
): Promise<ValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Initialize checks
  const checks: ValidationResult['checks'] = {
    clientCheck: { passed: false, message: 'Verificando...' },
    priceCheck: { passed: false, invoiceTotal: 0, shopifyTotal: order.total_price, message: 'Verificando...' },
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
        checks.deliveryCheck = {
          passed: false,
          status: 'sin_guia',
          message: 'Contraentrega sin guía de envío generada',
        };
        errors.push('Pedido contraentrega sin guía de envío generada');
      } else if (shippingLabel.tracking_number) {
        // Check tracking status
        const { data: trackingResult } = await supabase.functions.invoke('envia-track', {
          body: {
            tracking_number: shippingLabel.tracking_number,
            carrier: shippingLabel.carrier || 'coordinadora',
          },
        });

        const deliveryStatus = trackingResult?.status || shippingLabel.status || 'unknown';

        if (deliveryStatus === 'delivered' || deliveryStatus === 'entregado') {
          checks.deliveryCheck = {
            passed: true,
            status: deliveryStatus,
            message: 'Entrega confirmada',
          };
        } else {
          checks.deliveryCheck = {
            passed: false,
            status: deliveryStatus,
            message: `Contraentrega no entregada. Estado: ${deliveryStatus}`,
          };
          errors.push(`Contraentrega no entregada. Estado actual: ${deliveryStatus}`);
        }
      } else {
        checks.deliveryCheck = {
          passed: false,
          status: 'pending',
          message: 'Guía sin número de rastreo',
        };
        errors.push('Guía de envío sin número de rastreo');
      }
    } catch (error: any) {
      checks.deliveryCheck = {
        passed: false,
        status: 'error',
        message: 'Error al verificar entrega: ' + error.message,
      };
      // Don't block emission for tracking errors, just warn
      warnings.push('No se pudo verificar el estado de entrega: ' + error.message);
    }
  }

  // 3. PRICE VALIDATION - Compare invoice total with Shopify total (both include shipping)
  // Calculate invoice total from edited data or line items (shipping is included as a line item)
  const lineItemsTotal = order.line_items.reduce(
    (sum, item) => sum + (item.price * item.quantity), 0
  );
  
  const invoiceTotal = editedData
    ? editedData.lineItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    : lineItemsTotal;
  
  // Use Shopify's total_price which includes products + shipping
  const shopifyTotal = order.total_price;
  
  // Compare totals (both should include shipping)
  const priceDifference = Math.abs(invoiceTotal - shopifyTotal);
  const priceMatch = priceDifference <= 100; // $100 COP tolerance for rounding

  checks.priceCheck = {
    passed: priceMatch,
    invoiceTotal,
    shopifyTotal,
    message: priceMatch
      ? `Total coincide: $${shopifyTotal.toLocaleString('es-CO')}`
      : `Diferencia de $${priceDifference.toLocaleString('es-CO')} (Factura: $${invoiceTotal.toLocaleString('es-CO')} vs Shopify: $${shopifyTotal.toLocaleString('es-CO')})`,
  };

  if (!priceMatch) {
    warnings.push(`El total de la factura ($${invoiceTotal.toLocaleString('es-CO')}) difiere del total de Shopify ($${shopifyTotal.toLocaleString('es-CO')})`);
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
