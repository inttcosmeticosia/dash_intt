-- Persist Agente chat sidebar across browsers/devices (was localStorage-only).
create table if not exists public.dashboard_agente_conversations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  conversations jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_agente_conversations enable row level security;

create policy dashboard_agente_conversations_select_own
  on public.dashboard_agente_conversations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy dashboard_agente_conversations_insert_own
  on public.dashboard_agente_conversations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy dashboard_agente_conversations_update_own
  on public.dashboard_agente_conversations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.dashboard_agente_conversations from public, anon;
grant select, insert, update on table public.dashboard_agente_conversations to authenticated;
grant all on table public.dashboard_agente_conversations to service_role;
