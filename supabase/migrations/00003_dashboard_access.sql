-- Dashboard access control (replaces server/data/access.json in production)

create table if not exists public.dashboard_users (
  email text primary key,
  role text not null check (role in ('admin', 'hr', 'manager', 'executive')),
  name text,
  employee_id text,
  auth_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboard_users_role_idx on public.dashboard_users (role);
create index if not exists dashboard_users_auth_user_id_idx on public.dashboard_users (auth_user_id);

comment on table public.dashboard_users is
  'Allowlist and roles for Performance Dashboard. Managed via API (service role) or Admin UI.';

alter table public.dashboard_users enable row level security;

-- No policies for anon/authenticated: Express API uses service_role (bypasses RLS).
-- Optional: link Supabase Auth user on first Google login via trigger later.

create or replace function public.set_dashboard_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dashboard_users_updated_at on public.dashboard_users;
create trigger dashboard_users_updated_at
  before update on public.dashboard_users
  for each row execute function public.set_dashboard_users_updated_at();

-- Role helper for future direct Supabase client reads
create or replace function public.dashboard_role_for_email(user_email text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.dashboard_users
  where lower(email) = lower(trim(user_email))
  limit 1;
$$;

grant execute on function public.dashboard_role_for_email(text) to authenticated;
grant execute on function public.dashboard_role_for_email(text) to service_role;
