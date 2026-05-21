-- Encrypted Revolut performance snapshot (server decrypts with PERFORMANCE_DATA_ENCRYPTION_KEY).
-- No plaintext performance rows; service_role only (Express API).

create table if not exists public.performance_encrypted_cache (
  id text primary key default 'current',
  synced_at timestamptz not null default now(),
  record_count integer not null default 0,
  encryption_version smallint not null default 1,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

comment on table public.performance_encrypted_cache is
  'AES-256-GCM encrypted JSON snapshot of performance records; readable only by the API server.';

alter table public.performance_encrypted_cache enable row level security;

-- No policies: authenticated clients cannot read ciphertext. Server uses service_role.
