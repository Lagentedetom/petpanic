// PetPanic — Stripe Checkout edge function
//
// Authenticated endpoint. Body: { interval: 'month' | 'year' }.
// Creates (or reuses) a Stripe Customer for the user, then creates a Checkout
// Session for the requested plan. Returns { url }.
//
// Env vars required (set via `supabase secrets`):
//   STRIPE_SECRET_KEY        sk_live_... or sk_test_...
//   STRIPE_PRICE_MONTHLY     price_xxx  (recurring monthly price)
//   STRIPE_PRICE_ANNUAL      price_xxx  (recurring yearly price)
//   APP_URL                  https://app.petpanic.es  (no trailing slash)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
    const STRIPE_PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_MONTHLY")!;
    const STRIPE_PRICE_ANNUAL = Deno.env.get("STRIPE_PRICE_ANNUAL")!;
    const APP_URL = Deno.env.get("APP_URL") || "https://app.petpanic.es";

    // 1. Verify the caller is a real authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "No autorizado" });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !user) return json(401, { error: "No autorizado" });

    // 2. Parse body
    const body = await req.json().catch(() => ({}));
    const interval = body.interval as "month" | "year" | undefined;
    if (interval !== "month" && interval !== "year") {
      return json(400, { error: "interval debe ser 'month' o 'year'" });
    }
    const priceId = interval === "month" ? STRIPE_PRICE_MONTHLY : STRIPE_PRICE_ANNUAL;

    // 3. Look up the user's profile (admin client because we'll write to it)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile, error: profErr } = await adminClient
      .from("profiles")
      .select("id, email, display_name, stripe_customer_id, subscription_status")
      .eq("id", user.id)
      .single();

    if (profErr || !profile) return json(500, { error: "Profile not found" });

    // 4. Create Stripe instance
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 5. Create or reuse the Stripe Customer
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email || user.email || undefined,
        name: profile.display_name || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await adminClient
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // 6. Create the Checkout Session
    //    - subscription mode (recurring billing)
    //    - automatic_tax for Spanish VAT (must be enabled in Stripe dashboard)
    //    - locale=es so the Stripe-hosted page is in Spanish
    //    - allow_promotion_codes lets you do launch promos without changing prices
    //    - billing_address_collection auto so EU regulations are satisfied
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      locale: "es",
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      billing_address_collection: "auto",
      success_url: `${APP_URL}/plan?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/plan?stripe=cancel`,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });

    return json(200, { url: session.url, session_id: session.id });
  } catch (err) {
    console.error("[stripe-checkout] error:", err);
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
});
