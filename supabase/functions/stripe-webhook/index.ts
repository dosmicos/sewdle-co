import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Create Supabase client using the service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify webhook signature
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No signature found");

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    logStep("Webhook verified", { eventType: event.type, eventId: event.id });

    // Log webhook event
    await supabaseClient.from('stripe_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      processed: false,
      data: event.data,
    });

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing subscription event", { 
          subscriptionId: subscription.id, 
          customerId: subscription.customer,
          status: subscription.status 
        });

        // Get customer details
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if (!customer || customer.deleted) {
          throw new Error("Customer not found");
        }

        const userId = subscription.metadata?.userId;
        if (!userId) {
          throw new Error("User ID not found in subscription metadata");
        }

        // Get plan details
        const planId = subscription.metadata?.planId;
        if (!planId) {
          throw new Error("Plan ID not found in subscription metadata");
        }

        const { data: planData } = await supabaseClient
          .from('subscription_plans')
          .select('*')
          .eq('id', planId)
          .single();

        if (!planData) {
          throw new Error("Plan not found");
        }

        // Get user's organization
        const { data: orgUser } = await supabaseClient
          .from('organization_users')
          .select('organization_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single();

        if (!orgUser) {
          throw new Error("User organization not found");
        }

        // Update or create organization subscription
        const subscriptionData = {
          organization_id: orgUser.organization_id,
          subscription_plan_id: planId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        };

        const { error: upsertError } = await supabaseClient
          .from('organization_subscriptions')
          .upsert(subscriptionData, {
            onConflict: 'stripe_subscription_id'
          });

        if (upsertError) {
          throw new Error(`Failed to upsert subscription: ${upsertError.message}`);
        }

        // Update organization plan limits based on subscription
        const { error: orgUpdateError } = await supabaseClient
          .from('organizations')
          .update({
            plan: planData.name.toLowerCase(),
            max_users: planData.max_users,
            max_orders_per_month: planData.max_orders_per_month,
            max_workshops: planData.max_workshops,
          })
          .eq('id', orgUser.organization_id);

        if (orgUpdateError) {
          throw new Error(`Failed to update organization: ${orgUpdateError.message}`);
        }

        logStep("Subscription processed successfully");
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing subscription deletion", { subscriptionId: subscription.id });

        // Update subscription status
        const { error: updateError } = await supabaseClient
          .from('organization_subscriptions')
          .update({ 
            status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);

        if (updateError) {
          throw new Error(`Failed to cancel subscription: ${updateError.message}`);
        }

        // Get organization and reset to starter plan
        const { data: orgSubscription } = await supabaseClient
          .from('organization_subscriptions')
          .select('organization_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (orgSubscription) {
          const { error: orgUpdateError } = await supabaseClient
            .from('organizations')
            .update({
              plan: 'starter',
              max_users: 3,
              max_orders_per_month: 10,
              max_workshops: 5,
            })
            .eq('id', orgSubscription.organization_id);

          if (orgUpdateError) {
            throw new Error(`Failed to reset organization plan: ${orgUpdateError.message}`);
          }
        }

        logStep("Subscription cancellation processed successfully");
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing successful payment", { invoiceId: invoice.id });

        if (invoice.subscription) {
          // Create invoice record
          const { error: invoiceError } = await supabaseClient
            .from('invoices')
            .insert({
              stripe_invoice_id: invoice.id,
              stripe_subscription_id: invoice.subscription as string,
              amount: invoice.amount_paid / 100, // Convert from cents
              currency: invoice.currency,
              status: 'paid',
              invoice_date: new Date(invoice.created * 1000).toISOString(),
              due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
              invoice_url: invoice.hosted_invoice_url,
              invoice_pdf: invoice.invoice_pdf,
            });

          if (invoiceError) {
            logStep("Failed to create invoice record", { error: invoiceError.message });
          } else {
            logStep("Invoice record created successfully");
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing failed payment", { invoiceId: invoice.id });

        // Create failed invoice record
        const { error: invoiceError } = await supabaseClient
          .from('invoices')
          .insert({
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: invoice.subscription as string,
            amount: invoice.amount_due / 100,
            currency: invoice.currency,
            status: 'failed',
            invoice_date: new Date(invoice.created * 1000).toISOString(),
            due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
            invoice_url: invoice.hosted_invoice_url,
          });

        if (invoiceError) {
          logStep("Failed to create failed invoice record", { error: invoiceError.message });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { eventType: event.type });
    }

    // Mark webhook as processed
    await supabaseClient
      .from('stripe_webhook_events')
      .update({ processed: true })
      .eq('event_id', event.id);

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});