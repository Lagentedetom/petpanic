// PetPanic — Edge function: notify-protectoras
//
// Invoked by a Supabase Database Webhook on the `alerts` table for INSERT
// and UPDATE events. Sends email to matched protector_subscribers via Resend.
//
// Webhook payload shape (Supabase):
//   { type: 'INSERT' | 'UPDATE' | 'DELETE',
//     table: 'alerts',
//     record: { ... new row ... },
//     old_record: { ... previous row ... } | null }
//
// Routing logic:
//   - INSERT with record.status === 'active'      -> "Perro perdido" email
//   - UPDATE where status changed active->resolved -> "Perro encontrado" email
//   - Otherwise                                    -> skip
//
// Species filter (v1):
//   Only sends for dogs. Joins pets table on record.pet_id to read species.
//   Protectoras subscribed only care about dogs in this iteration. When
//   protectoras for cats arrive, expand by adding an opt-in column on
//   protector_subscribers.
//
// Resend delivery:
//   Subscribers with digest_diario=true are NOT sent here — they go into a
//   pending_digest table that a separate cron consolidates. (Cron is out of
//   scope for v1; digest flag is wired but the cron will land in v2.)
//   For now: send to everyone except digest_diario.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lostAlertEmail, resolvedAlertEmail, resendSend } from "../_shared/protectoras-emails.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: {
    type: "INSERT" | "UPDATE" | "DELETE";
    table: string;
    record: Record<string, unknown> | null;
    old_record: Record<string, unknown> | null;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ skipped: true, reason: "invalid_json" }, 400);
  }

  // -------- routing --------
  const type = payload.type;
  const record = payload.record;
  const oldRecord = payload.old_record;

  if (!record) return json({ skipped: true, reason: "no_record" });

  const isLost =
    type === "INSERT" && record.status === "active";
  const isFound =
    type === "UPDATE" &&
    oldRecord?.status === "active" &&
    record.status === "resolved";

  if (!isLost && !isFound) {
    return json({ skipped: true, reason: "not_relevant" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const APP_URL = Deno.env.get("APP_URL") || "https://app.petpanic.es";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // -------- species filter (only dogs for v1) --------
  const petId = record.pet_id as string;
  const { data: pet, error: petErr } = await supabase
    .from("pets")
    .select("species")
    .eq("id", petId)
    .maybeSingle();
  if (petErr) {
    console.error("pet lookup failed", petErr);
    return json({ error: "pet_lookup_failed" }, 500);
  }
  if (!pet || pet.species !== "perro") {
    return json({ skipped: true, reason: "not_a_dog" });
  }

  // -------- find matching subscribers --------
  const lat = Number(record.lat);
  const lng = Number(record.lng);
  const { data: matches, error: matchErr } = await supabase.rpc(
    "match_protectoras_for_alert",
    {
      p_alert_lat: lat,
      p_alert_lon: lng,
      p_is_resolved: isFound,
    },
  );
  if (matchErr) {
    console.error("match_protectoras_for_alert failed", matchErr);
    return json({ error: "match_failed" }, 500);
  }

  // Skip subscribers in digest_diario mode (handled by cron in v2).
  const targets = (matches || []).filter(
    (m: { digest_diario: boolean }) => !m.digest_diario,
  );

  if (targets.length === 0) {
    return json({ sent: 0, total_matched: matches?.length || 0 });
  }

  // -------- build URLs --------
  // The alert detail page exists already and is reachable from the SPA shell.
  // The "tengo info" report URL is a public-token-based form (route to be
  // added in the SPA — for now we point to the alert detail page, which
  // exposes contact_info on active alerts).
  const alertUrl = `${APP_URL}/alerts/${record.id}`;
  const reportUrl = alertUrl; // v1: piggybacks on the alert page

  // Lookup city for context in the email subject/body. Best-effort.
  let alertCity = "vuestra zona";
  const { data: cityRow } = await supabase
    .from("spanish_postal_codes")
    .select("city")
    .order(
      `(lat - ${lat}) * (lat - ${lat}) + (lon - ${lng}) * (lon - ${lng})`,
      { ascending: true },
    )
    .limit(1)
    .maybeSingle();
  if (cityRow?.city) alertCity = cityRow.city;

  // -------- send emails --------
  const results = await Promise.allSettled(
    targets.map(async (m: {
      id: string;
      email: string;
      nombre: string;
      verification_token: string;
    }) => {
      const unsubscribeUrl = `${APP_URL}/protectoras/baja?t=${encodeURIComponent(m.verification_token)}`;
      const tpl = isLost
        ? lostAlertEmail({
            nombrePet: String(record.pet_name || "Una mascota"),
            petPhoto: typeof record.pet_photo === "string" && record.pet_photo
              ? String(record.pet_photo)
              : undefined,
            petBreed: typeof record.pet_breed === "string" ? String(record.pet_breed) : undefined,
            petColor: typeof record.pet_color === "string" ? String(record.pet_color) : undefined,
            petTraits: typeof record.pet_traits === "string" ? String(record.pet_traits) : undefined,
            ownerContact: String(record.owner_contact || ""),
            city: alertCity,
            alertUrl,
            reportUrl,
            unsubscribeUrl,
          })
        : resolvedAlertEmail({
            nombrePet: String(record.pet_name || "Una mascota"),
            alertUrl,
            unsubscribeUrl,
          });
      return resendSend({
        to: m.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        unsubscribeUrl,
      });
    }),
  );

  const sent = results.filter(
    (r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok,
  ).length;
  const failed = results.length - sent;

  if (failed) console.error(`notify-protectoras: ${failed} send(s) failed`);

  return json({
    sent,
    failed,
    total_matched: matches?.length || 0,
    digest_skipped: (matches?.length || 0) - targets.length,
    flavor: isLost ? "lost" : "found",
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
