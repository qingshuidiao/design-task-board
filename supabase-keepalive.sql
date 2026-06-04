create table if not exists public.design_board_keepalive (
  id text primary key default 'keepalive' check (id = 'keepalive'),
  created_at timestamptz not null default now()
);

alter table public.design_board_keepalive enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.design_board_keepalive to anon, authenticated;

drop policy if exists "Allow keepalive reads" on public.design_board_keepalive;
create policy "Allow keepalive reads"
on public.design_board_keepalive
for select
to anon, authenticated
using (true);

insert into public.design_board_keepalive (id)
values ('keepalive')
on conflict (id) do nothing;
