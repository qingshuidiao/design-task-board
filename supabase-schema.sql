create table if not exists public.design_tasks (
  id text primary key,
  title text not null,
  owner text not null check (owner in ('di', 'cai', 'yue')),
  start_date date not null,
  end_date date not null,
  lane integer not null default 1 check (lane between 1 and 7),
  status text not null default 'open' check (status in ('open', 'done')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.design_tasks enable row level security;

drop policy if exists "Allow public task reads" on public.design_tasks;
create policy "Allow public task reads"
on public.design_tasks
for select
to anon
using (true);

drop policy if exists "Allow public task inserts" on public.design_tasks;
create policy "Allow public task inserts"
on public.design_tasks
for insert
to anon
with check (true);

drop policy if exists "Allow public task updates" on public.design_tasks;
create policy "Allow public task updates"
on public.design_tasks
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow public task deletes" on public.design_tasks;
create policy "Allow public task deletes"
on public.design_tasks
for delete
to anon
using (true);

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

insert into public.design_tasks (id, title, owner, start_date, end_date, lane, status, note)
values
  ('task-asset-migration', '设计资产迁移、导入', 'di', '2026-05-18', '2026-05-19', 1, 'done', '设计资产梳理与导入验证'),
  ('task-new-tool', '新工具', 'di', '2026-05-20', '2026-05-20', 1, 'open', ''),
  ('task-recruit-review', '招招-预约面试-需求评审', 'di', '2026-05-21', '2026-05-21', 1, 'open', ''),
  ('task-recruit-interview', '招招-预约面试', 'di', '2026-05-22', '2026-05-22', 1, 'open', ''),
  ('task-basic-review-di', '人员基本信息-评审', 'di', '2026-05-19', '2026-05-19', 2, 'done', ''),
  ('task-codex-ip', 'codex - IP', 'di', '2026-05-20', '2026-05-22', 2, 'open', ''),
  ('task-people-info', '人员信息', 'cai', '2026-05-18', '2026-05-18', 4, 'done', ''),
  ('task-basic-review-cai', '人员基本信息-评审', 'cai', '2026-05-19', '2026-05-19', 4, 'done', ''),
  ('task-codex', 'codex', 'cai', '2026-05-20', '2026-05-20', 4, 'open', ''),
  ('task-component-learning', '新工具+组件库学习', 'cai', '2026-05-21', '2026-05-22', 4, 'open', ''),
  ('task-daily-words', '每日心语-6月', 'cai', '2026-05-18', '2026-05-21', 5, 'open', ''),
  ('task-ui-review-old', 'UI复验-学习平台3.0', 'cai', '2026-05-18', '2026-05-18', 6, 'open', ''),
  ('task-ui-review-new', 'UI复验-学习平台3.0', 'cai', '2026-05-19', '2026-05-19', 6, 'open', '')
on conflict (id) do nothing;
