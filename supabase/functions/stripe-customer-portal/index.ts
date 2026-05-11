// PetPanic — Stripe Customer Portal edge function
//
// Authenticated endpoint. Returns a URL to the Stripe-hosted Customer Portal
// where the user can:
//   - Cancel their subscription (cancels at period end by default)
//   - Update payment method
//   - Switch between monthly and annual
//   - Download invoices
//
// Configure what's allowed in: Stripe dashboard → Settings → Billing → Customer
// portal. Recommended: enable cancellation, payment-method update, plan-switch
// between the two prices, and invoice history.
//
// Env vars: STRIPE_SECRET_KEY, APP_URL, SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY.

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
    const APP_URL = Deno.env.get("APP_URL") || "https://app.petpanic.es";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "No autorizado" });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !user) return json(401, { error: "No autorizado" });

    // Look up the user's stripe_customer_id
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return json(400, { error: "No tienes una suscripción activa para gestionar" });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${APP_URL}/plan`,
      locale: "es",
    });

    return json(200, { url: session.url });
  } catch (err) {
    console.error("[stripe-customer-portal] error:", err);
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
});
