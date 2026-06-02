-- Role/page matrix edited from Admin → User management.
-- Express API reads/writes via service_role only.

create table if not exists public.dashboard_permissions_config (
  id text primary key default 'default',
  config jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.dashboard_permissions_config is
  'Role/page matrix for Performance Dashboard. Edited from Admin → User management.';

alter table public.dashboard_permissions_config enable row level security;

-- No policies: service_role only (same pattern as performance_encrypted_cache).

create or replace function public.set_dashboard_permissions_config_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dashboard_permissions_config_updated_at on public.dashboard_permissions_config;
create trigger dashboard_permissions_config_updated_at
  before update on public.dashboard_permissions_config
  for each row execute function public.set_dashboard_permissions_config_updated_at();
