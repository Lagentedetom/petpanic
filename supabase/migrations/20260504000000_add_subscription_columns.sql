-- ============================================================================
-- PetPanic Social — subscription state on profiles
--
-- Adds the four columns the client (`useSubscription` hook) reads to gate
-- access to walking-zone create/join. Without these columns every user
-- defaults to `tier='free'` / `status='expired'` and the whole social layer
-- is locked out.
--
-- Launch policy: every user (existing + new) gets a 30-day Social trial
-- starting now, in line with the "Social desde día 1" decision recorded in
-- `PetPanic - Sesión 2026-04-15.md` §13.
-- ============================================================================

-- Enums --------------------------------------------------------------------
do $$ begin
  create type public.subscription_tier as enum ('free', 'social');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('trialing', 'active', 'canceled', 'expired');
exception when duplicate_object then null; end $$;

-- Columns ------------------------------------------------------------------
alter table public.profiles
  add column if not exists subscription_tier   public.subscription_tier   not null default 'social',
  add column if not exists subscription_status public.subscription_status not null default 'trialing',
  add column if not exists trial_ends_at       timestamptz                         default (now() + interval '30 days'),
  add column if not exists current_period_end  timestamptz;

comment on column public.profiles.subscription_tier
  is 'Active product tier. ''free'' = essentials only, ''social'' = walking-zone social layer.';
comment on column public.profiles.subscription_status
  is 'Lifecycle of the current subscription period. ''trialing'' during the 30-day intro, ''active'' once paid, ''canceled'' or ''expired'' once it lapses.';
comment on column public.profiles.trial_ends_at
  is 'When the 30-day Social trial ends. NULL once the user has converted to paid.';
comment on column public.profiles.current_period_end
  is 'When the current paid billing period ends. NULL while trialing.';

-- Backfill existing accounts ----------------------------------------------
-- Anyone created before this migration also gets a fresh 30-day Social trial.
update public.profiles
   set subscription_tier   = 'social',
       subscription_status = 'trialing',
       trial_ends_at       = now() + interval '30 days'
 where subscription_tier is null
    or subscription_status is null
    or trial_ends_at      is null;

-- New-account trigger -----------------------------------------------------
-- Whenever a new profile row is inserted (typically from the
-- `handle_new_user` trigger that runs after auth.users insert), make sure
-- the trial fields are populated even if the inserter omitted them.
create or replace function public.set_default_subscription()
returns trigger
language plpgsql
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

drop trigger if exists set_default_subscription_trigger on public.profiles;
create trigger set_default_subscription_trigger
  before insert on public.profiles
  for each row
  execute function public.set_default_subscription();

-- Helper: is_social_active --------------------------------------------------
-- Single source of truth for "can this user use Social features right now",
-- consumed by RLS policies on walking_zones / zone_members / zone_presence.
create or replace function public.is_social_active(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        p.subscription_tier = 'social'
        and (
          (p.subscription_status = 'trialing' and p.trial_ends_at      > now())
          or
          (p.subscription_status = 'active'   and (p.current_period_end is null or p.current_period_end > now()))
        )
      from public.profiles p
      where p.id = p_user
    ),
    false
  );
$$;

comment on function public.is_social_active(uuid)
  is 'Returns true while a user has access to Social features (trial or active paid). Used by RLS gating on walking_zones / zone_members.';

grant execute on function public.is_social_active(uuid) to authenticated;
