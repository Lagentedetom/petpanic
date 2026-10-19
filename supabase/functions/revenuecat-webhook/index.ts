// PetPanic — RevenueCat webhook edge function
//
// Las compras de PetPanic Social hechas en la App Store o en Google Play llegan
// aquí a través de RevenueCat. Igual que el webhook de Stripe, es la ÚNICA vía
// que escribe subscription_status / current_period_end para esas compras: el
// cliente nunca toca esas columnas (RLS las protege).
//
// Despliegue: verify_jwt = false (RevenueCat no tiene JWT de Supabase). La
// autenticidad se comprueba con la cabecera Authorization que se configura en
// RevenueCat → Integrations → Webhooks.
//
// Variables de entorno:
//   REVENUECAT_WEBHOOK_AUTH   el valor exacto de la cabecera Authorization
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// En la app, RevenueCat se configura con appUserID = id del usuario de Supabase,
// así que event.app_user_id es directamente profiles.id.
//
// Las compras de sandbox (TestFlight, revisores de Apple, probadores de Google)
// también activan Social: sin eso, la revisión de Apple no podría comprobar la
// compra. Solo se registran como tal en los logs.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RcEvent = {
  id: string;
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  store?: string;
  environment?: "SANDBOX" | "PRODUCTION";
  expiration_at_ms?: number | null;
  transferred_from?: string[];
  transferred_to?: string[];
};

const ACTIVE = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
  // Cancelar solo apaga la renovación: el acceso sigue hasta expiration_at_ms.
  "CANCELLATION",
  // Fallo de cobro: la tienda reintenta durante el periodo de gracia.
  "BILLING_ISSUE",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sourceOf(store?: string): "app_store" | "play_store" | null {
  if (store === "APP_STORE" || store === "MAC_APP_STORE") return "app_store";
  if (store === "PLAY_STORE") return "play_store";
  return null;
}

function intervalOf(productId?: string): "month" | "year" | null {
  if (!productId) return null;
  if (/annual|year|anual/i.test(productId)) return "year";
  if (/month|mensual/i.test(productId)) return "month";
  return null;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const expected = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
  if (!expected || req.headers.get("authorization") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let event: RcEvent;
  try {
    const body = await req.json();
    event = body?.event;
    if (!event?.id || !event?.type) throw new Error("sin event.id / event.type");
  } catch (err) {
    return new Response(`Bad payload: ${err}`, { status: 400 });
  }

  if (event.type === "TEST") {
    console.log("[revenuecat-webhook] evento de prueba recibido");
    return Response.json({ received: true, test: true });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Idempotencia: si este id ya se procesó, no se hace nada.
  const { data: fresh, error: logError } = await admin
    .from("revenuecat_events")
    .upsert({ id: event.id, type: event.type, app_user_id: event.app_user_id ?? null }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (logError) {
    console.error("[revenuecat-webhook] no se pudo registrar el evento:", logError);
    return new Response("Log error", { status: 500 });
  }
  if (!fresh || fresh.length === 0) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    await apply(admin, event);
  } catch (err) {
    console.error(`[revenuecat-webhook] error con ${event.type}:`, err);
    // Se borra el registro para que el reintento de RevenueCat vuelva a entrar.
    await admin.from("revenuecat_events").delete().eq("id", event.id);
    return new Response(`Handler error: ${err}`, { status: 500 });
  }

  return Response.json({ received: true });
});

async function apply(admin: ReturnType<typeof createClient>, event: RcEvent) {
  if (event.environment === "SANDBOX") console.log("[revenuecat-webhook] sandbox:", event.type, event.app_user_id);

  if (event.type === "TRANSFER") {
    // Una compra pasa de una cuenta a otra (p. ej. «Restaurar compras» con
    // otro usuario). Quien la pierde se queda sin Social; quien la recibe la
    // activará con el siguiente evento de RevenueCat.
    for (const from of event.transferred_from ?? []) {
      if (UUID.test(from)) await expire(admin, from);
    }
    return;
  }

  const userId = event.app_user_id;
  if (!userId || !UUID.test(userId)) {
    // IDs anónimos de RevenueCat ($RCAnonymousID…): no hay usuario que tocar.
    console.warn("[revenuecat-webhook] app_user_id no es un usuario de Supabase:", userId);
    return;
  }

  if (event.type === "EXPIRATION") {
    await expire(admin, userId);
    return;
  }

  if (!ACTIVE.has(event.type)) {
    console.log("[revenuecat-webhook] evento ignorado:", event.type);
    return;
  }

  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
  const { error } = await admin
    .from("profiles")
    .update({
      subscription_tier: "social",
      subscription_status: "active",
      current_period_end: expiresAt,
      subscription_interval: intervalOf(event.product_id),
      billing_source: sourceOf(event.store),
      store_product_id: event.product_id ?? null,
      trial_ends_at: null,
    })
    .eq("id", userId);
  if (error) throw error;
}

async function expire(admin: ReturnType<typeof createClient>, userId: string) {
  const { error } = await admin
    .from("profiles")
    .update({
      subscription_status: "expired",
      current_period_end: null,
      subscription_interval: null,
      store_product_id: null,
    })
    .eq("id", userId)
    // No pisar a quien se ha pasado a pagar por la web mientras tanto.
    .or("billing_source.is.null,billing_source.neq.stripe");
  if (error) throw error;
}
