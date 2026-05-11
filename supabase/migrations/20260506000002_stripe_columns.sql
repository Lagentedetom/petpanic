-- ============================================================================
-- PetPanic — Stripe integration columns + 15-day trial
--
-- Adds the Stripe-side identity to profiles so the webhook can match incoming
-- events to a user, plus tracks which plan (monthly/annual) they bought.
-- Also flips the new-user trial default from 30 days to 15 days per product
-- decision (without touching existing users' trial_ends_at).
-- ============================================================================

begin;

-- 1. Stripe identity columns on profiles ----------------------------------

alter table public.profiles
  add column if not exists stripe_customer_id     text unique,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_interval  text check (subscription_interval in ('month', 'year'));

create index if not exists idx_profiles_stripe_customer
  on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists idx_profiles_stripe_subscription
  on public.profiles(stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.profiles.stripe_customer_id
  is 'Stripe Customer ID (cus_xxx). Created on first checkout, persisted across subscriptions.';
comment on column public.profiles.stripe_subscription_id
  is 'Active Stripe Subscription ID (sub_xxx). Null when not subscribed (trial or expired).';
comment on column public.profiles.subscription_interval
  is 'Billing interval of the active subscription: month or year. Null when trialing/expired.';

-- 2. 15-day trial instead of 30 days for NEW signups ----------------------
-- Existing trialing users keep whatever trial_ends_at they have. Only the
-- default for new rows + the trigger fallback change.

alter table public.profiles
  alter column trial_ends_at set default (now() + interval '15 days');

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
    new.trial_ends_at := now() + interval '15 days';
  end if;
  return new;
end;
$$;

-- 3. RLS policy update -----------------------------------------------------
-- The user's column-level UPDATE grant must NOT include stripe_*. Those are
-- managed exclusively by the stripe-webhook edge function (service_role).

revoke update on public.profiles from authenticated;
grant  update (display_name, first_name, last_name, photo_url,
               primary_zone_id, last_location, last_location_at, updated_at)
       on public.profiles to authenticated;

commit;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================
-- 1. New signup gets 15-day trial:
--      INSERT a test profile via the auth.users trigger; check trial_ends_at
--      is ~15 days from now.
-- 2. Authenticated user CANNOT update stripe columns:
--      UPDATE profiles SET subscription_status='active' WHERE id=mine
--      → permission denied for column subscription_status
-- 3. Service-role CAN (used by webhook):
--      UPDATE profiles SET stripe_customer_id='test' WHERE id=...
--      → succeeds.
