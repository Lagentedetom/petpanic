-- Hotfix for the security tightening migration applied minutes earlier:
-- public_profiles was created with security_invoker=true, which made it
-- inherit the locked-down RLS on `profiles` and return 0 rows for both anon
-- and non-friend authenticated callers. That breaks:
--   - PublicPetPage owner display_name lookup (anon QR flow)
--   - Friend-search by friend_code in AppContext (authenticated, not yet friend)
--
-- Recreate as security_invoker=false (= definer): view body runs as postgres,
-- bypassing RLS on the underlying table. Exposure is column-level by the
-- explicit projection (only id, display_name, photo_url, friend_code) — no
-- sensitive fields leak. The GRANT controls who can call.
--
-- Known trade-off (documented for future hardening pass): friend_code
-- enumeration is technically possible via SELECT friend_code FROM
-- public_profiles. send_friend_request RPC already gates on
-- is_social_active(), so abusing this requires a paid Social account,
-- bounding spam vector. Re-evaluate when user base grows past closed-test.

drop view if exists public.public_profiles;

create view public.public_profiles
  with (security_invoker = false)
  as
  select id, display_name, photo_url, friend_code
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;
