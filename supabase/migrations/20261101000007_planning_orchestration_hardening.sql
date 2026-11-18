-- Migration: 20261101000007_planning_orchestration_hardening.sql
-- Description: System 04 Planning & Orchestration Schema (Plans, Plan Steps, Plan Events)

-- 1. Plans Table
CREATE TABLE IF NOT EXISTS public.plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    goal text NOT NULL,
    state text NOT NULL DEFAULT 'draft' CHECK (state IN (
        'draft', 'validated', 'executing', 'paused', 'completed', 'failed', 'cancelled'
    )),
    error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans viewable by owner"
    ON public.plans FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Plans insertable by owner"
    ON public.plans FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Plans updatable by owner"
    ON public.plans FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Plans deletable by owner"
    ON public.plans FOR DELETE
    USING (owner_id = auth.uid());

CREATE TRIGGER trigger_plans_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 2. Plan Steps Table
CREATE TABLE IF NOT EXISTS public.plan_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    capability_id text NOT NULL,
    authority_level integer NOT NULL CHECK (authority_level BETWEEN 0 AND 4),
    params jsonb DEFAULT '{}'::jsonb,
    dependencies jsonb DEFAULT '[]'::jsonb,
    state text NOT NULL DEFAULT 'pending' CHECK (state IN (
        'pending', 'ready', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled', 'skipped'
    )),
    idempotency_key text NOT NULL,
    retry_count integer NOT NULL DEFAULT 0,
    max_retries integer NOT NULL DEFAULT 3,
    timeout_ms integer,
    approval_id uuid REFERENCES public.pending_approvals(id) ON DELETE SET NULL,
    result jsonb,
    error text,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan steps viewable by owner"
    ON public.plan_steps FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Plan steps insertable by owner"
    ON public.plan_steps FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Plan steps updatable by owner"
    ON public.plan_steps FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Plan steps deletable by owner"
    ON public.plan_steps FOR DELETE
    USING (owner_id = auth.uid());

CREATE TRIGGER trigger_plan_steps_updated_at
    BEFORE UPDATE ON public.plan_steps
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 3. Plan Events Table (Progress & Audit Trail)
CREATE TABLE IF NOT EXISTS public.plan_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    step_id uuid REFERENCES public.plan_steps(id) ON DELETE CASCADE,
    type text NOT NULL,
    progress_pct integer NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
    message text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan events viewable by owner"
    ON public.plan_events FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Plan events insertable by owner"
    ON public.plan_events FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_plans_owner_state ON public.plans (owner_id, state);
CREATE INDEX IF NOT EXISTS idx_plans_task_id ON public.plans (task_id);
CREATE INDEX IF NOT EXISTS idx_plan_steps_plan_state ON public.plan_steps (plan_id, state);
CREATE INDEX IF NOT EXISTS idx_plan_steps_idempotency ON public.plan_steps (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_plan_events_plan_created ON public.plan_events (plan_id, created_at);
