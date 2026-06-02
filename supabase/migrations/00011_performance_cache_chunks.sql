-- Split encrypted performance snapshot into small rows to avoid PostgREST
-- statement_timeout (8s) when reading/writing a single ~67MB text column.

alter table public.performance_encrypted_cache
  alter column ciphertext drop not null;

alter table public.performance_encrypted_cache
  add column if not exists storage_format text not null default 'inline';

comment on column public.performance_encrypted_cache.storage_format is
  'inline = legacy single-row ciphertext; chunked = payload in performance_encrypted_cache_chunks';

create table if not exists public.performance_encrypted_cache_chunks (
  cache_id text not null default 'current',
  chunk_index integer not null,
  data text not null,
  primary key (cache_id, chunk_index)
);

create index if not exists performance_encrypted_cache_chunks_cache_idx
  on public.performance_encrypted_cache_chunks (cache_id, chunk_index);

comment on table public.performance_encrypted_cache_chunks is
  'Chunked AES-GCM ciphertext for performance cache (server/service_role only).';

alter table public.performance_encrypted_cache_chunks enable row level security;
