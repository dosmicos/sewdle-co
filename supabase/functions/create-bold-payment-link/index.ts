import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LineItem {
  productId: number;
  productName: string;
  variantId: number;
  variantName: string;
  quantity: number;
}

interface PaymentLinkRequest {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  organizationId: string;
  conversationId?: string;
  // Order data to store as pending
  orderData?: {
    cedula?: string;
    address: string;
    city: string;
    department: string;
    neighborhood?: string;
    lineItems: LineItem[];
    notes?: string;
    shippingCost?: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as PaymentLinkRequest;
    const { amount, description, customerEmail, customerName, customerPhone, organizationId, conversationId, orderData } = body;

    if (!amount || !customerEmail || !organizationId) {
      return new Response(
        JSON.stringify({ error: "Monto, correo del cliente y organizationId son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Bold API key from organization
    const { data: org } = await supabase
      .from('organizations')
      .select('bold_credentials')
      .eq('id', organizationId)
      .single();

    let boldApiKey = org?.bold_credentials
      ? ((org.bold_credentials as any).api_key || (org.bold_credentials as any).apiKey)
      : null;

    // Fallback to env
    if (!boldApiKey) {
      boldApiKey = Deno.env.get('BOLD_API_KEY');
    }

    if (!boldApiKey) {
      return new Response(
        JSON.stringify({ error: "No se encontró la API key de Bold. Por favor configura las credenciales de Bold." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Bold API key (first 10 chars):", boldApiKey.substring(0, 10) + "...");
    console.log("Bold credentials source:", org?.bold_credentials ? "database" : "env");

    // Generate unique reference with timestamp to avoid duplicates
    const reference = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Expiration: 24 hours from now (in nanoseconds)
    const expirationDate = Date.now() * 1e6 + (24 * 60 * 60 * 1e9);

    console.log("Creating Bold payment link for:", customerEmail, "amount:", amount, "reference:", reference);

    // Bold API Link de Pagos - POST /online/link/v1
    // Docs: https://developers.bold.co/pagos-en-linea/api-link-de-pagos
    const paymentLinkData: any = {
      amount_type: "CLOSE",
      amount: {
        currency: "COP",
        total_amount: Math.round(amount),
        tip_amount: 0,
        taxes: [],
      },
      reference: reference,
      description: description.substring(0, 100),
      expiration_date: expirationDate,
      payer_email: customerEmail,
      payment_methods: ["CREDIT_CARD", "PSE", "NEQUI", "BOTON_BANCOLOMBIA"],
    };

    console.log("Bold request:", JSON.stringify(paymentLinkData));

    const boldResponse = await fetch("https://integrations.api.bold.co/online/link/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `x-api-key ${boldApiKey}`,
      },
      body: JSON.stringify(paymentLinkData),
    });

    if (!boldResponse.ok) {
      const errorText = await boldResponse.text();
      console.error("Bold API error:", boldResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Error al crear link de pago en Bold", details: errorText }),
        { status: boldResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const boldData = await boldResponse.json();
    console.log("Bold response:", JSON.stringify(boldData));

    // Response: { payload: { payment_link: "LNK_xxx", url: "https://checkout.bold.co/LNK_xxx" } }
    const paymentLinkId = boldData.payload?.payment_link || boldData.payment_link || boldData.id;
    const paymentUrl = boldData.payload?.url || boldData.url || `https://checkout.bold.co/${paymentLinkId}`;

    // Save pending order to database if order data is provided
    if (orderData) {
      const { error: insertError } = await supabase
        .from('pending_orders')
        .insert({
          organization_id: organizationId,
          conversation_id: conversationId || null,
          customer_phone: customerPhone,
          customer_name: customerName,
          customer_email: customerEmail,
          cedula: orderData.cedula || null,
          address: orderData.address,
          city: orderData.city,
          department: orderData.department,
          neighborhood: orderData.neighborhood || null,
          line_items: orderData.lineItems,
          notes: orderData.notes || null,
          shipping_cost: orderData.shippingCost || 0,
          total_amount: amount,
          bold_payment_link_id: paymentLinkId,
          bold_payment_url: paymentUrl,
          bold_reference: reference,
          status: 'pending_payment',
        });

      if (insertError) {
        console.error("Error saving pending order:", insertError);
        // Don't fail the request - the payment link was already created
      } else {
        console.log("Pending order saved with reference:", reference);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentLinkId: paymentLinkId,
        paymentUrl: paymentUrl,
        reference: reference,
        amount: amount,
        description: description,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error creating payment link:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
