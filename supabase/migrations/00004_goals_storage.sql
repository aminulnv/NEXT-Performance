-- Goals CSV imports (persists across deploys; optional alternative to server/.cache/goals.json)

create table if not exists public.goals_imports (
  id uuid primary key default gen_random_uuid(),
  imported_at timestamptz not null default now(),
  source text not null default 'upload',
  goal_count integer not null default 0,
  columns jsonb not null default '[]'::jsonb,
  column_map jsonb not null default '{}'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  imported_by text
);

create index if not exists goals_imports_imported_at_idx
  on public.goals_imports (imported_at desc);

alter table public.goals_imports enable row level security;

-- API uses service_role for writes; authenticated HR/admin read when using Supabase client later
create policy "HR and admin read goals imports"
  on public.goals_imports for select
  to authenticated
  using (
    public.dashboard_role_for_email(coalesce(auth.jwt() ->> 'email', '')) in ('admin', 'hr')
  );

create policy "Managers read goals imports"
  on public.goals_imports for select
  to authenticated
  using (
    public.dashboard_role_for_email(coalesce(auth.jwt() ->> 'email', '')) = 'manager'
  );
