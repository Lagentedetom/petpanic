// PetPanic — Stripe webhook edge function
//
// Public endpoint (no JWT — Stripe doesn't send one). Authenticity is verified
// via Stripe's signature header. The webhook is the SINGLE source of truth for
// flipping `subscription_status` to 'active' / 'canceled' / 'expired'. Never
// trust the client to update those columns (RLS revokes that anyway).
//
// IMPORTANT: this function must be deployed with verify_jwt=false because
// Stripe doesn't have a Supabase JWT to send.
//
// Subscribed events (configure in Stripe dashboard → Developers → Webhooks):
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted
//   invoice.payment_succeeded   (for receipt logs / future)
//   invoice.payment_failed       (logged; Stripe handles retry/dunning)
//
// Env vars:
//   STRIPE_SECRET_KEY        sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET    whsec_... (from the webhook endpoint settings)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-12-18.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const rawBody = await req.text();

  // Verify signature — async because we use Web Crypto in Deno.
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[stripe-webhook] bad signature:", err);
    return new Response(`Bad signature: ${err}`, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(admin, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await markCanceled(admin, sub);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // The subscription.updated event covers state. Just log.
        console.log("[stripe-webhook] payment_succeeded for", invoice.customer);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // Stripe will retry/dun; subscription.updated will eventually flip
        // status to past_due/unpaid/canceled. Just log here.
        console.warn("[stripe-webhook] payment_failed for", invoice.customer);
        break;
      }
      default:
        // Ignore other events.
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler error for ${event.type}:`, err);
    // Return 500 so Stripe retries.
    return new Response(`Handler error: ${err}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function syncSubscription(
  admin: ReturnType<typeof createClient>,
  sub: Stripe.Subscription
) {
  // Find the user by stripe_customer_id (set during checkout) OR by metadata
  // (we set it on the subscription too, as a fallback).
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const supabaseUserId = sub.metadata?.supabase_user_id || null;

  // Map Stripe status to our enum.
  // active, trialing, past_due, unpaid, canceled, incomplete, incomplete_expired
  let ourStatus: "active" | "canceled" | "expired" | "trialing";
  switch (sub.status) {
    case "active":
      ourStatus = "active";
      break;
    case "trialing":
      ourStatus = "trialing";
      break;
    case "past_due":
    case "unpaid":
    case "incomplete":
      // Treat as active for now — Stripe is retrying. They keep access.
      ourStatus = "active";
      break;
    case "canceled":
    case "incomplete_expired":
      ourStatus = "canceled";
      break;
    default:
      ourStatus = "expired";
  }

  // Determine billing interval from the first item.
  const item = sub.items?.data?.[0];
  const interval = item?.price?.recurring?.interval as "month" | "year" | undefined;

  // Determine current_period_end (exists on individual items in newer API versions
  // but the top-level field still works on the subscription itself).
  const periodEnd = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  const currentPeriodEnd = periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : null;

  const update: Record<string, unknown> = {
    subscription_tier: "social",
    subscription_status: ourStatus,
    stripe_subscription_id: sub.id,
    current_period_end: currentPeriodEnd,
    subscription_interval: interval ?? null,
  };

  // If our user is going from trialing to active for the first time, also
  // null out trial_ends_at so the trial banner disappears cleanly.
  if (ourStatus === "active") {
    update.trial_ends_at = null;
  }

  // Prefer matching by metadata.supabase_user_id (most reliable for the very
  // first webhook, before stripe_customer_id is even saved). Fall back to
  // stripe_customer_id for subsequent events.
  if (supabaseUserId) {
    await admin.from("profiles").update(update).eq("id", supabaseUserId);
  } else {
    await admin.from("profiles").update(update).eq("stripe_customer_id", customerId);
  }
}

async function markCanceled(
  admin: ReturnType<typeof createClient>,
  sub: Stripe.Subscription
) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const supabaseUserId = sub.metadata?.supabase_user_id || null;

  // After a subscription is fully deleted (not just canceled at period end),
  // the user goes back to expired. They keep their account but lose Social.
  const update = {
    subscription_status: "expired" as const,
    stripe_subscription_id: null,
    current_period_end: null,
    subscription_interval: null,
  };

  if (supabaseUserId) {
    await admin.from("profiles").update(update).eq("id", supabaseUserId);
  } else {
    await admin.from("profiles").update(update).eq("stripe_customer_id", customerId);
  }
}
