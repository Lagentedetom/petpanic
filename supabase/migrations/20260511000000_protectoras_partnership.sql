-- ============================================================================
-- PetPanic - Protectoras partnership v1 (2026-05-11)
--
-- Email-only subscription for animal shelters. Zero-onboarding for partners:
-- they submit a form with email + CP base + radio km, double-opt-in via
-- Resend, and from then on receive emails when a dog is reported lost (or
-- found) within their service zone. No account, no app, no dashboard.
--
-- This migration creates structure + RLS + public RPCs. The CP-to-lat/lon
-- lookup data (11,150 Spanish postal codes from Geonames.org) lives in a
-- separate migration applied right after this one.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. spanish_postal_codes — lookup table for CP -> centroid coordinates
-- ---------------------------------------------------------------------------
-- Public read access (the alta form needs to validate CPs client-side and
-- show the city name as feedback). No PII, just centroids.
-- ---------------------------------------------------------------------------

create table public.spanish_postal_codes (
  cp       text primary key,
  lat      double precision not null,
  lon      double precision not null,
  city     text not null,
  province text not null
);

-- Spatial index on the centroid as geography(Point, 4326) for ST_DWithin().
create index idx_spanish_postal_codes_geog
  on public.spanish_postal_codes
  using gist (
    (st_setsrid(st_makepoint(lon, lat), 4326)::geography)
  );

alter table public.spanish_postal_codes enable row level security;

-- Anyone can read postal-code centroids — they're public reference data.
create policy "spanish_postal_codes_select_all"
  on public.spanish_postal_codes
  for select
  to anon, authenticated
  using (true);


-- ---------------------------------------------------------------------------
-- 2. protector_subscribers — the email list itself
-- ---------------------------------------------------------------------------
-- PII (email + organization name + IP at signup time). Locked down hard:
--   - anon CAN insert via the subscribe_protectora() RPC only
--   - nobody can SELECT with anon/authenticated keys
--   - update happens only through token-based RPCs
--   - the edge function uses the service_role key to read for sending
-- ---------------------------------------------------------------------------

create table public.protector_subscribers (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null check (char_length(nombre) between 2 and 120),
  email                text not null,
  email_lower          text generated always as (lower(email)) stored unique,
  cp_base              text not null references public.spanish_postal_codes(cp),
  radio_km             int  not null default 25 check (radio_km between 5 and 100),
  opt_in_perdidos      boolean not null default true,
  opt_in_encontrados   boolean not null default true,
  opt_in_overflow_50km boolean not null default false,
  digest_diario        boolean not null default false,
  verification_token   text not null,
  active               boolean not null default false,
  referral_code        text unique,
  -- Audit columns. We track signup IP for GDPR/abuse reasons (we are
  -- collecting consent, so we need to be able to prove who consented from
  -- where). Cleared after 12 months by a separate cleanup job.
  signup_ip            inet,
  signup_user_agent    text,
  created_at           timestamptz not null default now(),
  confirmed_at         timestamptz,
  unsubscribed_at      timestamptz
);

create index idx_protector_subscribers_active_cp
  on public.protector_subscribers (cp_base)
  where active = true;

create index idx_protector_subscribers_token
  on public.protector_subscribers (verification_token);

alter table public.protector_subscribers enable row level security;

-- Default deny: no policies = nothing readable/writable via anon or
-- authenticated. RPCs below are the only entry points.


-- ---------------------------------------------------------------------------
-- 3. RPC subscribe_protectora — signup with auto-generated verification token
-- ---------------------------------------------------------------------------
-- Called from the public /protectoras/alta form. SECURITY DEFINER so it can
-- insert past the RLS deny-all policy. Re-subscribes (same email) reset the
-- token and active=false, forcing a re-confirmation. This is intentional —
-- if someone re-fills the form, they get a fresh consent prompt.
-- ---------------------------------------------------------------------------

create or replace function public.subscribe_protectora(
  p_nombre               text,
  p_email                text,
  p_cp_base              text,
  p_radio_km             int  default 25,
  p_opt_in_perdidos      boolean default true,
  p_opt_in_encontrados   boolean default true,
  p_opt_in_overflow_50km boolean default false,
  p_digest_diario        boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email_clean text;
  v_token       text;
  v_id          uuid;
  v_city        text;
  v_province    text;
begin
  -- ---------- validation ----------
  if p_nombre is null or char_length(btrim(p_nombre)) < 2 then
    return jsonb_build_object('ok', false, 'error', 'invalid_nombre');
  end if;

  -- RFC-pragmatic email regex (good enough; SMTP will reject the rest).
  v_email_clean := lower(btrim(p_email));
  if v_email_clean is null or v_email_clean !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  if not exists (select 1 from public.spanish_postal_codes where cp = p_cp_base) then
    return jsonb_build_object('ok', false, 'error', 'invalid_cp');
  end if;

  if p_radio_km < 5 or p_radio_km > 100 then
    return jsonb_build_object('ok', false, 'error', 'invalid_radio');
  end if;

  if not (p_opt_in_perdidos or p_opt_in_encontrados) then
    return jsonb_build_object('ok', false, 'error', 'no_opt_in');
  end if;

  -- ---------- token ----------
  -- 32 bytes -> ~43 chars base64url. Unique per signup, used for confirm,
  -- unsubscribe, and preference updates.
  v_token := encode(extensions.gen_random_bytes(32), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  -- ---------- insert or refresh ----------
  insert into public.protector_subscribers (
    nombre, email, cp_base, radio_km,
    opt_in_perdidos, opt_in_encontrados, opt_in_overflow_50km, digest_diario,
    verification_token, active, confirmed_at, unsubscribed_at
  )
  values (
    btrim(p_nombre), v_email_clean, p_cp_base, p_radio_km,
    p_opt_in_perdidos, p_opt_in_encontrados, p_opt_in_overflow_50km, p_digest_diario,
    v_token, false, null, null
  )
  on conflict (email_lower) do update set
    nombre               = excluded.nombre,
    cp_base              = excluded.cp_base,
    radio_km             = excluded.radio_km,
    opt_in_perdidos      = excluded.opt_in_perdidos,
    opt_in_encontrados   = excluded.opt_in_encontrados,
    opt_in_overflow_50km = excluded.opt_in_overflow_50km,
    digest_diario        = excluded.digest_diario,
    verification_token   = excluded.verification_token,
    active               = false,
    confirmed_at         = null,
    unsubscribed_at      = null
  returning id into v_id;

  -- Look up city/province to return for the email template + UI feedback.
  select city, province
    into v_city, v_province
    from public.spanish_postal_codes
    where cp = p_cp_base;

  return jsonb_build_object(
    'ok',       true,
    'id',       v_id,
    'token',    v_token,
    'email',    v_email_clean,
    'cp',       p_cp_base,
    'city',     v_city,
    'province', v_province
  );
end;
$$;

revoke all on function public.subscribe_protectora(text, text, text, int, boolean, boolean, boolean, boolean) from public;
grant execute on function public.subscribe_protectora(text, text, text, int, boolean, boolean, boolean, boolean) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. RPC confirm_protectora_subscription — 1-click double opt-in
-- ---------------------------------------------------------------------------

create or replace function public.confirm_protectora_subscription(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.protector_subscribers;
begin
  if p_token is null or char_length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  update public.protector_subscribers
    set active       = true,
        confirmed_at = coalesce(confirmed_at, now())
  where verification_token = p_token
    and unsubscribed_at is null
  returning * into v_row;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'token_not_found');
  end if;

  return jsonb_build_object(
    'ok',     true,
    'nombre', v_row.nombre,
    'email',  v_row.email,
    'cp',     v_row.cp_base
  );
end;
$$;

revoke all on function public.confirm_protectora_subscription(text) from public;
grant execute on function public.confirm_protectora_subscription(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5. RPC unsubscribe_protectora — 1-click baja from any email footer
-- ---------------------------------------------------------------------------

create or replace function public.unsubscribe_protectora(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
begin
  if p_token is null or char_length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  update public.protector_subscribers
    set active          = false,
        unsubscribed_at = coalesce(unsubscribed_at, now())
  where verification_token = p_token
  returning email into v_email;

  if v_email is null then
    return jsonb_build_object('ok', false, 'error', 'token_not_found');
  end if;

  return jsonb_build_object('ok', true, 'email', v_email);
end;
$$;

revoke all on function public.unsubscribe_protectora(text) from public;
grant execute on function public.unsubscribe_protectora(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 6. match_protectoras_for_alert — used by the notify-protectoras edge fn
-- ---------------------------------------------------------------------------
-- Given an alert's coordinates and species, returns the active subscribers
-- whose service zone covers that point (respecting their opt-in preferences
-- and the overflow flag). This function is callable ONLY by service_role,
-- since it returns PII. The edge function uses the service-role key.
-- ---------------------------------------------------------------------------

create or replace function public.match_protectoras_for_alert(
  p_alert_lat   double precision,
  p_alert_lon   double precision,
  p_is_resolved boolean default false
) returns table (
  id                 uuid,
  nombre             text,
  email              text,
  verification_token text,
  digest_diario      boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select ps.id, ps.nombre, ps.email, ps.verification_token, ps.digest_diario
  from public.protector_subscribers ps
  join public.spanish_postal_codes spc on spc.cp = ps.cp_base
  where ps.active = true
    and ps.unsubscribed_at is null
    and (
      (not p_is_resolved and ps.opt_in_perdidos)
      or (p_is_resolved and ps.opt_in_encontrados)
    )
    and st_dwithin(
      st_setsrid(st_makepoint(spc.lon, spc.lat), 4326)::geography,
      st_setsrid(st_makepoint(p_alert_lon, p_alert_lat), 4326)::geography,
      (case when ps.opt_in_overflow_50km
            then greatest(ps.radio_km, 50)
            else ps.radio_km
       end) * 1000.0
    );
$$;

revoke all on function public.match_protectoras_for_alert(double precision, double precision, boolean) from public;
-- Service role only. Edge function uses service_role.
-- (No grant to anon/authenticated.)


-- ---------------------------------------------------------------------------
-- 7. Comments
-- ---------------------------------------------------------------------------

comment on table public.protector_subscribers is
  'Email-only subscription list for animal shelters (protectoras). Receives alert notifications via Resend SMTP when lost/found pets occur within their declared service zone (CP base + radio km).';

comment on table public.spanish_postal_codes is
  'Spanish postal code centroids (lat/lon, city, province) sourced from Geonames.org open data. 11,150 unique CPs covering all of Spain. Used by protectoras to define their service zone, and by the matching RPC to compute distance to alert locations.';

commit;
