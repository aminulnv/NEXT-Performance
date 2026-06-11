-- Per-user department scope (HRBPs see only assigned departments).
alter table public.dashboard_users
  add column if not exists scoped_departments text[] default null;

comment on column public.dashboard_users.scoped_departments is
  'When set, user sees goals/employee data only for these department names (HRBP).';
