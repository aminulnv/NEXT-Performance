-- Revolut People directory (synced from /employees on cache refresh).
-- Express API uses service_role for reads/writes; RLS blocks direct client access.

create table if not exists public.employees (
  id text primary key,
  remote_id text,
  name text not null,
  email text,
  department text,
  team text,
  status text,
  line_manager_id text,
  line_manager_name text,
  line_manager_email text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employees_email_idx on public.employees (lower(email));
create index if not exists employees_department_idx on public.employees (department);
create index if not exists employees_status_idx on public.employees (status);
create index if not exists employees_name_idx on public.employees (name);
create index if not exists employees_synced_at_idx on public.employees (synced_at desc);

comment on table public.employees is
  'Revolut People directory snapshot. Synced by the Express API on cache refresh.';

create table if not exists public.employees_sync_state (
  id text primary key default 'current',
  synced_at timestamptz not null default now(),
  employee_count integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.employees_sync_state is
  'Metadata for the latest Revolut employee directory sync.';

alter table public.employees enable row level security;
alter table public.employees_sync_state enable row level security;

-- No policies for anon/authenticated: Express API uses service_role (bypasses RLS).

create or replace function public.set_employees_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at
  before update on public.employees
  for each row execute function public.set_employees_updated_at();

drop trigger if exists employees_sync_state_updated_at on public.employees_sync_state;
create trigger employees_sync_state_updated_at
  before update on public.employees_sync_state
  for each row execute function public.set_employees_updated_at();
