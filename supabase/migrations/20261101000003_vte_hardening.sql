-- Migration: 20261101000003_vte_hardening.sql
-- Description: VTE Hardening - Payload Hashes, Single-Use Consumption, Idempotency Store, and Execution Tracking

-- 1. Extend pending_approvals with payload_hash, consumed_at, and device_id
ALTER TABLE public.pending_approvals
    ADD COLUMN IF NOT EXISTS payload_hash text,
    ADD COLUMN IF NOT EXISTS consumed_at timestamptz,
    ADD COLUMN IF NOT EXISTS device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pending_approvals_payload_hash ON public.pending_approvals (payload_hash);

-- 2. Idempotency Records Table
CREATE TABLE IF NOT EXISTS public.idempotency_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    idempotency_key text NOT NULL,
    capability_id text NOT NULL,
    payload_hash text NOT NULL,
    execution_id text NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    result jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    CONSTRAINT uq_idempotency_owner_key UNIQUE (owner_id, idempotency_key)
);

ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Idempotency records are viewable by owner"
    ON public.idempotency_records FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Idempotency records can be inserted by owner"
    ON public.idempotency_records FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Idempotency records can be updated by owner"
    ON public.idempotency_records FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_idempotency_owner_key ON public.idempotency_records (owner_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON public.idempotency_records (expires_at);

-- 3. Execution Records Table
CREATE TABLE IF NOT EXISTS public.execution_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id text NOT NULL UNIQUE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    capability_id text NOT NULL,
    state text NOT NULL CHECK (state IN ('requested', 'denied', 'approval_required', 'authorized', 'queued', 'running', 'succeeded', 'failed', 'cancelled', 'timed_out')),
    authorized boolean NOT NULL,
    error text,
    error_code text,
    execution_time_ms integer,
    evidence jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.execution_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Execution records are viewable by owner"
    ON public.execution_records FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Execution records can be inserted by owner"
    ON public.execution_records FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_execution_records_owner_created ON public.execution_records (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_records_execution_id ON public.execution_records (execution_id);
