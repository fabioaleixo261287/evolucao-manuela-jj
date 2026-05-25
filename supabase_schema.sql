create table if not exists public.app_state (
    id text primary key,
    students jsonb not null default '[]'::jsonb,
    repo jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Allow app read" on public.app_state;
create policy "Allow app read"
on public.app_state
for select
to anon
using (true);

drop policy if exists "Allow app insert" on public.app_state;
create policy "Allow app insert"
on public.app_state
for insert
to anon
with check (true);

drop policy if exists "Allow app update" on public.app_state;
create policy "Allow app update"
on public.app_state
for update
to anon
using (true)
with check (true);
