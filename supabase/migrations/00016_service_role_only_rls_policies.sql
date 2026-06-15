-- Explicit deny-by-default RLS for API-only tables (service_role bypasses RLS).
-- Clears Supabase linter INFO: rls_enabled_no_policy on tables with no anon/authenticated access.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'audit_log',
    'dashboard_permissions_config',
    'dashboard_users',
    'employees',
    'employees_sync_state',
    'performance_encrypted_cache',
    'performance_encrypted_cache_chunks'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'service role only',
      tbl
    );
    execute format(
      'create policy %I on public.%I for all to authenticated, anon using (false) with check (false)',
      'service role only',
      tbl
    );
  end loop;
end $$;
