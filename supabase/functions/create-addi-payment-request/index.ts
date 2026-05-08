import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildAddiPayLinkPayload,
  createAddiPayLink,
  getAddiCredentials,
  splitCustomerName,
} from "../_shared/addi.ts";
import type { AddiPaymentRequest } from "../_shared/elsa-commerce.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function envRecord(): Record<string, string | undefined> {
  return {
    ADDI_CLIENT_ID: Deno.env.get("ADDI_CLIENT_ID"),
    ADDI_CLIENT_SECRET: Deno.env.get("ADDI_CLIENT_SECRET"),
    ADDI_ALLY_SLUG: Deno.env.get("ADDI_ALLY_SLUG"),
    ADDI_STORE_ID: Deno.env.get("ADDI_STORE_ID"),
    ADDI_CALLBACK_USERNAME: Deno.env.get("ADDI_CALLBACK_USERNAME"),
    ADDI_CALLBACK_PASSWORD: Deno.env.get("ADDI_CALLBACK_PASSWORD"),
    ADDI_ENVIRONMENT: Deno.env.get("ADDI_ENVIRONMENT"),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as AddiPaymentRequest;
    const {
      amount,
      customerEmail,
      customerName,
      customerPhone,
      customerCedula,
      description,
      organizationId,
      conversationId,
      orderData,
    } = body;

    if (
      !amount || !customerEmail || !customerName || !customerCedula ||
      !organizationId || !orderData
    ) {
      return jsonResponse({
        error:
          "Monto, cliente, cédula, organizationId y orderData son requeridos para Addi",
      }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: org } = await supabase
      .from("organizations")
      .select("addi_credentials")
      .eq("id", organizationId)
      .maybeSingle();

    const credentials = getAddiCredentials({
      orgCredentials: org?.addi_credentials as
        | Record<string, unknown>
        | undefined,
      env: envRecord(),
    });

    if (!credentials.clientId || !credentials.clientSecret) {
      return jsonResponse({
        error:
          "No se encontraron credenciales de Addi. Configura ADDI_CLIENT_ID y ADDI_CLIENT_SECRET o organizations.addi_credentials.",
      }, 400);
    }

    const callbackUrl = Deno.env.get("ADDI_CALLBACK_URL") ||
      `${
        (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "")
      }/functions/v1/addi-payment-webhook`;
    if (!callbackUrl.startsWith("https://")) {
      return jsonResponse({
        error: "ADDI_CALLBACK_URL debe ser una URL HTTPS pública.",
      }, 400);
    }

    const orderId = `addi_${Date.now()}_${
      Math.random().toString(36).slice(2, 8)
    }`;
    const name = splitCustomerName(customerName);
    const addiPayload = buildAddiPayLinkPayload({
      orderId,
      totalAmount: amount,
      shippingAmount: orderData.shippingCost || 0,
      description,
      client: {
        idNumber: customerCedula,
        firstName: name.firstName,
        lastName: name.lastName,
        email: customerEmail,
        cellphone: customerPhone,
        address: orderData.address,
        city: orderData.city,
        state: orderData.department,
        complement: orderData.neighborhood,
      },
      lineItems: orderData.lineItems.map((item) => ({
        sku: item.sku,
        name: `${item.productName} ${item.variantName || ""}`.trim(),
        amount: Math.round(
          (amount - (orderData.shippingCost || 0)) /
            Math.max(1, orderData.lineItems.length),
        ),
        category: "moda infantil",
      })),
      ally: {
        storeId: credentials.storeId,
        callbackUrl,
        callbackRequired: true,
      },
    });

    console.log(
      "Creating Addi payment request",
      JSON.stringify({
        orderId,
        amount,
        organizationId,
        conversationId: conversationId || null,
        environment: credentials.environment,
        storeId_present: Boolean(credentials.storeId),
        allySlug_present: Boolean(credentials.allySlug),
      }),
    );

    const addiResponse = await createAddiPayLink({
      credentials,
      payload: addiPayload,
    });

    if (!addiResponse.applicationId) {
      return jsonResponse({
        error: "Addi no devolvió applicationId",
      }, 502);
    }

    const pendingOrderBase = {
      organization_id: organizationId,
      conversation_id: conversationId || null,
      customer_phone: customerPhone,
      customer_name: customerName,
      customer_email: customerEmail,
      cedula: customerCedula,
      address: orderData.address,
      city: orderData.city,
      department: orderData.department,
      neighborhood: orderData.neighborhood || null,
      line_items: orderData.lineItems,
      notes: orderData.notes || null,
      shipping_cost: orderData.shippingCost || 0,
      total_amount: amount,
      status: "pending_payment",
    };

    const { error: insertError } = await supabase.from("pending_orders").insert(
      {
        ...pendingOrderBase,
        payment_provider: "addi",
        addi_order_id: orderId,
        addi_application_id: addiResponse.applicationId,
        addi_payment_url: addiResponse.paymentUrl || null,
        addi_status: "PENDING",
      },
    );

    if (insertError) {
      console.warn(
        "Addi pending order insert with Addi columns failed; retrying legacy columns",
        insertError.message,
      );
      const { error: legacyInsertError } = await supabase.from("pending_orders")
        .insert({
          ...pendingOrderBase,
          bold_payment_link_id: addiResponse.applicationId,
          bold_payment_url: addiResponse.paymentUrl || null,
          bold_reference: orderId,
          notes: `${
            orderData.notes || ""
          } | Addi application ${addiResponse.applicationId}`
            .trim(),
        });
      if (legacyInsertError) {
        console.error(
          "Error saving Addi pending order",
          legacyInsertError.message,
        );
      }
    }

    return jsonResponse({
      success: true,
      orderId,
      applicationId: addiResponse.applicationId,
      paymentUrl: addiResponse.paymentUrl,
      amount,
    });
  } catch (error) {
    console.error(
      "Error creating Addi payment request",
      error instanceof Error ? error.message : error,
    );
    return jsonResponse({
      error: error instanceof Error
        ? error.message
        : "Error desconocido creando solicitud Addi",
    }, 500);
  }
});
