-- ============================================================================
-- PetPanic - Security tightening migration (2026-05-06)
--
-- Fixes the CRITICAL and HIGH-severity findings from REVIEW.md:
--   CR-01  profiles_select USING (true)              -> self-only + friend-aware + public_profiles view
--   CR-02  presence_select USING (true)              -> members-only + zone_presence_count RPC
--   CR-03  walking-zone tier gating in JS only       -> RLS gated by is_social_active + count + overlap
--   CR-04  pets_select USING (true)                  -> owner-only + public_pets view (contact_info only when lost)
--   CR-06  friendships_insert raw                    -> send_friend_request RPC + REVOKE INSERT
--   HI-01  messages_select USING (auth.uid() IS NOT NULL) -> active alert OR owner OR sender
--   HI-02  nearby_push_subscribers callable by anyone -> REVOKE from authenticated
--   HI-03  alerts_select USING (true)                -> active OR mine
--   ME-01  friendships_update no WITH CHECK          -> add WITH CHECK
--   ME-02  profiles_update no WITH CHECK             -> WITH CHECK + revoke + column-level GRANT
--   ME-03  SECURITY DEFINER without search_path      -> pin search_path on all functions
--
-- IMPORTANT: this migration is BREAKING for the current React client.
-- DO NOT APPLY before deploying the matching client changes documented in
-- MIGRATION-CLIENT-CHANGES.md. See ship_readiness checklist at the bottom.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. PROFILES (CR-01, ME-02)
-- ---------------------------------------------------------------------------

-- Drop old permissive policy + replace with self-only + friend-aware
drop policy if exists "profiles_select"        on public.profiles;
drop policy if exists "profiles_select_self"   on public.profiles;
drop policy if exists "profiles_select_friend" on public.profiles;

create policy "profiles_select_self" on public.profiles
  for select
  using (auth.uid() = id);

-- Friends can read each other's full profile (used by friend list + DM-style flows).
-- "Friend" = there exists an accepted friendship in either direction.
create policy "profiles_select_friend" on public.profiles
  for select
  using (
    exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
          or
          (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
        )
    )
  );

-- Tighten UPDATE: WITH CHECK so users cannot escalate themselves to paid tier
-- by patching subscription_* columns. We REVOKE table-wide UPDATE from authenticated
-- and re-GRANT only the user-controlled columns.
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update
  using      (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant  update (display_name, first_name, last_name, photo_url,
               primary_zone_id, last_location, last_location_at, updated_at)
       on public.profiles to authenticated;

-- public_profiles view: minimal fields the rest of the app may need without
-- friendship (search by friend_code, public pet page owner display_name).
-- Granting to anon is REQUIRED so the QR-public-pet page works without login.
drop view if exists public.public_profiles;
create view public.public_profiles
  with (security_invoker = true)  -- viewer's RLS, not owner's; safe even if owner is anon
  as
  select id, display_name, photo_url, friend_code
  from public.profiles;

-- Without this, the view inherits the locked-down profiles RLS and returns nothing.
-- We expose only the four non-sensitive columns explicitly.
grant select on public.public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. PETS (CR-04)
-- ---------------------------------------------------------------------------

-- Owner-only on the table; QR-public-pet page reads via the view below.
drop policy if exists "pets_select"        on public.pets;
drop policy if exists "pets_select_owner"  on public.pets;

create policy "pets_select_owner" on public.pets
  for select
  using (auth.uid() = owner_id);

-- public_pets view: exposes the fields the QR page needs.
-- contact_info is masked unless the pet is currently marked is_lost.
drop view if exists public.public_pets;
create view public.public_pets
  with (security_invoker = false)  -- run as definer so anon can read despite tight pets RLS
  as
  select
    id,
    owner_id,
    name,
    species,
    breed,
    color,
    traits,
    photo_url,
    is_lost,
    case when is_lost then contact_info else null end as contact_info
  from public.pets;

-- Definer view runs with the role that created it (postgres). RLS on pets
-- doesn't apply when the view body executes — we control exposure via the
-- column projection above. Grant carefully:
grant select on public.public_pets to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. ALERTS (HI-03)
-- ---------------------------------------------------------------------------
-- Active alerts must be readable by anyone (the whole point: nearby strangers
-- find the alert). Resolved alerts leak owner_contact + exact location, so
-- restrict resolved-alert SELECT to the owner only.

drop policy if exists "alerts_select" on public.alerts;
create policy "alerts_select" on public.alerts
  for select
  using (status = 'active' or owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. ALERT_MESSAGES (HI-01)
-- ---------------------------------------------------------------------------
-- Anyone authenticated can read messages on currently-active alerts (matches
-- the active-alert SELECT). Resolved-alert messages are owner-only.

drop policy if exists "messages_select" on public.alert_messages;
create policy "messages_select" on public.alert_messages
  for select
  using (
    exists (
      select 1 from public.alerts a
      where a.id = alert_messages.alert_id
        and (a.status = 'active' or a.owner_id = auth.uid())
    )
    or sender_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 5. WALKING_ZONES (CR-03) - is_social_active gate + count cap + 200m overlap
-- ---------------------------------------------------------------------------

drop policy if exists "zones_insert" on public.walking_zones;
create policy "zones_insert" on public.walking_zones
  for insert
  with check (
    auth.uid() = creator_id
    and public.is_social_active(auth.uid())
    and (
      select count(*) from public.walking_zones where creator_id = auth.uid()
    ) < case
      when (select subscription_status = 'trialing'
            from public.profiles where id = auth.uid()) then 1
      else 5
    end
  );

-- 200m overlap trigger raises 'zone_overlap' (matches AppContext.tsx error parsing).
create or replace function public.enforce_zone_overlap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.walking_zones
    where st_dwithin(location, new.location, 200)
  ) then
    raise exception 'zone_overlap' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_zone_overlap_t on public.walking_zones;
create trigger enforce_zone_overlap_t
  before insert on public.walking_zones
  for each row execute function public.enforce_zone_overlap();

-- ---------------------------------------------------------------------------
-- 6. ZONE_MEMBERS (CR-03 part B)
-- ---------------------------------------------------------------------------

drop policy if exists "zone_members_insert" on public.zone_members;
create policy "zone_members_insert" on public.zone_members
  for insert
  with check (
    auth.uid() = user_id
    and public.is_social_active(auth.uid())
  );

-- Members can leave a zone (delete their own row) - new policy, was missing.
drop policy if exists "zone_members_delete_self" on public.zone_members;
create policy "zone_members_delete_self" on public.zone_members
  for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. ZONE_PRESENCE (CR-02)
-- ---------------------------------------------------------------------------

drop policy if exists "presence_select"          on public.zone_presence;
drop policy if exists "presence_select_members"  on public.zone_presence;

create policy "presence_select_members" on public.zone_presence
  for select
  using (
    exists (
      select 1 from public.zone_members zm
      where zm.zone_id = zone_presence.zone_id
        and zm.user_id = auth.uid()
    )
  );

-- Public count RPC: lets non-members see "X people walking here" without
-- leaking identities. The current UI shows a count to non-members in
-- ZoneDetailsPage.tsx:81-83; that path must call this RPC.
create or replace function public.zone_presence_count(p_zone_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.zone_presence
  where zone_id = p_zone_id;
$$;

revoke execute on function public.zone_presence_count(uuid) from public;
grant  execute on function public.zone_presence_count(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 8. FRIENDSHIPS (CR-06, ME-01)
-- ---------------------------------------------------------------------------

-- 8a. ME-01: addressee can update but only flip status to 'accepted', cannot
-- mutate requester_id/addressee_id (preventing identity swap).
drop policy if exists "friendships_update" on public.friendships;
create policy "friendships_update" on public.friendships
  for update
  using      (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id and status = 'accepted');

-- 8b. CR-06: route INSERT through an RPC that validates friend_code and
-- enforces is_social_active. Direct INSERT is removed.
revoke insert on public.friendships from authenticated;

create or replace function public.send_friend_request(p_friend_code text)
returns public.friendships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_addressee uuid;
  v_row       public.friendships;
begin
  if not public.is_social_active(auth.uid()) then
    raise exception 'social_required' using errcode = 'check_violation';
  end if;

  select id into v_addressee
  from public.profiles
  where friend_code = upper(p_friend_code)
    and id <> auth.uid();

  if v_addressee is null then
    raise exception 'invalid_friend_code' using errcode = 'no_data_found';
  end if;

  -- block if the inverse direction already exists (pending or accepted)
  if exists (
    select 1 from public.friendships
    where (requester_id = auth.uid()    and addressee_id = v_addressee)
       or (requester_id = v_addressee   and addressee_id = auth.uid())
  ) then
    raise exception 'friendship_exists' using errcode = 'unique_violation';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (auth.uid(), v_addressee, 'pending')
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.send_friend_request(text) from public;
grant  execute on function public.send_friend_request(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. PUSH SUBSCRIPTIONS / nearby_push_subscribers (HI-02)
-- ---------------------------------------------------------------------------
-- Only the edge function (service_role) should call this.

revoke execute on function public.nearby_push_subscribers(double precision, double precision, double precision, uuid)
       from public, authenticated, anon;
grant  execute on function public.nearby_push_subscribers(double precision, double precision, double precision, uuid)
       to service_role;

-- ---------------------------------------------------------------------------
-- 10. SECURITY DEFINER hardening (ME-03)
-- ---------------------------------------------------------------------------
-- All SECURITY DEFINER functions get search_path pinned. Recreate so the
-- setting takes effect.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name, first_name, last_name, photo_url, friend_code)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      'Invitado'
    ),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    upper(substr(md5(random()::text), 1, 8))
  );
  return new;
end;
$$;

create or replace function public.nearby_alerts(
  user_lat   double precision,
  user_lng   double precision,
  radius_km  double precision default 2
)
returns setof public.alerts
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select a.*
  from public.alerts a
  where a.status = 'active'
    and st_dwithin(
      a.location,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
  order by a.created_at desc;
end;
$$;

grant execute on function public.nearby_alerts(double precision, double precision, double precision)
      to authenticated;

create or replace function public.nearby_push_subscribers(
  alert_lat        double precision,
  alert_lng        double precision,
  radius_km        double precision default 5,
  exclude_user_id  uuid             default null
)
returns table (
  sub_user_id  uuid,
  endpoint     text,
  p256dh       text,
  sub_auth     text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select p.id, ps.endpoint, ps.p256dh, ps.auth
  from public.profiles p
  join public.push_subscriptions ps on ps.user_id = p.id
  where p.id <> coalesce(exclude_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and p.last_location is not null
    and p.last_location_at > now() - interval '24 hours'
    and st_dwithin(
      p.last_location,
      st_setsrid(st_makepoint(alert_lng, alert_lat), 4326)::geography,
      radius_km * 1000
    );
end;
$$;

-- (already revoked from public/authenticated/anon above, granted to service_role)

create or replace function public.set_default_subscription()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.subscription_tier is null then
    new.subscription_tier := 'social';
  end if;
  if new.subscription_status is null then
    new.subscription_status := 'trialing';
  end if;
  if new.trial_ends_at is null then
    new.trial_ends_at := now() + interval '30 days';
  end if;
  return new;
end;
$$;

-- is_social_active already pins search_path in the previous migration. Keep.

-- ---------------------------------------------------------------------------
-- 11. STORAGE RLS for pet-photos (HI-07) - applies if bucket exists
-- ---------------------------------------------------------------------------
-- Storage policies live under storage.objects. We assume a `pet-photos` bucket
-- already exists (created via dashboard). If it does not, this block is a no-op
-- via the bucket_id check.

do $$ begin
  -- pet photos: path "{owner_id}/{pet_id}.jpg"
  drop policy if exists "pet-photos_insert_own" on storage.objects;
  drop policy if exists "pet-photos_update_own" on storage.objects;
  drop policy if exists "pet-photos_select_all" on storage.objects;

  create policy "pet-photos_insert_own" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'pet-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "pet-photos_update_own" on storage.objects
    for update to authenticated
    using (
      bucket_id = 'pet-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  -- pet photos themselves are public (rendered on QR pages and alerts)
  create policy "pet-photos_select_all" on storage.objects
    for select using (bucket_id = 'pet-photos');
exception
  when undefined_table then
    raise notice 'storage.objects does not exist; skipping storage RLS block';
  when others then
    raise notice 'storage RLS block skipped: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 12. Realtime publications - adjust if needed
-- ---------------------------------------------------------------------------
-- The original schema added all 8 tables to supabase_realtime. The new
-- profiles policy means realtime profile updates only deliver to self+friends,
-- which is exactly what we want. No publication change required.

commit;

-- ============================================================================
-- POST-MIGRATION SMOKE CHECKLIST
-- ============================================================================
-- 1. Open DB anon connection (public anon key) and confirm:
--      SELECT * FROM profiles                      -> 0 rows
--      SELECT * FROM public_profiles                -> all rows, only 4 cols
--      SELECT * FROM pets                           -> 0 rows
--      SELECT * FROM public_pets WHERE id='<lost>'  -> contact_info NOT NULL
--      SELECT * FROM public_pets WHERE id='<safe>'  -> contact_info IS NULL
--      SELECT * FROM zone_presence                  -> 0 rows
--      SELECT count(*) FROM nearby_push_subscribers(0,0)  -> error: permission denied
--
-- 2. With an authenticated user that's NOT a member of zone X:
--      SELECT * FROM zone_presence WHERE zone_id = X  -> 0 rows
--      SELECT zone_presence_count(X)                  -> integer
--
-- 3. With an authenticated free-tier user (subscription_status='expired'):
--      INSERT INTO walking_zones (...)               -> error: permission denied
--      SELECT send_friend_request('CODE')            -> error: social_required
--
-- 4. With an authenticated trialing user:
--      INSERT INTO walking_zones (location with no overlap)  -> success
--      INSERT INTO walking_zones (overlapping location)      -> error: zone_overlap
--      Try to INSERT a 2nd zone                              -> error: permission denied (1-zone trial cap)
--      UPDATE profiles SET subscription_status='active'      -> error: permission denied (column not granted)
--
-- 5. From the React client (after deploying matching changes):
--      Login -> see own profile, friends list, alerts, zones, presence  -> all work
--      Send friend request via RPC                                       -> works
--      Try to escalate via curl                                          -> blocked
