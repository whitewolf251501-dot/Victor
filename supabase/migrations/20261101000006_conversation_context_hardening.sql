-- Migration 20261101000006_conversation_context_hardening.sql
-- System 03: Conversation & Context Hardening with Monotonic Sequences and Safe Summaries

-- 1. Extend messages table with sequence numbering for deterministic ordering
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sequence_number'
    ) THEN
        ALTER TABLE public.messages
            ADD COLUMN sequence_number bigint NOT NULL DEFAULT 1;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sequence
    ON public.messages(conversation_id, sequence_number ASC);

-- 2. Conversation Summaries Table (Cascading with parent conversation)
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    summary text NOT NULL,
    key_decisions text[] NOT NULL DEFAULT '{}',
    open_tasks text[] NOT NULL DEFAULT '{}',
    from_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
    to_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation summaries are viewable by owner"
    ON public.conversation_summaries FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Conversation summaries can be inserted by owner"
    ON public.conversation_summaries FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Conversation summaries can be deleted by owner"
    ON public.conversation_summaries FOR DELETE
    USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conv
    ON public.conversation_summaries(conversation_id, created_at DESC);
