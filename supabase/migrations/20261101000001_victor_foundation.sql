-- Migration: 20261101000001_victor_foundation.sql
-- Description: Victor Noctis System 07 Foundation Schema (Profiles, Devices, Conversations, Messages, Memories, Tasks, Operations)

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text NOT NULL DEFAULT 'Victor Owner',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by owner"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Profiles can be updated by owner"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Trigger to handle updated_at for profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger for auto-creating profile when auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', 'Victor Owner')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 2. Devices Table
CREATE TABLE IF NOT EXISTS public.devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('android','web','desktop','tv','watch')),
    name text NOT NULL,
    status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','unknown')),
    last_seen timestamptz,
    enrolled_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devices are viewable by owner"
    ON public.devices FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Devices can be inserted by owner"
    ON public.devices FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Devices can be updated by owner"
    ON public.devices FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Devices can be deleted by owner"
    ON public.devices FOR DELETE
    USING (owner_id = auth.uid());

-- 3. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
    title text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversations are viewable by owner"
    ON public.conversations FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Conversations can be inserted by owner"
    ON public.conversations FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Conversations can be updated by owner"
    ON public.conversations FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Conversations can be deleted by owner"
    ON public.conversations FOR DELETE
    USING (owner_id = auth.uid());

CREATE TRIGGER trigger_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 4. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user','assistant','system')),
    content text NOT NULL,
    device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages are viewable by owner"
    ON public.messages FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Messages can be inserted by owner"
    ON public.messages FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- 5. Memories Table
CREATE TABLE IF NOT EXISTS public.memories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN (
        'fact','goal','dream','project','venture','decision','preference',
        'problem','open_loop','pattern','lesson','relationship',
        'discovery','commitment','instruction'
    )),
    content text NOT NULL,
    importance text NOT NULL DEFAULT 'medium' CHECK (importance IN ('low','medium','high','critical')),
    source text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Memories are viewable by owner"
    ON public.memories FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Memories can be inserted by owner"
    ON public.memories FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Memories can be updated by owner"
    ON public.memories FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Memories can be deleted by owner"
    ON public.memories FOR DELETE
    USING (owner_id = auth.uid());

CREATE TRIGGER trigger_memories_updated_at
    BEFORE UPDATE ON public.memories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 6. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    description text NOT NULL,
    state text NOT NULL DEFAULT 'planned' CHECK (state IN (
        'planned','awaiting_approval','authorized','running',
        'completed','failed','partially_completed','cancelled','blocked'
    )),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks are viewable by owner"
    ON public.tasks FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Tasks can be inserted by owner"
    ON public.tasks FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Tasks can be updated by owner"
    ON public.tasks FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 7. Operations Table
CREATE TABLE IF NOT EXISTS public.operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    capability_id text NOT NULL,
    authority_level integer NOT NULL CHECK (authority_level BETWEEN 0 AND 4),
    state text NOT NULL DEFAULT 'planned',
    params jsonb DEFAULT '{}'::jsonb,
    result jsonb,
    error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operations are viewable by owner"
    ON public.operations FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Operations can be inserted by owner"
    ON public.operations FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Operations can be updated by owner"
    ON public.operations FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trigger_operations_updated_at
    BEFORE UPDATE ON public.operations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 8. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_memories_owner_category ON public.memories (owner_id, category);
CREATE INDEX IF NOT EXISTS idx_memories_owner_importance ON public.memories (owner_id, importance);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_state ON public.tasks (owner_id, state);
CREATE INDEX IF NOT EXISTS idx_devices_owner_status ON public.devices (owner_id, status);
