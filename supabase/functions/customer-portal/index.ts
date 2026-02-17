import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

type CustomerPortalAction = "portal" | "summary";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

function resolveAction(body: Record<string, unknown>): CustomerPortalAction {
  return body.action === "summary" ? "summary" : "portal";
}

function asExpandedPaymentMethod(
  value: string | Stripe.PaymentMethod | null | undefined
): Stripe.PaymentMethod | null {
  if (!value || typeof value === "string") return null;
  return value;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    let requestBody: Record<string, unknown> = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === "object") {
        requestBody = parsed as Record<string, unknown>;
      }
    } catch {
      requestBody = {};
    }
    const action = resolveAction(requestBody);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Create Supabase client using the service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get customer from Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
    }
    const customerId = customers.data[0].id;
    const customer = customers.data[0];
    logStep("Found Stripe customer", { customerId });

    if (action === "summary") {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
        expand: ["data.default_payment_method"],
      });

      const activeStatuses = ["active", "trialing", "past_due", "incomplete", "unpaid"];
      const currentSubscription =
        subscriptions.data.find((sub) => activeStatuses.includes(sub.status)) ??
        subscriptions.data[0] ??
        null;

      const paymentMethod =
        asExpandedPaymentMethod(currentSubscription?.default_payment_method) ??
        asExpandedPaymentMethod(customer.invoice_settings?.default_payment_method);

      let upcomingInvoice: Stripe.Invoice | null = null;
      try {
        const upcoming = await stripe.invoices.retrieveUpcoming({ customer: customerId });
        upcomingInvoice = upcoming as Stripe.Invoice;
      } catch {
        upcomingInvoice = null;
      }

      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit: 12,
      });

      const summary = {
        customerId,
        subscription: currentSubscription
          ? {
              id: currentSubscription.id,
              status: currentSubscription.status,
              current_period_start: currentSubscription.current_period_start,
              current_period_end: currentSubscription.current_period_end,
              cancel_at_period_end: currentSubscription.cancel_at_period_end,
              currency: currentSubscription.currency,
              plan_name:
                currentSubscription.items.data[0]?.price?.nickname ??
                currentSubscription.items.data[0]?.price?.id ??
                null,
            }
          : null,
        upcoming_invoice: upcomingInvoice
          ? {
              amount_due: upcomingInvoice.amount_due ?? 0,
              amount_remaining: upcomingInvoice.amount_remaining ?? 0,
              currency: upcomingInvoice.currency ?? "usd",
              next_payment_attempt: upcomingInvoice.next_payment_attempt ?? null,
            }
          : null,
        payment_method: paymentMethod
          ? {
              type: paymentMethod.type ?? null,
              card_brand: paymentMethod.card?.brand ?? null,
              card_last4: paymentMethod.card?.last4 ?? null,
              card_exp_month: paymentMethod.card?.exp_month ?? null,
              card_exp_year: paymentMethod.card?.exp_year ?? null,
            }
          : null,
        invoices: invoices.data.map((inv) => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          amount_due: inv.amount_due,
          amount_paid: inv.amount_paid,
          total: inv.total,
          currency: inv.currency,
          created: inv.created,
          hosted_invoice_url: inv.hosted_invoice_url,
          invoice_pdf: inv.invoice_pdf,
        })),
      };

      logStep("Billing summary generated", {
        hasSubscription: !!summary.subscription,
        invoiceCount: summary.invoices.length,
      });

      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create customer portal session
    const origin = req.headers.get("origin") || "https://sewdle.lovable.app";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings/billing`,
    });
    
    logStep("Customer portal session created", { 
      sessionId: portalSession.id, 
      url: portalSession.url 
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in customer-portal", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
