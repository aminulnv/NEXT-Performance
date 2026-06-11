-- Security audit trail for logins, admin actions, and sensitive data operations.
-- Written by the Express API (service role); no anon/authenticated policies.

create table if not exists public.audit_log (
  id bigserial primary key,
  request_id uuid not null default gen_random_uuid(),
  action text not null,
  actor_email text,
  actor_role text,
  target text,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action);
create index if not exists audit_log_actor_email_idx on public.audit_log (actor_email);

comment on table public.audit_log is
  'Security audit events: auth, access control, permissions, and data operations.';

alter table public.audit_log enable row level security;
