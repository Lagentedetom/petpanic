---
project: PetPanic
reviewed: 2026-05-06
depth: deep
files_reviewed: 27
findings:
  critical: 6
  high: 9
  medium: 11
  low: 8
  total: 34
status: issues_found
ship_readiness: not_ready
---

# PetPanic — Adversarial Code Review

**Scope:** Supabase schema + RLS, edge functions, AppContext, all pages, hooks, capacitor config, service worker.
**Stack:** React 19 + Vite + Supabase (PostGIS) + Capacitor 8.
**Reviewer stance:** Force / "find every defect."

---

## Executive summary

PetPanic ships several **CRITICAL privacy and integrity holes** that contradict the stated privacy model in `PlanPage.tsx`:

> "Tu presencia en una zona solo es visible para personas que sean amigas tuyas y que además estén dadas de alta en esa misma zona."

The current RLS lets **anyone**, even unauthenticated `anon` users, read the entire `zone_presence` table, every user's `last_location` (down to ~100m) plus `last_location_at` from `profiles`, every pet's `contact_info`, every alert's `owner_contact`, and every push subscription's `endpoint`. Client-side filtering in `ZoneDetailsPage.tsx` does **not** save this; the data is already in the response and trivially harvestable via the anon key (which is published in the SPA).

Beyond privacy, the social-tier business rules (`zone_overlap`, `zone_limit_reached`, "Social plan required to create/join zones") are **only enforced in the React client**. RLS lets any free-tier user create unlimited zones and join any zone via a `curl` to PostgREST.

This app is **not** ready for Google Play closed test in its current state. The fixes are mostly small SQL migrations, but several need to land before exposing the project to even a small testing pool.

---

## CRITICAL — must be fixed before shipping

### CR-01 — Profile RLS leaks every user's location, email, and PII to anon

**Severity:** CRITICAL — privacy / GDPR violation.
**File:** `supabase-schema.sql:222`

```sql
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
```

`profiles` contains `email`, `last_location` (100m precision), `last_location_at`, `first_name`, `last_name`, `friend_code`, `primary_zone_id`, and the entire subscription state. `USING (true)` means **the anon key (which is bundled in the React app, public by design) can `SELECT * FROM profiles` and dump every user's row.**

Anyone running:
```js
fetch('https://kcisuedbzghoccgbshpa.supabase.co/rest/v1/profiles?select=*',
  { headers: { apikey: '<published anon key>' } })
```
gets the whole user table.

This is independently a GDPR Art. 32 breach (insufficient organisational measures for personal data). The production project ref + anon key are committed in `.env.local` (this is by design for a SPA, but it makes the leak immediately exploitable).

**Fix:** restrict profile SELECT, expose only what's needed, never raw `last_location` / `email` / names to non-self / non-friends. Minimal version:

```sql
DROP POLICY "profiles_select" ON profiles;

-- Self can read everything
CREATE POLICY "profiles_select_self" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Authenticated users can read minimal public fields of others via a view, not the table
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, display_name, photo_url, friend_code
  FROM profiles;
GRANT SELECT ON public.public_profiles TO authenticated;
```

Then change `searchUsers` and friend-profile fetches in `AppContext.tsx:260, 500` to query `public_profiles` not `profiles`. Friend-only fields (full name, location) need a separate friend-aware policy or RPC.

> Note: the existing `nearby_push_subscribers` RPC is `SECURITY DEFINER` so it can still read `last_location` server-side after the policy is locked down — that flow still works.

---

### CR-02 — `zone_presence_select` exposes every walker globally

**Severity:** CRITICAL — privacy violation, contradicts stated privacy model.
**File:** `supabase-schema.sql:251`

```sql
CREATE POLICY "presence_select" ON zone_presence FOR SELECT USING (true);
```

The PlanPage promises presence is only visible to friends who are members of the same zone. Reality: anyone with the anon key can read `zone_presence`, which contains `user_id`, `user_name`, `user_photo`, **`pet_names[]`** (pet names linked to identity), and `updated_at` (live location signal) for every user in every zone, no auth required.

`ZoneDetailsPage.tsx:100` does client-side filtering (`if (!isSelf && !isFriendOf(presence.user_id)) return null`) but the data is already in the React state and the network response. Anyone running the app in devtools can inspect `zonePresence` and see everyone.

**Fix:**
```sql
DROP POLICY "presence_select" ON zone_presence;

CREATE POLICY "presence_select_members" ON zone_presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM zone_members zm
      WHERE zm.zone_id = zone_presence.zone_id
        AND zm.user_id = auth.uid()
    )
  );
```

To still show "X people walking" to non-members, expose that via an RPC that only returns a count. The current UX flow (count visible to non-members in `ZoneDetailsPage.tsx:81-83`) needs to switch to that RPC.

---

### CR-03 — Walking-zone tier gating exists only in JS, RLS lets free users do anything

**Severity:** CRITICAL — business-logic bypass.
**Files:** `supabase-schema.sql:243-248`, `useSubscription.ts`, `WalkingZonesPage.tsx`

```sql
CREATE POLICY "zones_insert" ON walking_zones FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "zone_members_insert" ON zone_members FOR INSERT WITH CHECK (auth.uid() = user_id);
```

The migration `20260504...sql` defines `is_social_active(uuid)` precisely so RLS can gate Social-only features, but **no policy ever calls it**. The free-tier user is blocked only by `useSubscription.ts` returning `canCreateNewZone=false`, which is pure UI. A direct `fetch` to PostgREST inserts a zone successfully on the free tier.

Likewise:
- The 1-zone (trial) / 5-zone (paid) cap is computed in JS only — a free-tier user can create 1000 zones from `curl`.
- The `AppContext.tsx:441-447` parses error messages `'zone_overlap'`, `'zone_limit_reached'` that must come from server-side checks, but those checks **don't exist** in the schema. They were either never implemented or dropped.

**Fix:** wire `is_social_active` into RLS:

```sql
DROP POLICY "zones_insert" ON walking_zones;
DROP POLICY "zone_members_insert" ON zone_members;

CREATE POLICY "zones_insert" ON walking_zones FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id
    AND public.is_social_active(auth.uid())
    AND (
      SELECT count(*) FROM walking_zones WHERE creator_id = auth.uid()
    ) < CASE
      WHEN (SELECT subscription_status = 'trialing' FROM profiles WHERE id = auth.uid()) THEN 1
      ELSE 5
    END
  );

CREATE POLICY "zone_members_insert" ON zone_members FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_social_active(auth.uid()));
```

Add a separate trigger for the 200m overlap check so it can raise a structured error name `zone_overlap` that `AppContext.tsx` is already trying to parse:

```sql
CREATE OR REPLACE FUNCTION enforce_zone_overlap()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM walking_zones
    WHERE ST_DWithin(location, NEW.location, 200)
  ) THEN
    RAISE EXCEPTION 'zone_overlap' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_zone_overlap_t BEFORE INSERT ON walking_zones
  FOR EACH ROW EXECUTE FUNCTION enforce_zone_overlap();
```

---

### CR-04 — `pets_select` RLS exposes every pet's `contact_info` to the anon key

**Severity:** CRITICAL — privacy violation. Pet contact_info is the owner's phone number / email per UI hint ("Ej: Teléfono 600 000 000").
**File:** `supabase-schema.sql:227`

```sql
CREATE POLICY "pets_select" ON pets FOR SELECT USING (true);
```

Combined with the unauthenticated `PublicPetPage.tsx`, this is intentional for the QR flow — but `contact_info` on a pet that **isn't lost** should not be public. Currently it is. Anyone scraping `pets` over the anon key gets every owner phone number.

`PublicPetPage.tsx:97` even gates the call-button on `is_lost`, suggesting the developer understands this — but the SELECT policy doesn't.

**Fix:** split contact_info out, or restrict it via column-level policy / view:

```sql
DROP POLICY "pets_select" ON pets;

-- Owner sees everything
CREATE POLICY "pets_select_owner" ON pets FOR SELECT
  USING (auth.uid() = owner_id);

-- Public pet view (for QR pages) without contact_info
CREATE OR REPLACE VIEW public.public_pets AS
  SELECT id, owner_id, name, species, breed, color, traits, photo_url, is_lost,
         CASE WHEN is_lost THEN contact_info ELSE NULL END AS contact_info
  FROM pets;
GRANT SELECT ON public.public_pets TO anon, authenticated;
```

And change `PublicPetPage.tsx:16` to query `public_pets` instead of `pets`.

---

### CR-05 — Edge function `delete-account`: missing CORS on error responses + same auth client and admin client

**Severity:** CRITICAL — production endpoint partly broken on web.
**File:** `supabase/functions/delete-account/index.ts:21, 31, 40, 52`

The OPTIONS preflight returns CORS headers, but every error response (`401`, `500`) returns **no `Access-Control-Allow-Origin` header**. From a browser at `app.petpanic.es`, the failure case will be opaque ("CORS policy: no Access-Control-Allow-Origin header") and the app's `setDeleteError(err.message)` will show a useless "Failed to fetch" instead of "No autorizado". Worse, even on the success path, only the 200 response includes the CORS header — the 401/500 paths break the user's UX silently when they actually need feedback.

Additional issue (line 25): the user-verification client is created with `SUPABASE_SERVICE_ROLE_KEY` plus an `Authorization: Bearer <user JWT>` header. The service-role key in the SDK overrides the JWT for RLS purposes. This works for `auth.getUser()` but is misleading and fragile — use `SUPABASE_ANON_KEY` for the user client.

**Fix:**

```ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// every Response should spread ...corsHeaders into headers
return new Response(JSON.stringify({ error: "No autorizado" }),
  { status: 401, headers: corsHeaders });

// user client should use anon key
const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
  global: { headers: { Authorization: authHeader } },
});
```

---

### CR-06 — `friendships_insert` lets you spam ANY user with friend requests; no one-pending-per-pair guard

**Severity:** CRITICAL — abuse / spam vector.
**File:** `supabase-schema.sql:257-258`

```sql
CREATE POLICY "friendships_insert" ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
```

There is no rate limit, no `is_social_active` gate, and no check that the addressee actually shared a friend code. Combined with **CR-01** (anyone can dump all `profiles` and read every `id`), an attacker can fire a friend request at every user in the database and the addressee's UI shows "Solicitudes Pendientes" with the requester's name and photo.

The schema uses `UNIQUE(requester_id, addressee_id)`, but there's nothing stopping `(B, A)` pending while `(A, B)` is also pending, and nothing stopping a user from re-sending after decline.

**Fix:**
1. Gate friend-request creation behind `is_social_active(auth.uid())` (PlanPage advertises friends as a Social feature).
2. Require the requester to know the addressee's `friend_code` — pass it in WITH CHECK via an RPC, not raw INSERT:

```sql
CREATE OR REPLACE FUNCTION send_friend_request(p_friend_code text)
RETURNS friendships AS $$
DECLARE
  v_addressee uuid;
  v_row friendships;
BEGIN
  SELECT id INTO v_addressee FROM profiles
   WHERE friend_code = upper(p_friend_code) AND id <> auth.uid();
  IF v_addressee IS NULL THEN RAISE EXCEPTION 'invalid_friend_code'; END IF;

  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (auth.uid(), v_addressee, 'pending')
  ON CONFLICT (requester_id, addressee_id) DO NOTHING
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE INSERT ON friendships FROM authenticated;
GRANT EXECUTE ON FUNCTION send_friend_request(text) TO authenticated;
```

Then `AppContext.tsx:507` calls `supabase.rpc('send_friend_request', { p_friend_code: code })` with the code the user typed.

---

## HIGH — significant defects, fix before launch

### HI-01 — `messages_select` lets any authenticated user read every alert chat ever

**Severity:** HIGH — privacy.
**File:** `supabase-schema.sql:238`

```sql
CREATE POLICY "messages_select" ON alert_messages FOR SELECT USING (auth.uid() IS NOT NULL);
```

There is no scoping to "messages on alerts I can see / am near / am the owner of." Any logged-in user can read every chat about every lost pet, including photos uploaded as messages. Combined with `alerts_select USING (true)`, this gives full message history of strangers' alert flows.

**Fix:** restrict to "owner of the alert OR sender of any message in the thread." Less strict but defensible: any authenticated user can read messages on alerts that are still `active`:

```sql
CREATE POLICY "messages_select" ON alert_messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM alerts a WHERE a.id = alert_id AND a.status = 'active')
    OR EXISTS (SELECT 1 FROM alerts a WHERE a.id = alert_id AND a.owner_id = auth.uid())
    OR sender_id = auth.uid()
  );
```

---

### HI-02 — `push_subscriptions` exposed via `nearby_push_subscribers` RPC with no caller check

**Severity:** HIGH — could be used to harvest endpoints.
**File:** `supabase-schema.sql:154-180`

`nearby_push_subscribers(alert_lat, alert_lng, radius_km, exclude_user_id)` is `SECURITY DEFINER` and `LANGUAGE plpgsql STABLE`. It's invoked by the edge function (good), but it can also be invoked by **any authenticated client** via `supabase.rpc('nearby_push_subscribers', ...)` since no `REVOKE` is in place. An authenticated user could call it with arbitrary lat/lng and harvest every nearby user's `endpoint`, `p256dh`, `auth` triple — the materials needed to send push messages spoofing the server (assuming they also leak VAPID keys, but the endpoint+keys leak is itself a privacy issue: "user X has notifications enabled and is here").

**Fix:**
```sql
REVOKE EXECUTE ON FUNCTION nearby_push_subscribers FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION nearby_push_subscribers TO service_role;
```

---

### HI-03 — `alerts.owner_contact` exposed to anon (alongside CR-04)

**Severity:** HIGH — phone-number harvest.
**File:** `supabase-schema.sql:233`

```sql
CREATE POLICY "alerts_select" ON alerts FOR SELECT USING (true);
```

Every alert row carries `owner_contact` (the lost-pet contact number/email). Users who post an alert get their phone scraped by the next bot that hits the anon endpoint. This is acceptable while the alert is *active* (that's the whole point — get the number to people who can help) but resolved alerts should not keep leaking the contact. AppContext.tsx already filters resolved alerts to the owner's view, but the underlying RLS doesn't.

**Fix:** restrict resolved-alert SELECT to owner only:
```sql
DROP POLICY "alerts_select" ON alerts;
CREATE POLICY "alerts_select" ON alerts FOR SELECT
  USING (status = 'active' OR owner_id = auth.uid());
```

---

### HI-04 — `zone_presence DELETE` race in `useEffect` cleanup wipes other users' rows… nope, actually wipes own row from a *different* zone

**Severity:** HIGH — data integrity bug.
**File:** `src/context/AppContext.tsx:341-346`

```ts
return () => {
  if (currentZoneId && user) {
    supabase.from('zone_presence').delete()
      .eq('zone_id', currentZoneId).eq('user_id', user.id).then();
  }
};
```

This is the cleanup of the geofencing effect. The effect's deps are `[location, walkingZones, user, pets, currentZoneId]`. **Every** location update re-runs the effect → cleanup runs → deletes the user from `currentZoneId`. Then the body of the effect re-evaluates and (hopefully) upserts them back. This causes:
1. Visible flicker in `ZoneDetailsPage` for friends watching ("user left, user joined" every time GPS pings).
2. Realtime broadcast traffic explosion.
3. A real race: between the DELETE firing and the UPSERT firing, a friend's screen briefly shows the user as gone. If the UPSERT fails (rate limit / network), the user is silently kicked out of presence with no recovery until they move.

Closely related: `currentZoneId` is captured by closure in the cleanup; if it changes mid-flight, the wrong row gets deleted.

**Fix:** extract presence into a dedicated effect with `[user, currentZoneId]` deps only; do the periodic `updated_at` heartbeat with a `setInterval`, not on every GPS event. The effect's main dep should be the *zone identity changing*, not the location.

---

### HI-05 — `geolocation watchPosition` never cancels its retry chain on unmount → leak + duplicated callbacks

**Severity:** HIGH — memory / battery leak on mobile.
**File:** `src/context/AppContext.tsx:147-161`

`handleLocationError` calls `navigator.geolocation.getCurrentPosition(updateLoc, () => {}, …)` for `TIMEOUT` / `POSITION_UNAVAILABLE`. That call is fire-and-forget — when the component unmounts (logout), the in-flight retry is not cancellable, and `updateLoc` will fire after unmount, calling `setLocation` on a dead component. With `StrictMode` double-mount in dev that will sometimes crash. In prod it leaks a closure holding the user's profile.

**Fix:** track an `aborted` flag in the effect, check it in both callbacks before calling `setState`:

```ts
let aborted = false;
const updateLoc = (pos: GeolocationPosition) => {
  if (aborted) return;
  // …
};
return () => { aborted = true; navigator.geolocation.clearWatch(watchId); };
```

---

### HI-06 — `triggerPanic` writes the alert with **un-blurred** GPS coordinates

**Severity:** HIGH — privacy. Contradicts the "round to 3 decimals for privacy" rule.
**File:** `src/context/AppContext.tsx:404-406`

```ts
location: `POINT(${currentLocation.lng} ${currentLocation.lat})`,
lat: currentLocation.lat,
lng: currentLocation.lng,
```

`AppContext.tsx:139-140` correctly blurs `last_location` before writing it, but the alert path stores the user's exact GPS down to whatever precision the device gives (usually ≤10 m). `alerts_select` is `USING (true)` (HI-03), so the exact location of the owner at panic-trigger is leaked to the anon key forever.

This is a defensible design choice for the lost-pet use case (rescuers need the precise spot) but the README/PrivacyPage says coordinates are blurred to 100m. Decide which it is and document it; if you keep precise alert coords, store *only* those after resolving (the owner's location at the time of panic is sensitive PII once the alert is resolved).

**Fix:** at minimum, drop precision to 3 decimals (~100 m, matches stated policy):

```ts
const blurredLat = Math.round(currentLocation.lat * 1000) / 1000;
const blurredLng = Math.round(currentLocation.lng * 1000) / 1000;
```

…or keep precise but document it in `PrivacyPage`.

---

### HI-07 — Storage path traversal not strictly possible, but `pet-photos` upload is unrestricted by storage RLS

**Severity:** HIGH — depends on bucket policy (not in repo).
**Files:** `RegisterPetPage.tsx:74`, `AlertDetailsPage.tsx:99`

```ts
const filePath = `${user.id}/${petId || crypto.randomUUID()}.jpg`;        // pets
const filePath = `alerts/${alertId}/${crypto.randomUUID()}.jpg`;          // chat
```

Path components are safe (uuid, owner_id from JWT). But:
1. No storage RLS policy is committed in the repo. If the `pet-photos` bucket has the default `public` policy, **anyone can upload to any path** including overwriting other users' pet photos. Verify in the Supabase dashboard.
2. There's no MIME enforcement at the storage layer — only in the React form. A native client (or a curl) can upload anything as `image/jpeg`.
3. `upsert: true` on line 76 of `RegisterPetPage` plus a `petId`-derived path means user A can overwrite user B's pet photo if they know the petId (UUIDs are hard to guess but `pets_select USING(true)` (CR-04) means they're trivially listable).

**Fix:** pin storage RLS:

```sql
CREATE POLICY "pet-photos_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "pet-photos_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

For the alert-message path `alerts/{alertId}/{uuid}.jpg`, change to `alerts/{alertId}/{auth.uid()}/{uuid}.jpg` so the same RLS shape applies.

---

### HI-08 — `nearby_alerts` SQL function uses `radius_km DEFAULT 2` but client filters at 2 km client-side anyway, with NO server enforcement

**Severity:** HIGH — geo-fencing bypass / fairness.
**Files:** `supabase-schema.sql:134-152`, `AppContext.tsx:189`

```ts
const { data } = await supabase.from('alerts').select('*').eq('status', 'active')...
```

`AppContext.tsx` ignores `nearby_alerts` and instead pulls **every active alert in the entire database** into the client, then filters by `calculateDistance`. With even a few thousand alerts this is a denial-of-service against the user's bandwidth and a fully open data dump (combined with HI-03).

**Fix:** call the existing PostGIS RPC:
```ts
const { data } = await supabase.rpc('nearby_alerts', {
  user_lat: location.lat, user_lng: location.lng, radius_km: 5
});
```

…and gate `alerts_select` to "alerts within X km of `last_location` OR owned by me OR resolved-and-mine," using a `SECURITY DEFINER` RPC for non-owner reads. As a less invasive fix, at least limit to `created_at > now() - interval '7 days'` so old alerts aren't repeatedly streamed.

---

### HI-09 — Service worker `notificationclick` calls `w.navigate(url)` on cross-origin window without checking

**Severity:** HIGH — open-redirect-ish.
**File:** `public/sw.js:73`

```js
for (const w of wins) {
  if (w.url.includes(self.location.origin)) { w.navigate(url); return w.focus(); }
}
```

`String.prototype.includes` is not a URL match: a window at `https://attacker.com/?u=https://app.petpanic.es/` matches and gets `w.navigate(url)`. In practice this is bounded because the attacker would need to be a controlled WindowClient of your SW (rare), but the right test is `new URL(w.url).origin === self.location.origin`.

**Fix:**
```js
try { if (new URL(w.url).origin === self.location.origin) { w.navigate(url); return w.focus(); } } catch {}
```

---

## MEDIUM — quality issues that risk bugs

### ME-01 — `friendships_update` lets the requester re-accept their own request

**Severity:** MEDIUM — logic bug.
**File:** `supabase-schema.sql:259-260`

```sql
CREATE POLICY "friendships_update" ON friendships FOR UPDATE USING (auth.uid() = addressee_id);
```

Good — only addressee can accept. But there's no `WITH CHECK`, so the addressee can update **anything** about the row, including changing `requester_id` (because `auth.uid() = addressee_id` only constrains the visible row). Add a WITH CHECK:

```sql
CREATE POLICY "friendships_update" ON friendships FOR UPDATE
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id AND status IN ('accepted'));
```

---

### ME-02 — `profiles_update` has no WITH CHECK; user can change their own `id` to any value, blow up FKs

**Severity:** MEDIUM — data integrity.
**File:** `supabase-schema.sql:224`

```sql
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
```

USING is checked against the *existing* row, so a user can submit `UPDATE profiles SET id = '<other uuid>' WHERE id = '<my uuid>'` and the policy lets it through. The FK `profiles.id REFERENCES auth.users(id)` will block actually changing to a non-existent uuid, but a user can change `subscription_tier='social'`, `subscription_status='active'`, `current_period_end='2099-…'` and **grant themselves the paid plan for free.**

This is a real privilege-escalation right now: with the current setup, any authenticated user can give themselves perpetual Social access by patching their own profile row. Combined with CR-03 (no server-side gating), this is the same hole twice.

**Fix:** drop subscription columns from the update policy. Use a column-level grant or split the table:

```sql
DROP POLICY "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name, first_name, last_name, photo_url, primary_zone_id,
              last_location, last_location_at)
  ON profiles TO authenticated;
```

---

### ME-03 — `handle_new_user` is `SECURITY DEFINER` with `search_path` not pinned

**Severity:** MEDIUM — could be hijacked.
**File:** `supabase-schema.sql:184-203`

`SECURITY DEFINER` functions without `SET search_path = public, pg_temp` are vulnerable if a hostile user manages to create a function in their own schema with a name that the definer-function will resolve at runtime. Best practice on Supabase. Same issue in `nearby_alerts`, `nearby_push_subscribers`, `set_default_subscription`.

**Fix:** add `SET search_path = public, pg_temp` to each `CREATE FUNCTION`. The migration file's `is_social_active` already does this correctly — apply the same to all of them.

---

### ME-04 — `AlertDetailsPage` reads `selectedAlert` from `activeAlerts` only; resolved alerts and direct links 404

**Severity:** MEDIUM — broken deep link.
**File:** `src/pages/AlertDetailsPage.tsx:13-15`

```ts
const { activeAlerts, user } = useApp();
const selectedAlert = activeAlerts.find(a => a.id === alertId);
```

A push notification delivered to a friend, opened 30 minutes later after the owner resolved the alert, lands on `/alerts/{id}` and shows "Alerta no encontrada o ya resuelta" because `activeAlerts` no longer contains it. Users will think the deep link is broken.

**Fix:** if `selectedAlert` is missing, fall back to a direct fetch by id (with a "this alert was resolved" banner).

---

### ME-05 — `JOIN` zone presence flicker: `ZoneDetailsPage` clears state to `[]` if user is not yet a member, then refetches, causing visible "0 → real number" jump

**Severity:** MEDIUM — UX.
**File:** `src/pages/ZoneDetailsPage.tsx:38-41`

```ts
if (!user || !zoneId || !selectedZone?.is_member) {
  setZonePresence([]);
  return;
}
```

This fires before `walkingZones` is enriched with `is_member` (which depends on `fetchZones` finishing), causing a flash of "no presence" on first navigation. Since `is_member` lives client-side derived in `fetchZones`, the page is unstable until the DB round-trip completes.

**Fix:** show a loader while `walkingZones` is empty/unenriched.

---

### ME-06 — `crypto.randomUUID()` not polyfilled; older WebViews crash

**Severity:** MEDIUM — Capacitor / Android compatibility.
**Files:** `AppContext.tsx:74`, `RegisterPetPage.tsx:74`, `AlertDetailsPage.tsx:99`

`crypto.randomUUID()` is supported on Android System WebView 92+. Capacitor 8 ships a recent WebView on modern devices but a Pixel 4 on Android 9 with an outdated WebView will crash. For a "lost pet" emergency app, you cannot afford a crash on the panic flow.

**Fix:** add a small UUID polyfill:
```ts
const uuid = () => crypto.randomUUID?.() ??
  ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16));
```

---

### ME-07 — `loading` state ends as soon as `getSession()` returns, before profile is loaded → UI flashes wrong subscription state

**Severity:** MEDIUM — UX / subscription gating.
**File:** `src/context/AppContext.tsx:80-95`, `useSubscription.ts:56`

`loading` flips false on session resolution. `userProfile` arrives ~200ms later. During that window:
- `useSubscription` returns `DEFAULT_STATE` (`tier: 'free'`, `hasActiveSocial: false`).
- `WalkingZonesPage` shows "Necesitas PetPanic Social…" lock to a paid user.
- `TrialBanner` is correctly defensive (returns null), but other views aren't.

**Fix:** keep `loading=true` until either `userProfile` is loaded OR a fast timeout (1 s) elapses.

---

### ME-08 — `fetchZones` uses `or(...)` filter pattern in `friendships`, no escaping

**Severity:** MEDIUM — would be SQL injection if user ID could be user-controlled (it can't, comes from JWT), but the pattern is dangerous.
**File:** `src/context/AppContext.tsx:252`

```ts
.or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
```

`user.id` is a UUID from Supabase JWT, so this is safe today. But the `.or()` template with backtick interpolation will explode the day someone uses a free-form string from input there. The PostgREST `.or()` syntax uses `,` and `()` as control chars, so a malicious string with `,` would split the filter.

**Fix:** future-proof by validating `user.id` is a UUID format before interpolation, or use `.in('id', [...])` patterns where applicable.

---

### ME-09 — `vite.config.ts` exports `process.env.GEMINI_API_KEY` at build time

**Severity:** MEDIUM — secret leak risk.
**File:** `vite.config.ts:11`

```ts
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
},
```

If anyone ever sets `GEMINI_API_KEY=…` in `.env` for any reason, it will be **inlined into the production JS bundle** because `define` runs at build time. There's no current usage of `GEMINI_API_KEY` in `src/`, so it's a foot-gun rather than a present leak. Remove this dead config.

---

### ME-10 — `dotenv` and `express` are runtime dependencies that have no place in a SPA

**Severity:** MEDIUM — supply-chain / bundle size.
**File:** `package.json:24, 26`

```json
"dotenv": "^17.2.3",
"express": "^4.21.2"
```

These are not imported anywhere in `src/`. They look like AI-Studio or scaffolding leftovers. `dotenv@17` is also a major upgrade with breaking changes — make sure no tooling is silently using it. Remove them; if a CLI script needs `dotenv`, move it to `devDependencies`.

---

### ME-11 — Supabase admin token committed to `.mcp.json` (gitignored, but still on disk in plaintext + Dropbox-synced)

**Severity:** MEDIUM — operational secret hygiene.
**File:** `petpanic/.mcp.json`

Contains a Supabase personal access token (`sbp_…`) granting admin-level MCP access to the production project `kcisuedbzghoccgbshpa`. The file is `.gitignore`d so it's not in git, but the project root is **inside Dropbox** ("LA GENTE DE TOM/000-LA GENTE DE TOM/2026/PETPANIC 2.0/"), meaning the secret is replicated to Dropbox cloud and every device sharing this folder. If any of those endpoints is compromised, the token grants full Supabase project access including the service role.

**Fix:** rotate the `sbp_…` token now (assume it's leaked), move `.mcp.json` outside Dropbox, or store it in `~/.config` and reference it from there.

---

## LOW — code quality / hygiene

### LO-01 — `console.log`s left in production paths

**Severity:** LOW.
**Files:** `src/main.tsx:10`, `src/lib/notifications.ts:38`, `supabase/functions/send-alert-push/index.ts:42, 46, 82, 98`

Edge function logs reveal user IDs and counts in Supabase logs — fine for ops, but `console.log('Push subscription saved')` and `console.log('[SW] Service worker registered')` on the client are noise.

---

### LO-02 — `getOrError` not used; `as any` casts hide errors

**Severity:** LOW.
**Files:** `LoginPage.tsx:44, 59`, `ProfilePage.tsx:145`, `RegisterPetPage.tsx:126`, `leaflet-setup.ts:10`

`catch (err: any)` is fine in TS but `as any` casts (especially `e.target.value as any` on a typed `<select>`) drop type safety. The leaflet-setup `as any` is a known workaround.

---

### LO-03 — `tsc --noEmit` is not clean

**Severity:** LOW.
**Output:** 5 errors in `ErrorBoundary.tsx`, `PlanPage.tsx`, plus expected Deno errors in `supabase/functions/`.

```
src/components/ErrorBoundary.tsx(19,41): Cannot find namespace 'React'.
src/components/ErrorBoundary.tsx(34,37): Property 'setState' does not exist on type 'ErrorBoundary'.
src/components/ErrorBoundary.tsx(44,17): Property 'props' does not exist on type 'ErrorBoundary'.
src/pages/PlanPage.tsx(262,46): Cannot find namespace 'React'.
src/pages/PlanPage.tsx(276,64): Cannot find namespace 'React'.
```

`PlanPage.tsx` uses `React.ReactNode` without importing `React`. `ErrorBoundary.tsx` is a class component that imports `Component` but uses `React.ErrorInfo` from a missing namespace, plus the class state typing is broken so `this.props` and `this.setState` aren't visible to TS — this means the React 19 + JSX-runtime-only setup needs `React` imported explicitly here, or the class component pattern needs to be updated to use the new JSX runtime.

The Supabase function errors are expected (Deno types not available in node tsc) — exclude `supabase/functions/**` from `tsconfig.json`.

**Fix:**
```tsx
// PlanPage.tsx, ErrorBoundary.tsx
import * as React from 'react';   // or import { ReactNode } and use it directly
```

```json
// tsconfig.json
"exclude": ["supabase/functions"]
```

---

### LO-04 — `'process.env.GEMINI_API_KEY'` define + `process.env.DISABLE_HMR` reference in vite.config.ts but neither is documented

**Severity:** LOW.
**File:** `vite.config.ts:11, 21`

Plus `DISABLE_HMR` is documented as "AI Studio" but the code is shipping to Google Play. Dead config — remove (also see ME-09).

---

### LO-05 — `referrerPolicy="no-referrer"` is sprinkled across many `<img>` tags

**Severity:** LOW (good practice for Google avatar URLs, but inconsistent — `Onboarding`, `LoginPage`, `FriendsPage` user photos don't have it).

Pick a side: either set it globally via meta tag, or ensure all user-uploaded image tags have it. Not a security issue, just inconsistent.

---

### LO-06 — `Onboarding.tsx` reads `localStorage` during render

**Severity:** LOW.
**File:** `src/components/Onboarding.tsx:40`

```tsx
const isComplete = localStorage.getItem('onboarding-complete');
if (isComplete) return null;
```

Reading `localStorage` during render breaks SSR (not relevant here since this is a SPA) but more importantly causes the onboarding to flash on every navigation that re-mounts the component. Move to `useState(() => localStorage.getItem(...))` for a one-time read.

---

### LO-07 — `Header.tsx` logout button only — no actual header navigation for `<= 600px` devices on the public pet page

**Severity:** LOW. `PublicPetPage.tsx` is the public unauthenticated page; the absence of a Header is intentional. Just confirm.

---

### LO-08 — Capacitor config minimal, no deep-link handling

**Severity:** LOW.
**File:** `capacitor.config.ts`

```ts
const config: CapacitorConfig = {
  appId: 'com.petpanic.app',
  appName: 'PetPanic',
  webDir: 'dist'
};
```

The Android manifest has no `<intent-filter>` for `https://app.petpanic.es/*` or for `petpanic://` schemes. The QR-code links (`window.location.origin/pet/${petId}`) on web work fine, but a friend who scans the QR while having the Android app installed will open the browser, not the app. This is acceptable for the closed test but should be wired up before public launch.

Also: `permissions` in `AndroidManifest.xml` only includes `INTERNET` — no `ACCESS_FINE_LOCATION` or `ACCESS_COARSE_LOCATION`. If the app is intended to use device geolocation (it absolutely is — it's the core feature), Capacitor will need the geolocation plugin and matching permissions. Currently the app is using the **web** `navigator.geolocation` API, which on Android WebView prompts the user via the browser's permission UI. That works, but it's not the best mobile UX and may differ between WebView versions.

---

## Verification of stated security measures

| Measure | Stated | Actual |
|---|---|---|
| Photo upload 5MB max + MIME whitelist | Yes | Verified in `RegisterPetPage.tsx:21-22, 59-68` and `AlertDetailsPage.tsx:73-74` ✓ — but only client-side (HI-07) |
| Message rate-limit 3 s + 500 char cap | Yes | Verified in `AlertDetailsPage.tsx:48, 52, 71` ✓ — but only client-side (a curl bypasses both) |
| Location rounded to 3 decimals before storing | Yes | `last_location` ✓ (`AppContext.tsx:139-140`); `alerts.location` ✗ (HI-06) |
| RLS enabled on all tables | Yes | `ENABLE ROW LEVEL SECURITY` confirmed for all 9 tables ✓ — but the **policies** are too permissive (CR-01, CR-02, CR-03, CR-04, HI-01, HI-03) |
| Delete-account uses JWT verification + admin.deleteUser | Yes | Verified ✓ but CORS broken on errors (CR-05) |

---

## Ship readiness verdict

**Not ready for Google Play closed test as-is.** The blockers are CR-01 through CR-06: the RLS posture is essentially "everything public to anyone with the anon key." Even a closed-test cohort of 10 users represents 10 real people whose phone numbers, walking patterns, and home neighborhood will be exfiltrable from any browser devtools. CR-03 + ME-02 also mean any tester can self-grant the paid Social tier by editing one row, which makes the trial→paid metrics meaningless from day one. The fixes are mostly a single SQL migration (≈2 hours of work to write and apply): tighten the SELECT policies on `profiles`, `pets`, `alerts`, `zone_presence`, `alert_messages`; gate `walking_zones`/`zone_members` writes through `is_social_active`; revoke `nearby_push_subscribers` from `authenticated`; rotate the leaked Supabase admin token; and patch the CORS bug in `delete-account`. Do those, redeploy, ship to closed test. The HIGH-severity items (HI-01 through HI-09) should be fixed in the same week before any expansion of the test pool, but only the CRITICAL ones strictly block the first APK push.

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer, deep depth)_
_Review depth: deep — schema, RLS, edge functions, all client pages, hooks, capacitor, service worker_
