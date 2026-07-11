-- Embeddings support for dataset similarity search and chat memory.
-- Uses 384-dim vectors (Supabase Edge Runtime's built-in gte-small model).

create extension if not exists vector;

-- Datasets get an embedding of their schema/sample so similar_datasets can match on it.
alter table public.datasets add column if not exists embedding vector(384);

create index if not exists datasets_embedding_idx
  on public.datasets using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Analyses persist the (currently client-generated) analysis result so the chat
-- assistant can retrieve relevant past analyses as "memory".
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  owner_token text not null,
  filename text,
  executive_summary text not null,
  analysis_json jsonb not null,
  embedding vector(384),
  created_at timestamptz not null default now()
);

create index if not exists analyses_embedding_idx
  on public.analyses using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index if not exists analyses_owner_token_idx on public.analyses (owner_token);
create index if not exists analyses_dataset_id_idx on public.analyses (dataset_id);

alter table public.analyses enable row level security;

-- Mirrors the owner_token / x-owner-token header pattern already used for `datasets`.
drop policy if exists "analyses_insert_own" on public.analyses;
create policy "analyses_insert_own" on public.analyses
  for insert
  with check (owner_token = coalesce(current_setting('request.headers', true)::json ->> 'x-owner-token', ''));

drop policy if exists "analyses_select_own" on public.analyses;
create policy "analyses_select_own" on public.analyses
  for select
  using (owner_token = coalesce(current_setting('request.headers', true)::json ->> 'x-owner-token', ''));

-- Cross-owner similarity search over indexed datasets (public discovery), called
-- only from the embed-content edge function (service role).
create or replace function public.match_similar_datasets(
  query_embedding vector(384),
  match_count int default 5,
  exclude_id uuid default null
)
returns table (
  dataset_id uuid,
  filename text,
  row_count int,
  col_count int,
  similarity float
)
language sql
security definer
set search_path = public
as $$
  select
    d.id as dataset_id,
    d.filename,
    d.row_count,
    d.col_count,
    1 - (d.embedding <=> query_embedding) as similarity
  from datasets d
  where d.embedding is not null
    and (exclude_id is null or d.id <> exclude_id)
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- Owner-scoped retrieval of past analyses for chat "memory".
create or replace function public.match_analyses(
  query_embedding vector(384),
  match_count int default 3,
  owner_token_filter text default null
)
returns table (
  analysis_id uuid,
  dataset_id uuid,
  filename text,
  similarity float,
  snippet text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    a.id as analysis_id,
    a.dataset_id,
    a.filename,
    1 - (a.embedding <=> query_embedding) as similarity,
    left(a.executive_summary, 240) as snippet,
    a.created_at
  from analyses a
  where a.embedding is not null
    and (owner_token_filter is null or a.owner_token = owner_token_filter)
  order by a.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_similar_datasets(vector, int, uuid) to anon, authenticated, service_role;
grant execute on function public.match_analyses(vector, int, text) to anon, authenticated, service_role;
