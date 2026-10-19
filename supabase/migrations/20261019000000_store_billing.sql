-- ============================================================================
-- PetPanic — Cobro en App Store y Google Play (RevenueCat) + prueba de 30 días
--
-- Decisión del 19-10-2026: prueba de 30 días al darte de alta, sin tarjeta, y
-- luego pago (web → Stripe; apps → Apple/Google vía RevenueCat) o se pierde
-- Social. Ver «PetPanic - Plan cobro en tiendas (RevenueCat)» en el vault.
--
-- 1. La prueba de las altas NUEVAS vuelve a 30 días (la 20260506000002 la
--    había bajado a 15). Quien ya existe conserva su trial_ends_at.
-- 2. profiles.billing_source dice quién cobra: 'stripe', 'app_store' o
--    'play_store'. Así la web no ofrece Stripe a quien paga en una tienda y la
--    app no ofrece comprar a quien paga en la web.
-- 3. revenuecat_events: registro de eventos ya procesados, para que un webhook
--    repetido no haga nada la segunda vez.
--
-- Las columnas nuevas NO se conceden a `authenticated` (la 20260506000000
-- revocó el UPDATE de toda la tabla y solo re-concede columnas del usuario),
-- así que solo las escriben los webhooks con la service role.
-- ============================================================================

begin;

-- 1. Prueba de 30 días para las altas nuevas -----------------------------------

alter table public.profiles
  alter column trial_ends_at set default (now() + interval '30 days');

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

-- 2. Quién cobra la suscripción -------------------------------------------------

alter table public.profiles
  add column if not exists billing_source text
    check (billing_source in ('stripe', 'app_store', 'play_store')),
  add column if not exists store_product_id text;

comment on column public.profiles.billing_source
  is 'Quién cobra la suscripción activa: stripe (web), app_store o play_store (RevenueCat). Null mientras no ha pagado nunca.';
comment on column public.profiles.store_product_id
  is 'Producto de la tienda (p. ej. petpanic_social_monthly) cuando cobra Apple o Google.';

update public.profiles
   set billing_source = 'stripe'
 where stripe_subscription_id is not null
   and billing_source is null;

-- 3. Eventos de RevenueCat ya procesados ----------------------------------------

create table if not exists public.revenuecat_events (
  id           text primary key,
  type         text not null,
  app_user_id  text,
  received_at  timestamptz not null default now()
);

alter table public.revenuecat_events enable row level security;
-- Sin políticas: nadie la lee ni la escribe salvo la service role.
revoke all on public.revenuecat_events from anon, authenticated;

comment on table public.revenuecat_events
  is 'Idempotencia del webhook de RevenueCat: un id procesado no se vuelve a aplicar.';

commit;
