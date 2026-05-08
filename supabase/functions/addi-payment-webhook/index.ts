import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getAddiCredentials,
  parseAddiCallbackAuthorization,
} from "../_shared/addi.ts";

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
    ADDI_CALLBACK_USERNAME: Deno.env.get("ADDI_CALLBACK_USERNAME"),
    ADDI_CALLBACK_PASSWORD: Deno.env.get("ADDI_CALLBACK_PASSWORD"),
    ADDI_CLIENT_ID: Deno.env.get("ADDI_CLIENT_ID"),
    ADDI_CLIENT_SECRET: Deno.env.get("ADDI_CLIENT_SECRET"),
    ADDI_STORE_ID: Deno.env.get("ADDI_STORE_ID"),
    ADDI_ALLY_SLUG: Deno.env.get("ADDI_ALLY_SLUG"),
    ADDI_ENVIRONMENT: Deno.env.get("ADDI_ENVIRONMENT"),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let callbackBody: Record<string, unknown> = {};
  try {
    callbackBody = await req.json();
    const orderId = String(callbackBody.orderId || "");
    const status = String(callbackBody.status || "").toUpperCase();
    const approvedAmount = Number(callbackBody.approvedAmount || 0);

    if (!orderId) return jsonResponse({ error: "orderId es requerido" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let { data: pendingOrder, error: lookupError } = await supabase
      .from("pending_orders")
      .select("*")
      .eq("addi_order_id", orderId)
      .maybeSingle();

    if (lookupError || !pendingOrder) {
      const legacyLookup = await supabase
        .from("pending_orders")
        .select("*")
        .eq("bold_reference", orderId)
        .maybeSingle();
      pendingOrder = legacyLookup.data;
      lookupError = legacyLookup.error;
    }

    if (lookupError || !pendingOrder) {
      console.error(
        "Addi callback pending order not found",
        orderId,
        lookupError?.message || "",
      );
      return jsonResponse({ error: "pending order not found" }, 404);
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("addi_credentials")
      .eq("id", pendingOrder.organization_id)
      .maybeSingle();
    const credentials = getAddiCredentials({
      orgCredentials: org?.addi_credentials as
        | Record<string, unknown>
        | undefined,
      env: envRecord(),
    });

    if (credentials.callbackUsername || credentials.callbackPassword) {
      const authorized = parseAddiCallbackAuthorization(
        req.headers.get("authorization"),
        credentials.callbackUsername || "",
        credentials.callbackPassword || "",
      );
      if (!authorized) return jsonResponse({ error: "unauthorized" }, 401);
    }

    const nextPendingStatus = status !== "APPROVED"
      ? `addi_${status.toLowerCase()}`
      : "paid";
    const paidAt = status === "APPROVED" ? new Date().toISOString() : undefined;
    const fullUpdate = await supabase.from("pending_orders").update({
      addi_status: status,
      addi_callback_payload: callbackBody,
      updated_at: new Date().toISOString(),
      ...(paidAt ? { paid_at: paidAt } : {}),
      status: nextPendingStatus,
    }).eq("id", pendingOrder.id);

    if (fullUpdate.error) {
      // Legacy fallback for production before the Addi migration is applied.
      // Do not include paid_at here because older pending_orders schemas do not
      // have that column.
      await supabase.from("pending_orders").update({
        updated_at: new Date().toISOString(),
        status: nextPendingStatus,
      }).eq("id", pendingOrder.id);
    }

    if (status !== "APPROVED") {
      return jsonResponse(callbackBody);
    }

    const expectedAmount = Number(pendingOrder.total_amount || 0);
    if (approvedAmount !== expectedAmount) {
      console.error(
        "Addi approved amount mismatch",
        JSON.stringify({
          orderId,
          expectedAmount,
          approvedAmount,
        }),
      );
      await supabase.from("pending_orders").update({
        status: "addi_amount_mismatch",
        updated_at: new Date().toISOString(),
      }).eq("id", pendingOrder.id);
      return jsonResponse(callbackBody);
    }

    const orderData = {
      customerName: pendingOrder.customer_name,
      cedula: pendingOrder.cedula,
      email: pendingOrder.customer_email,
      phone: pendingOrder.customer_phone,
      address: pendingOrder.address,
      city: pendingOrder.city,
      department: pendingOrder.department,
      neighborhood: pendingOrder.neighborhood || "",
      lineItems: pendingOrder.line_items,
      notes: `${pendingOrder.notes || ""} | Pago aprobado via Addi (app: ${
        callbackBody.applicationId || pendingOrder.addi_application_id ||
        pendingOrder.bold_payment_link_id
      })`.trim(),
      shippingCost: Number(pendingOrder.shipping_cost || 0),
      paymentMethod: "addi",
    };

    const { data: orderResult, error: orderError } = await supabase.functions
      .invoke(
        "create-shopify-order",
        {
          body: {
            orderData,
            organizationId: pendingOrder.organization_id,
          },
        },
      );

    if (orderError || !orderResult?.success) {
      console.error(
        "Addi Shopify order creation failed",
        orderError?.message || JSON.stringify(orderResult || {}),
      );
      await supabase.from("pending_orders").update({
        status: "creation_failed",
        updated_at: new Date().toISOString(),
      }).eq("id", pendingOrder.id);
      return jsonResponse(callbackBody);
    }

    await supabase.from("pending_orders").update({
      status: "order_created",
      shopify_order_id: String(orderResult.orderId || ""),
      shopify_order_number: String(orderResult.orderNumber || ""),
      updated_at: new Date().toISOString(),
    }).eq("id", pendingOrder.id);

    return jsonResponse(callbackBody);
  } catch (error) {
    console.error(
      "Addi callback error",
      error instanceof Error ? error.message : error,
    );
    return jsonResponse({ error: "Error procesando callback Addi" }, 500);
  }
});
