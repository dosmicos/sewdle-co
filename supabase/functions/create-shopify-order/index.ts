import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LineItem {
  productId: number;
  productName?: string;
  variantId: number;
  variantName?: string;
  quantity?: number;
}

interface OrderData {
  customerName: string;
  cedula?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  department: string;
  neighborhood: string;
  // New multi-product format
  lineItems?: LineItem[];
  // Legacy single-product format (backward compatible)
  productId?: number;
  quantity?: number;
  variantId?: number;
  notes?: string;
  shippingCost?: number;
  paymentMethod?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { orderData, organizationId } = body as { orderData: OrderData; organizationId: string };

    if (!orderData || !organizationId) {
      return new Response(
        JSON.stringify({ error: "Faltan datos requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Shopify credentials
    const { data: org } = await supabase
      .from('organizations')
      .select('shopify_credentials')
      .eq('id', organizationId)
      .single();

    if (!org?.shopify_credentials) {
      return new Response(
        JSON.stringify({ error: "No hay credenciales de Shopify configuradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shopifyCreds = org.shopify_credentials as any;
    const shopifyDomain = shopifyCreds.store_domain || shopifyCreds.shopDomain;
    const accessToken = shopifyCreds.access_token || shopifyCreds.accessToken;

    if (!shopifyDomain || !accessToken) {
      return new Response(
        JSON.stringify({ error: "Credenciales de Shopify incompletas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating Shopify order for:", orderData.email);

    // Build lineItems array - support both new multi-product and legacy single-product format
    let lineItems: LineItem[] = [];
    if (orderData.lineItems && Array.isArray(orderData.lineItems) && orderData.lineItems.length > 0) {
      lineItems = orderData.lineItems;
    } else if (orderData.productId) {
      // Legacy single-product format
      lineItems = [{
        productId: orderData.productId,
        variantId: orderData.variantId!,
        quantity: orderData.quantity || 1
      }];
    }

    if (lineItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "No se proporcionaron productos para el pedido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each line item's product and variant
    const validatedLineItems: Array<{ variant_id: number; quantity: number }> = [];

    for (const item of lineItems) {
      const productUrl = `https://${shopifyDomain}/admin/api/2024-01/products/${item.productId}.json`;
      const productResponse = await fetch(productUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!productResponse.ok) {
        console.error(`❌ Product ${item.productId} (${item.productName || 'unknown'}) not found in Shopify`);
        return new Response(
          JSON.stringify({ error: `Producto "${item.productName || item.productId}" no encontrado en Shopify` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const productData = await productResponse.json();
      const product = productData.product;

      if (!item.variantId) {
        console.error(`❌ variantId is missing for product ${item.productId} (${item.productName || product.title})`);
        return new Response(
          JSON.stringify({ error: `Falta el variantId (talla) para el producto "${item.productName || product.title}".` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const variant = product.variants?.find((v: any) => String(v.id) === String(item.variantId));
      if (!variant) {
        console.error(`❌ variantId ${item.variantId} NOT FOUND in product ${item.productId}. Available: ${product.variants?.map((v: any) => `${v.title}(${v.id})`).join(', ')}`);
        return new Response(
          JSON.stringify({ error: `El variantId ${item.variantId} no pertenece al producto ${product.title}. Variantes disponibles: ${product.variants?.map((v: any) => `${v.title}(id:${v.id})`).join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`✅ Variant validated: ${variant.title} (${item.variantId}) for product ${product.title}`);
      validatedLineItems.push({
        variant_id: item.variantId,
        quantity: item.quantity || 1
      });
    }

    console.log(`📦 All ${validatedLineItems.length} line items validated`);

    // Create customer in Shopify
    const customerData = {
      customer: {
        email: orderData.email,
        first_name: orderData.customerName.split(' ')[0],
        last_name: orderData.customerName.split(' ').slice(1).join(' ') || '',
        phone: orderData.phone,
        addresses: [
          {
            address1: orderData.address,
            city: orderData.city,
            province: orderData.department,
            country: 'CO',
            zip: '',
            company: orderData.cedula || '',
            first_name: orderData.customerName.split(' ')[0],
            last_name: orderData.customerName.split(' ').slice(1).join(' ') || '',
            phone: orderData.phone,
          }
        ],
      }
    };

    const customerResponse = await fetch(`https://${shopifyDomain}/admin/api/2024-01/customers.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData),
    });

    let customerId: number | null = null;

    if (customerResponse.ok) {
      const customerJson = await customerResponse.json();
      customerId = customerJson.customer?.id;
      console.log("Customer created:", customerId);
    } else {
      // Try to find existing customer by email
      const searchResponse = await fetch(
        `https://${shopifyDomain}/admin/api/2024-01/customers/search.json?query=email:${orderData.email}`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.customers?.length > 0) {
          customerId = searchData.customers[0].id;
          console.log("Found existing customer:", customerId);
        }
      }
    }

    // Build tags based on payment method
    const isContraEntrega = orderData.paymentMethod === 'contra_entrega';
    const isLinkDePago = orderData.paymentMethod === 'link_de_pago';
    const orderTags = ['whatsapp', 'messaging'];
    if (isContraEntrega) {
      orderTags.push('Contraentrega');
    }
    if (isLinkDePago) {
      orderTags.push('Link de pago', 'Bold');
    }

    // Create the order
    const orderPayload: any = {
      order: {
        line_items: validatedLineItems,
        customer: customerId ? { id: customerId } : undefined,
        email: orderData.email,
        shipping_address: {
          first_name: orderData.customerName.split(' ')[0],
          last_name: orderData.customerName.split(' ').slice(1).join(' ') || '',
          company: orderData.cedula || '',
          address1: orderData.address,
          city: orderData.city,
          province: orderData.department,
          country: 'CO',
          phone: orderData.phone,
        },
        billing_address: {
          first_name: orderData.customerName.split(' ')[0],
          last_name: orderData.customerName.split(' ').slice(1).join(' ') || '',
          company: orderData.cedula || '',
          address1: orderData.address,
          city: orderData.city,
          province: orderData.department,
          country: 'CO',
          phone: orderData.phone,
        },
        shipping_lines: orderData.shippingCost && orderData.shippingCost > 0 ? [{
          title: "Envío",
          price: String(orderData.shippingCost),
          code: "SHIPPING",
        }] : [],
        note: orderData.notes || 'Pedido creado desde WhatsApp',
        tags: orderTags.join(', '),
        financial_status: isLinkDePago ? 'paid' : 'pending',
      }
    };

    // For contra entrega, set the payment gateway to Cash on Delivery (COD)
    if (isContraEntrega) {
      orderPayload.order.gateway = 'Cash on Delivery (COD)';
      orderPayload.order.note = (orderData.notes ? orderData.notes + ' | ' : '') + 'Pedido creado desde WhatsApp - Pago contra entrega';
    }

    // For link de pago (Bold), mark as paid
    if (isLinkDePago) {
      orderPayload.order.gateway = 'Bold';
      orderPayload.order.note = (orderData.notes ? orderData.notes + ' | ' : '') + 'Pedido creado desde WhatsApp - Pagado via Bold';
    }

    const orderResponse = await fetch(`https://${shopifyDomain}/admin/api/2024-01/orders.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error("Shopify order error:", errorText);
      return new Response(
        JSON.stringify({ error: "Error al crear pedido en Shopify", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderJson = await orderResponse.json();
    const order = orderJson.order;

    console.log("Order created successfully:", order.id, order.order_number);

    // Save order to database
    await supabase.from('orders').insert({
      organization_id: organizationId,
      shopify_order_id: order.id,
      shopify_order_number: String(order.order_number),
      customer_email: orderData.email,
      customer_name: orderData.customerName,
      customer_phone: orderData.phone,
      total_amount: order.total_price,
      status: 'pending',
      financial_status: order.financial_status,
    });

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
        orderName: order.name,
        totalPrice: order.total_price,
        checkoutUrl: order.checkout_url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error creating order:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
