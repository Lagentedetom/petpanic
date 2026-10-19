-- ============================================================================
-- PetPanic — Denunciar contenido y bloquear usuarios
--
-- Apple (norma 1.2) y Google (política de contenido generado por usuarios)
-- exigen, en cualquier app donde la gente publica cosas que ven otros:
--   · una forma de denunciar contenido ofensivo,
--   · una forma de bloquear a quien molesta,
--   · y que alguien revise las denuncias (Apple pide actuar en 24 horas).
-- En PetPanic lo publicado por usuarios son las alertas (foto y texto) y los
-- mensajes del chat de cada alerta.
--
-- content_reports: solo se puede INSERTAR la denuncia propia; ningún usuario
-- lee las de nadie. Las revisa el equipo con la service role.
-- user_blocks: cada uno ve y gestiona solo sus bloqueos. Los mensajes de un
-- usuario bloqueado dejan de llegar a quien lo ha bloqueado (política de
-- alert_messages), también por Realtime, que respeta la RLS.
-- ============================================================================

begin;

-- 1. Denuncias -------------------------------------------------------------------

create table if not exists public.content_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type  text not null check (target_type in ('alert', 'message', 'user')),
  target_id    text not null,
  reason       text not null check (reason in ('spam', 'offensive', 'fake', 'danger', 'other')),
  details      text check (char_length(details) <= 500),
  status       text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at   timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

alter table public.content_reports enable row level security;

drop policy if exists "reports_insert_own" on public.content_reports;
create policy "reports_insert_own" on public.content_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

revoke all on public.content_reports from anon;
revoke select, update, delete on public.content_reports from authenticated;
grant insert (target_type, target_id, reason, details) on public.content_reports to authenticated;

create index if not exists idx_content_reports_open
  on public.content_reports(created_at) where status = 'open';

comment on table public.content_reports
  is 'Denuncias de contenido (alertas, mensajes, usuarios). Se revisan a diario: Apple exige actuar en 24 h.';

-- 2. Bloqueos ----------------------------------------------------------------------

create table if not exists public.user_blocks (
  blocker_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "blocks_select_own" on public.user_blocks;
create policy "blocks_select_own" on public.user_blocks
  for select to authenticated using (blocker_id = auth.uid());

drop policy if exists "blocks_insert_own" on public.user_blocks;
create policy "blocks_insert_own" on public.user_blocks
  for insert to authenticated with check (blocker_id = auth.uid());

drop policy if exists "blocks_delete_own" on public.user_blocks;
create policy "blocks_delete_own" on public.user_blocks
  for delete to authenticated using (blocker_id = auth.uid());

revoke all on public.user_blocks from anon;
grant select, insert, delete on public.user_blocks to authenticated;

-- 3. Los mensajes de quien has bloqueado ya no te llegan -------------------------

drop policy if exists "messages_select" on public.alert_messages;
create policy "messages_select" on public.alert_messages
  for select
  using (
    (
      exists (
        select 1 from public.alerts a
        where a.id = alert_messages.alert_id
          and (a.status = 'active' or a.owner_id = auth.uid())
      )
      or sender_id = auth.uid()
    )
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = auth.uid()
        and b.blocked_id = alert_messages.sender_id
    )
  );

commit;
