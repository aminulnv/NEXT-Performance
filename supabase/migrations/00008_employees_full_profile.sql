-- Expand Revolut employee directory with full profile fields from /employees API.

alter table public.employees
  add column if not exists full_name text,
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists last_name text,
  add column if not exists avatar text,
  add column if not exists location text,
  add column if not exists entity text,
  add column if not exists joining_date_time text,
  add column if not exists termination_date_time text,
  add column if not exists updated_date_time text,
  add column if not exists inactivity_reason text,
  add column if not exists specialisation text,
  add column if not exists seniority text,
  add column if not exists candidate_id text,
  add column if not exists profile jsonb;

create index if not exists employees_joining_date_idx on public.employees (joining_date_time);
create index if not exists employees_seniority_idx on public.employees (seniority);
create index if not exists employees_specialisation_idx on public.employees (specialisation);

comment on column public.employees.profile is
  'Full Revolut /employees API object for fields not flattened into columns.';
