-- ============================================================================
-- Native push (APNs) support.
--
-- push_subscriptions until now only stored Web Push subscriptions (endpoint +
-- VAPID keys). Native iOS devices register an APNs device token instead. This
-- migration lets the same table hold both, and teaches nearby_push_subscribers
-- to return the platform + token so the edge function picks the right protocol.
-- ============================================================================

begin;

-- New columns: platform tag + the native push token (APNs on iOS; FCM later).
alter table public.push_subscriptions
  add column if not exists platform     text not null default 'web',
  add column if not exists device_token text;

-- Native rows don't have Web Push fields, so they can no longer be NOT NULL.
alter table public.push_subscriptions alter column endpoint drop not null;
alter table public.push_subscriptions alter column p256dh   drop not null;
alter table public.push_subscriptions alter column auth     drop not null;

-- One row per device token (UNIQUE allows the many NULLs from web rows).
alter table public.push_subscriptions
  add constraint push_subscriptions_device_token_key unique (device_token);

-- nearby_push_subscribers: return type changes, so drop + recreate. Now also
-- yields platform + device_token so the edge function can branch web vs APNs.
drop function if exists public.nearby_push_subscribers(double precision, double precision, double precision, uuid);

create function public.nearby_push_subscribers(
  alert_lat        double precision,
  alert_lng        double precision,
  radius_km        double precision default 5,
  exclude_user_id  uuid             default null
)
returns table (
  sub_user_id  uuid,
  platform     text,
  endpoint     text,
  p256dh       text,
  sub_auth     text,
  device_token text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select p.id, ps.platform, ps.endpoint, ps.p256dh, ps.auth, ps.device_token
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

-- Only the edge function (service_role) may call this — same as before.
revoke execute on function public.nearby_push_subscribers(double precision, double precision, double precision, uuid)
  from public, authenticated, anon;
grant  execute on function public.nearby_push_subscribers(double precision, double precision, double precision, uuid)
  to service_role;

commit;
