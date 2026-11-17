-- Migration: 20261101000002_vte_pending_approvals.sql
-- Description: Victor Trust and Execution Engine (VTE) Schema (Pending Approvals and Audit Log)

-- 1. Pending Approvals Table
CREATE TABLE IF NOT EXISTS public.pending_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    capability_id text NOT NULL,
    params jsonb DEFAULT '{}'::jsonb,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    confirmed_at timestamptz,
    denied_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pending approvals are viewable by owner"
    ON public.pending_approvals FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Pending approvals can be inserted by owner"
    ON public.pending_approvals FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Pending approvals can be updated by owner"
    ON public.pending_approvals FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Pending approvals can be deleted by owner"
    ON public.pending_approvals FOR DELETE
    USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pending_approvals_token ON public.pending_approvals (token);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_owner_expires ON public.pending_approvals (owner_id, expires_at);

-- 2. Audit Log Table
CREATE TABLE IF NOT EXISTS public.audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    capability_id text,
    authority_level integer,
    authorized boolean NOT NULL,
    reason text,
    device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Owner can read their own audit log, no insert/update/delete from client
CREATE POLICY "Audit logs are viewable by owner"
    ON public.audit_log FOR SELECT
    USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_audit_log_owner_created ON public.audit_log (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_capability ON public.audit_log (capability_id);
