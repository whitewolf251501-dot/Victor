-- Migration 20261101000005_memory_knowledge_hardening.sql
-- System 02: Memory & Knowledge hardening with Provenance, Knowledge Documents, and RAG Chunks

-- 1. Extend memories table with provenance, confidence, and embedding metadata
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'memories' AND column_name = 'provenance'
    ) THEN
        ALTER TABLE public.memories
            ADD COLUMN provenance text NOT NULL DEFAULT 'user_stated'
            CHECK (provenance IN ('user_stated', 'inferred', 'external_source', 'system'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'memories' AND column_name = 'confidence'
    ) THEN
        ALTER TABLE public.memories
            ADD COLUMN confidence double precision NOT NULL DEFAULT 1.0
            CHECK (confidence >= 0.0 AND confidence <= 1.0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'memories' AND column_name = 'source_ref'
    ) THEN
        ALTER TABLE public.memories ADD COLUMN source_ref text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'memories' AND column_name = 'embedding_model'
    ) THEN
        ALTER TABLE public.memories ADD COLUMN embedding_model text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'memories' AND column_name = 'embedding_version'
    ) THEN
        ALTER TABLE public.memories ADD COLUMN embedding_version text;
    END IF;
END $$;

-- 2. Knowledge Documents Table (RAG root records)
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    source_uri text,
    mime_type text NOT NULL DEFAULT 'text/plain',
    content_hash text NOT NULL,
    chunk_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Knowledge documents are viewable by owner"
    ON public.knowledge_documents FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Knowledge documents can be inserted by owner"
    ON public.knowledge_documents FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Knowledge documents can be updated by owner"
    ON public.knowledge_documents FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Knowledge documents can be deleted by owner"
    ON public.knowledge_documents FOR DELETE
    USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_owner_hash
    ON public.knowledge_documents(owner_id, content_hash);

-- 3. Knowledge Chunks Table (RAG sliding window chunks with cascade delete)
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    token_count integer NOT NULL DEFAULT 0,
    embedding_model text,
    embedding_version text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Knowledge chunks are viewable by owner"
    ON public.knowledge_chunks FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Knowledge chunks can be inserted by owner"
    ON public.knowledge_chunks FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Knowledge chunks can be updated by owner"
    ON public.knowledge_chunks FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Knowledge chunks can be deleted by owner"
    ON public.knowledge_chunks FOR DELETE
    USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document
    ON public.knowledge_chunks(document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_owner
    ON public.knowledge_chunks(owner_id);
