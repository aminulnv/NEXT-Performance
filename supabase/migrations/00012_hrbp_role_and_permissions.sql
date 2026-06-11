-- Allow custom roles (e.g. hrbp) on dashboard_users.
alter table public.dashboard_users
  drop constraint if exists dashboard_users_role_check;

comment on column public.dashboard_users.role is
  'Role id from dashboard_permissions_config (admin, hr, manager, executive, hrbp, or custom).';
