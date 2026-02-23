import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentLinkRequest {
  amount: number;
  description: string;
  customerEmail: string;
  customerName?: string;
  orderId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { amount, description, customerEmail, customerName, orderId } = body as PaymentLinkRequest;

    if (!amount || !customerEmail) {
      return new Response(
        JSON.stringify({ error: "Monto y correo del cliente son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Bold API key from organizations
    // First try to get from request body (organizationId)
    const organizationId = body.organizationId;
    let boldApiKey = null;
    
    if (organizationId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('bold_credentials')
        .eq('id', organizationId)
        .single();
      
      if (org?.bold_credentials) {
        const creds = org.bold_credentials as any;
        boldApiKey = creds.api_key || creds.apiKey;
      }
    }

    // Fallback: try to get from secrets
    if (!boldApiKey) {
      boldApiKey = Deno.env.get('BOLD_API_KEY');
    }

    if (!boldApiKey) {
      return new Response(
        JSON.stringify({ error: "No se encontró la API key de Bold. Por favor configura las credenciales de Bold." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating Bold payment link for:", customerEmail, "amount:", amount);

    // Calculate taxes (IVA 19% for Colombia)
    const subtotal = Math.round(amount / 1.19);
    const tax = amount - subtotal;

    // Create payment link request
    const paymentLinkData = {
      amount_type: "CLOSE",
      amount: {
        currency: "COP",
        subtotal: subtotal,
        taxes: [
          {
            type: "VAT",
            base: subtotal,
            value: tax
          }
        ],
        total_amount: amount
      },
      description: description.substring(0, 100),
      payer_email: customerEmail,
      // Optional: limit payment methods
      // payment_methods: ["CREDIT_CARD", "PSE", "NEQUI", "BANCOLOMBIA_TRANSFER"]
    };

    console.log("Bold request:", JSON.stringify(paymentLinkData));

    const boldResponse = await fetch("https://integrations.api.bold.co/online/link/v1", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${boldApiKey}`,
        "Content-Type": "application/json",
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

    // The response contains the payment link
    const paymentLinkId = boldData.id || boldData.payment_link;
    const paymentUrl = boldData.url || `https://pay.bold.co/${paymentLinkId}`;

    // If we have an orderId, save the payment link to the database
    if (orderId && organizationId) {
      await supabase
        .from('orders')
        .update({
          payment_link: paymentUrl,
          payment_link_id: String(paymentLinkId)
        })
        .eq('shopify_order_id', orderId)
        .eq('organization_id', organizationId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentLinkId: paymentLinkId,
        paymentUrl: paymentUrl,
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
