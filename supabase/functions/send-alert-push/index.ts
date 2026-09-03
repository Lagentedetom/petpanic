import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Web Push crypto imports
const encoder = new TextEncoder();

serve(async (req) => {
  try {
    const payload = await req.json();

    // The webhook sends the full record
    const record = payload.record;
    if (!record || record.status !== "active") {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@petpanic.com";

    // APNs config — optional. If unset, iOS subscribers are skipped and Web
    // Push still works, so the function never hard-fails on a missing key.
    const APNS_KEY = Deno.env.get("APNS_KEY") || "";
    const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID") || "";
    const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID") || "";
    const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") || "";
    const APNS_HOST = Deno.env.get("APNS_HOST") || "https://api.push.apple.com";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get nearby subscribers using PostGIS function
    const { data: subscribers, error } = await supabase.rpc(
      "nearby_push_subscribers",
      {
        alert_lat: record.lat,
        alert_lng: record.lng,
        radius_km: 5,
        exclude_user_id: record.owner_id,
      }
    );

    if (error) {
      console.error("Error finding subscribers:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!subscribers || subscribers.length === 0) {
      console.log("No nearby subscribers found");
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    console.log(`Found ${subscribers.length} nearby subscribers for alert ${record.id}`);

    // Notification content, shared by both delivery channels.
    const title = `🚨 ¡${record.pet_name} se ha perdido!`;
    const body = "Una mascota se ha perdido cerca de ti. Toca para ayudar.";
    const webPayload = JSON.stringify({ title, body, alertId: record.id });

    // Sign the APNs JWT once and reuse it for every iOS send this invocation.
    let apnsJwt = "";
    if (APNS_KEY && APNS_KEY_ID && APNS_TEAM_ID && APNS_BUNDLE_ID) {
      try {
        apnsJwt = await createApnsJwt(APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID);
      } catch (err) {
        console.error("APNs JWT creation failed:", err);
      }
    }

    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
      try {
        if (sub.platform === "ios") {
          // ── APNs (native iOS) ──
          if (!apnsJwt) {
            console.warn(`Skipping iOS subscriber ${sub.sub_user_id} — APNs not configured`);
            failed++;
            continue;
          }
          const res = await sendApns(APNS_HOST, apnsJwt, APNS_BUNDLE_ID, sub.device_token, {
            title,
            body,
            alertId: record.id,
          });
          if (res.status === 200) {
            sent++;
          } else {
            const reason = await res.text().catch(() => "");
            if (
              res.status === 410 ||
              reason.includes("BadDeviceToken") ||
              reason.includes("Unregistered")
            ) {
              console.log(`Removing dead APNs token for user ${sub.sub_user_id}`);
              await supabase
                .from("push_subscriptions")
                .delete()
                .eq("device_token", sub.device_token);
            } else {
              console.error(`APNs failed for ${sub.sub_user_id}: ${res.status} ${reason}`);
            }
            failed++;
          }
        } else {
          // ── Web Push (browser / PWA) ──
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.sub_auth,
            },
          };

          const result = await sendWebPush(
            pushSubscription,
            webPayload,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY,
            VAPID_SUBJECT
          );

          if (result.ok) {
            sent++;
          } else if (result.status === 404 || result.status === 410) {
            // Subscription expired or invalid - remove it
            console.log(`Removing invalid subscription for user ${sub.sub_user_id}`);
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
            failed++;
          } else {
            console.error(`Push failed for ${sub.sub_user_id}: ${result.status}`);
            failed++;
          }
        }
      } catch (err) {
        console.error(`Push error for ${sub.sub_user_id}:`, err);
        failed++;
      }
    }

    console.log(`Push results: ${sent} sent, ${failed} failed`);
    return new Response(JSON.stringify({ sent, failed }), { status: 200 });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

// ── APNs (Apple Push Notification service) ──

async function sendApns(
  host: string,
  jwt: string,
  bundleId: string,
  deviceToken: string,
  msg: { title: string; body: string; alertId: string }
): Promise<Response> {
  return fetch(`${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: msg.title, body: msg.body },
        sound: "default",
      },
      alertId: msg.alertId,
    }),
  });
}

async function createApnsJwt(
  p8: string,
  keyId: string,
  teamId: string
): Promise<string> {
  const header = { alg: "ES256", kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: teamId, iat: now };

  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
  const claimsB64 = base64urlEncode(encoder.encode(JSON.stringify(claims)));
  const unsigned = `${headerB64}.${claimsB64}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(p8),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(unsigned)
  );

  return `${unsigned}.${base64urlEncode(new Uint8Array(signature))}`;
}

// Strip the PEM armor from an APNs .p8 key and return raw DER bytes.
function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/\\n/g, "\n")
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  return Uint8Array.from([...binary].map((c) => c.charCodeAt(0)));
}

// ── Web Push implementation using Web Crypto API ──

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<Response> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  // Create VAPID JWT
  const vapidToken = await createVapidJwt(
    audience,
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );

  // Encrypt the payload using the subscription keys
  const encrypted = await encryptPayload(
    payload,
    subscription.keys.p256dh,
    subscription.keys.auth
  );

  // Send the push
  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Content-Length": String(encrypted.byteLength),
      TTL: "86400",
      Urgency: "high",
      Authorization: `vapid t=${vapidToken}, k=${vapidPublicKey}`,
    },
    body: encrypted,
  });
}

async function createVapidJwt(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key
  const privKeyBytes = base64urlDecode(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    privKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format for JWT
  const sigB64 = base64urlEncode(new Uint8Array(signature));
  return `${unsignedToken}.${sigB64}`;
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<ArrayBuffer> {
  const payloadBytes = encoder.encode(payload);

  // Decode subscriber keys
  const clientPublicKey = base64urlDecode(p256dhKey);
  const clientAuth = base64urlDecode(authSecret);

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Import client's public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientKey },
    localKeyPair.privateKey,
    256
  );

  // Export local public key
  const localPublicKey = await crypto.subtle.exportKey(
    "raw",
    localKeyPair.publicKey
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF for IKM
  const authInfo = encoder.encode("WebPush: info\0");
  const authInfoFull = new Uint8Array(
    authInfo.byteLength + clientPublicKey.byteLength + localPublicKey.byteLength
  );
  authInfoFull.set(authInfo, 0);
  authInfoFull.set(new Uint8Array(clientPublicKey), authInfo.byteLength);
  authInfoFull.set(
    new Uint8Array(localPublicKey),
    authInfo.byteLength + clientPublicKey.byteLength
  );

  const ikm = await hkdf(clientAuth, new Uint8Array(sharedSecret), authInfoFull, 32);

  // Derive content encryption key and nonce
  const contentEncKeyInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const cek = await hkdf(salt, ikm, contentEncKeyInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Pad payload (add delimiter byte 0x02 + zero padding)
  const paddedPayload = new Uint8Array(payloadBytes.byteLength + 1);
  paddedPayload.set(payloadBytes, 0);
  paddedPayload[payloadBytes.byteLength] = 2; // delimiter

  // Encrypt with AES-128-GCM
  const encryptionKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    encryptionKey,
    paddedPayload
  );

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const recordSize = 4096;
  const localPubKeyBytes = new Uint8Array(localPublicKey);
  const header = new Uint8Array(16 + 4 + 1 + localPubKeyBytes.byteLength);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = localPubKeyBytes.byteLength;
  header.set(localPubKeyBytes, 21);

  // Combine header + encrypted payload
  const result = new Uint8Array(header.byteLength + encrypted.byteLength);
  result.set(header, 0);
  result.set(new Uint8Array(encrypted), header.byteLength);

  return result.buffer;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(
    await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), ikm)
  );
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const infoWithCounter = new Uint8Array(info.byteLength + 1);
  infoWithCounter.set(info, 0);
  infoWithCounter[info.byteLength] = 1;
  const result = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, infoWithCounter));
  return result.slice(0, length);
}

function base64urlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  return Uint8Array.from([...binary].map((c) => c.charCodeAt(0)));
}
