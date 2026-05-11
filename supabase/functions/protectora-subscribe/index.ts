// PetPanic — Edge function: protectora-subscribe
//
// Public endpoint (verify_jwt=false). Body:
//   {
//     nombre: string,
//     email: string,
//     cp_base: string,
//     radio_km?: number,
//     opt_in_perdidos?: boolean,
//     opt_in_encontrados?: boolean,
//     opt_in_overflow_50km?: boolean,
//     digest_diario?: boolean
//   }
//
// Flow:
//   1. Validate body shape
//   2. Call subscribe_protectora() RPC (validates business rules + inserts)
//   3. Send double-opt-in email via Resend with confirm URL
//   4. Return { ok: true } so the form can show "revisa tu correo" message
//
// We deliberately return ok:true even if Resend fails — the row is in BD,
// and the user can re-trigger the email by submitting the form again. But
// we log the Resend error for observability.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { confirmEmail, resendSend } from "../_shared/protectoras-emails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const nombre = typeof body.nombre === "string" ? body.nombre : "";
  const email = typeof body.email === "string" ? body.email : "";
  const cp_base = typeof body.cp_base === "string" ? body.cp_base : "";
  const radio_km = typeof body.radio_km === "number" ? body.radio_km : 25;
  const opt_in_perdidos = body.opt_in_perdidos !== false;
  const opt_in_encontrados = body.opt_in_encontrados !== false;
  const opt_in_overflow_50km = body.opt_in_overflow_50km === true;
  const digest_diario = body.digest_diario === true;

  // ---------- call RPC ----------
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(url, serviceKey);

  const { data, error } = await client.rpc("subscribe_protectora", {
    p_nombre: nombre,
    p_email: email,
    p_cp_base: cp_base,
    p_radio_km: radio_km,
    p_opt_in_perdidos: opt_in_perdidos,
    p_opt_in_encontrados: opt_in_encontrados,
    p_opt_in_overflow_50km: opt_in_overflow_50km,
    p_digest_diario: digest_diario,
  });

  if (error) {
    console.error("subscribe_protectora RPC failed:", error);
    return json({ ok: false, error: "rpc_failed" }, 500);
  }
  if (!data?.ok) {
    return json({ ok: false, error: data?.error ?? "unknown" }, 400);
  }

  // ---------- send confirmation email ----------
  const appUrl = Deno.env.get("APP_URL") || "https://app.petpanic.es";
  const confirmUrl = `${appUrl}/protectoras/confirmar?t=${encodeURIComponent(data.token)}`;
  const { subject, html, text } = confirmEmail({
    nombre,
    cp: data.cp,
    city: data.city,
    province: data.province,
    confirmUrl,
    radioKm: radio_km,
  });
  const send = await resendSend({ to: data.email, subject, html, text });
  if (!send.ok) {
    // Row already in BD with active=false. User can re-submit the form to
    // get a fresh token + fresh email. Log for observability.
    console.error("Resend send failed (subscribe):", send.error);
  }

  return json({ ok: true, city: data.city, province: data.province });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
