create table if not exists public.design_tasks (
  id text primary key,
  title text not null,
  owner text not null check (owner in ('di', 'cai', 'yue')),
  start_date date not null,
  end_date date not null,
  lane integer not null default 1 check (lane between 1 and 7),
  status text not null default 'open' check (status in ('open', 'done', 'leave')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.design_tasks
drop constraint if exists design_tasks_status_check;

alter table public.design_tasks
add constraint design_tasks_status_check
check (status in ('open', 'done', 'leave'));

alter table public.design_tasks enable row level security;

create table if not exists public.design_board_editors (
  email text primary key check (email = lower(email)),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.design_board_members (
  email text primary key check (email = lower(email)),
  display_name text not null default '',
  role text not null default 'viewer',
  access_expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.design_board_members
add column if not exists access_expires_at timestamptz;

create table if not exists public.design_board_keepalive (
  id text primary key default 'keepalive' check (id = 'keepalive'),
  created_at timestamptz not null default now()
);

alter table public.design_board_members
drop constraint if exists design_board_members_role_check;

alter table public.design_board_members
add constraint design_board_members_role_check
check (role in ('viewer', 'editor'));

insert into public.design_board_members (email, display_name, role)
select email, display_name, 'editor'
from public.design_board_editors
on conflict (email) do update
set
  display_name = excluded.display_name,
  role = 'editor';

alter table public.design_board_editors enable row level security;
alter table public.design_board_members enable row level security;
alter table public.design_board_keepalive enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on public.design_tasks from anon;
grant select on public.design_tasks to authenticated;
grant insert, update, delete on public.design_tasks to authenticated;
grant select on public.design_board_editors to authenticated;
grant select on public.design_board_members to authenticated;
grant select on public.design_board_keepalive to anon, authenticated;

create or replace function public.get_design_board_access()
returns table (
  member_role text,
  access_expires_at timestamptz,
  is_active boolean,
  server_now timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    member.role,
    member.access_expires_at,
    member.access_expires_at is null or statement_timestamp() < member.access_expires_at,
    statement_timestamp()
  from public.design_board_members as member
  where member.email = lower(auth.jwt() ->> 'email');
$$;

revoke all on function public.get_design_board_access() from public, anon;
grant execute on function public.get_design_board_access() to authenticated;

drop policy if exists "Allow public task reads" on public.design_tasks;
drop policy if exists "Allow member task reads" on public.design_tasks;
create policy "Allow member task reads"
on public.design_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.design_board_members member
    where member.email = lower(auth.jwt() ->> 'email')
      and (member.access_expires_at is null or now() < member.access_expires_at)
  )
);

drop policy if exists "Allow public task inserts" on public.design_tasks;
drop policy if exists "Allow editor task inserts" on public.design_tasks;
create policy "Allow editor task inserts"
on public.design_tasks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.design_board_members member
    where member.email = lower(auth.jwt() ->> 'email')
      and member.role = 'editor'
      and (member.access_expires_at is null or now() < member.access_expires_at)
  )
);

drop policy if exists "Allow public task updates" on public.design_tasks;
drop policy if exists "Allow editor task updates" on public.design_tasks;
create policy "Allow editor task updates"
on public.design_tasks
for update
to authenticated
using (
  exists (
    select 1
    from public.design_board_members member
    where member.email = lower(auth.jwt() ->> 'email')
      and member.role = 'editor'
      and (member.access_expires_at is null or now() < member.access_expires_at)
  )
)
with check (
  exists (
    select 1
    from public.design_board_members member
    where member.email = lower(auth.jwt() ->> 'email')
      and member.role = 'editor'
      and (member.access_expires_at is null or now() < member.access_expires_at)
  )
);

drop policy if exists "Allow public task deletes" on public.design_tasks;
drop policy if exists "Allow editor task deletes" on public.design_tasks;
create policy "Allow editor task deletes"
on public.design_tasks
for delete
to authenticated
using (
  exists (
    select 1
    from public.design_board_members member
    where member.email = lower(auth.jwt() ->> 'email')
      and member.role = 'editor'
      and (member.access_expires_at is null or now() < member.access_expires_at)
  )
);

drop policy if exists "Allow editors to read own editor record" on public.design_board_editors;
create policy "Allow editors to read own editor record"
on public.design_board_editors
for select
to authenticated
using (email = lower(auth.jwt() ->> 'email'));

drop policy if exists "Allow members to read own member record" on public.design_board_members;
create policy "Allow members to read own member record"
on public.design_board_members
for select
to authenticated
using (email = lower(auth.jwt() ->> 'email'));

drop policy if exists "Allow keepalive reads" on public.design_board_keepalive;
create policy "Allow keepalive reads"
on public.design_board_keepalive
for select
to anon, authenticated
using (true);

insert into public.design_board_keepalive (id)
values ('keepalive')
on conflict (id) do nothing;

-- Add board members after running the schema. Replace these example values
-- with your own member emails inside Supabase SQL Editor; do not commit real
-- emails to a public repository.
-- insert into public.design_board_members (email, display_name, role)
-- values
--   ('viewer@example.com', 'Viewer', 'viewer'),
--   ('designer@example.com', 'Designer', 'editor')
-- on conflict (email) do update
-- set display_name = excluded.display_name,
--     role = excluded.role;

-- To schedule a member's access cutoff, run this separately in Supabase SQL
-- Editor. Keep real member emails out of the repository. The example below
-- stops access at 10:15 China Standard Time on July 31, 2026:
-- update public.design_board_members
-- set access_expires_at = '2026-07-31 10:15:00+08'
-- where email = 'member@example.com';

create or replace function public.set_design_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_design_tasks_updated_at on public.design_tasks;
create trigger set_design_tasks_updated_at
before update on public.design_tasks
for each row
execute function public.set_design_tasks_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.design_tasks;
exception
  when duplicate_object then null;
end;
$$;
