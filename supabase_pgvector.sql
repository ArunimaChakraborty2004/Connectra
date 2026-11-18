-- =============================================================================
-- Connectra PostgreSQL pgvector Semantic Retrieval Migration
-- Run this in your Supabase SQL Editor: Dashboard -> SQL Editor -> New Query
-- =============================================================================

-- 1. Enable the pgvector extension for dense vector storage & indexing
create extension if not exists vector;

-- 2. Create the document embeddings table for semantic nearest-neighbor retrieval
create table if not exists public.documents_embeddings (
  id text primary key,
  title text not null,
  content text not null,
  type text default 'discussion', -- 'discussion' | 'post' | 'project' | 'doc' | 'security'
  metadata jsonb default '{}'::jsonb,
  embedding vector(384),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
alter table public.documents_embeddings enable row level security;

-- Allow public read access to embeddings for fast client-side RAG retrieval
create policy "Allow public read access on documents_embeddings"
  on public.documents_embeddings
  for select
  using (true);

-- Allow authenticated users to insert / update embeddings
create policy "Allow authenticated insert/update on documents_embeddings"
  on public.documents_embeddings
  for all
  using (auth.role() = 'authenticated');

-- 3. Create High-Performance HNSW (Hierarchical Navigable Small World) Index
-- HNSW provides sub-millisecond approximate nearest neighbor (ANN) lookups
create index if not exists documents_embeddings_hnsw_idx 
on public.documents_embeddings 
using hnsw (embedding vector_cosine_ops);

-- 4. Create the match_documents RPC function for cosine similarity search
create or replace function public.match_documents (
  query_embedding vector(384),
  match_threshold float default 0.35,
  match_count int default 5
)
returns table (
  id text,
  title text,
  content text,
  type text,
  metadata jsonb,
  similarity float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    documents_embeddings.id,
    documents_embeddings.title,
    documents_embeddings.content,
    documents_embeddings.type,
    documents_embeddings.metadata,
    1 - (documents_embeddings.embedding <=> query_embedding) as similarity
  from public.documents_embeddings
  where 1 - (documents_embeddings.embedding <=> query_embedding) > match_threshold
  order by documents_embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 5. Seed Initial Knowledge Base Chunks into pgvector Store
-- (Populates initial system architecture, zero-trust policies, and developer guides)
insert into public.documents_embeddings (id, title, content, type, metadata)
values
  (
    'kb-connectra-arch',
    'Connectra Distributed Architecture & Realtime Stack',
    'Connectra is built on a high-availability React 19 architecture with Supabase PostgreSQL for persistence, realtime presence subscriptions, row-level security (RLS) policies, and Groq-powered multi-agent LLM inference. All client interactions support optimistic UI caching and offline localStorage sync.',
    'doc',
    '{"category": "architecture", "verified": true}'::jsonb
  ),
  (
    'kb-security-owasp',
    'Application Security & OWASP Top 10 Guidelines',
    'Connectra employs automated static application security testing (LLM-SAST) pipelines with dual-agent generator-critic verification. Inputs undergo secret redaction, SQL injection prevention via parameterized queries, cryptographic token validation, and zero-trust content guardrails.',
    'security',
    '{"category": "security", "verified": true}'::jsonb
  ),
  (
    'kb-pgvector-guide',
    'Supabase pgvector Semantic Nearest-Neighbor Retrieval',
    'pgvector allows dense vector embeddings (cosine distance <=>) to be indexed with HNSW indexes inside PostgreSQL. Connectra Copilot uses this vector store to ground technical responses with sub-millisecond semantic retrieval across code snippets, projects, and discussions.',
    'doc',
    '{"category": "vector_search", "verified": true}'::jsonb
  )
on conflict (id) do update set
  title = excluded.title,
  content = excluded.content,
  type = excluded.type,
  metadata = excluded.metadata;
