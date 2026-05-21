-- Performance dashboard data (synced from n8n / Revolut finalGrades pipeline)

create table if not exists public.performance_sync_runs (
  id uuid primary key default gen_random_uuid(),
  synced_at timestamptz not null default now(),
  row_count integer not null default 0,
  source text not null default 'n8n'
);

create table if not exists public.performance_records (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid references public.performance_sync_runs (id) on delete set null,
  grade_record_id text unique,
  employee_id text,
  cycle_id text,
  employee_name text,
  cycle_name text,
  department text,
  team text,
  display_grade text,
  line_manager_grade text,
  calculated_grade text,
  absolute_rating text,
  ranking_score numeric,
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists performance_records_cycle_name_idx
  on public.performance_records (cycle_name);

create index if not exists performance_records_department_idx
  on public.performance_records (department);

create index if not exists performance_records_display_grade_idx
  on public.performance_records (display_grade);

create index if not exists performance_records_employee_id_idx
  on public.performance_records (employee_id);

create table if not exists public.saved_metric_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_metric_views_user_id_idx
  on public.saved_metric_views (user_id);

alter table public.performance_sync_runs enable row level security;
alter table public.performance_records enable row level security;
alter table public.saved_metric_views enable row level security;

-- HR analytics: any signed-in user can read performance data
create policy "Authenticated read performance sync runs"
  on public.performance_sync_runs for select
  to authenticated
  using (true);

create policy "Authenticated read performance records"
  on public.performance_records for select
  to authenticated
  using (true);

-- Writes from n8n use the service_role key (bypasses RLS). No insert policy for authenticated.

create policy "Users manage own saved metric views"
  on public.saved_metric_views for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
