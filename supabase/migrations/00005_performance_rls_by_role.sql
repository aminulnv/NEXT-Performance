-- Tighter RLS on performance data when using Supabase Auth JWT (optional path).
-- Express API with service_role still bypasses RLS for server-side filtering.

drop policy if exists "Authenticated read performance sync runs" on public.performance_sync_runs;
drop policy if exists "Authenticated read performance records" on public.performance_records;

create policy "Dashboard users read performance sync runs"
  on public.performance_sync_runs for select
  to authenticated
  using (
    public.dashboard_role_for_email(coalesce(auth.jwt() ->> 'email', '')) is not null
  );

create policy "Dashboard users read performance records"
  on public.performance_records for select
  to authenticated
  using (
    public.dashboard_role_for_email(coalesce(auth.jwt() ->> 'email', '')) is not null
  );

-- Executives/managers: additional row filters should stay in Express API for now (payload shape).
