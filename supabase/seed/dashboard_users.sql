-- Run once in Supabase SQL Editor after migrations (or use npm run access:migrate-supabase)

insert into public.dashboard_users (email, role, name, employee_id)
values
  ('hr-analytics@nextventures.io', 'admin', 'HR Analytics', null)
on conflict (email) do update set
  role = excluded.role,
  name = excluded.name,
  employee_id = excluded.employee_id,
  updated_at = now();
