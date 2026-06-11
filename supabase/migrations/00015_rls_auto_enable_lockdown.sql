-- Lock down rls_auto_enable() — event-trigger helper must not be callable via PostgREST RPC.
-- Migration 00009 included these revokes but Supabase default grants can restore EXECUTE on
-- anon/authenticated after function (re)creation; re-apply explicitly.

revoke all on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
