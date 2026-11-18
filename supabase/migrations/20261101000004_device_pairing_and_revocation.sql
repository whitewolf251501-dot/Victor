-- Migration: 20261101000004_device_pairing_and_revocation.sql
-- Description: System 07 Universal Access Schema (Device Trust, Pairing Handshake, and Session Invalidation)

-- 1. Extend devices table
ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS trust_status text NOT NULL DEFAULT 'active' CHECK (trust_status IN ('enrolled', 'paired', 'active', 'offline', 'revoked')),
    ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
    ADD COLUMN IF NOT EXISTS device_secret_hash text;

CREATE INDEX IF NOT EXISTS idx_devices_owner_trust ON public.devices (owner_id, trust_status);
CREATE INDEX IF NOT EXISTS idx_devices_revoked ON public.devices (revoked_at);

-- 2. Device Pairing Requests Table
CREATE TABLE IF NOT EXISTS public.device_pairing_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_type text NOT NULL DEFAULT 'android',
    device_name text NOT NULL,
    expires_at timestamptz NOT NULL,
    claimed_at timestamptz,
    claimed_device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_pairing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pairing requests are viewable by owner"
    ON public.device_pairing_requests FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Pairing requests can be created by owner"
    ON public.device_pairing_requests FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Pairing requests can be updated by owner"
    ON public.device_pairing_requests FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pairing_code ON public.device_pairing_requests (code);
CREATE INDEX IF NOT EXISTS idx_pairing_owner_expires ON public.device_pairing_requests (owner_id, expires_at);

-- 3. Device Sessions Table
CREATE TABLE IF NOT EXISTS public.device_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_token text NOT NULL UNIQUE,
    last_active timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    is_revoked boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Device sessions are viewable by owner"
    ON public.device_sessions FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Device sessions can be inserted by owner"
    ON public.device_sessions FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Device sessions can be updated by owner"
    ON public.device_sessions FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_device_sessions_token ON public.device_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_device_sessions_device ON public.device_sessions (device_id);
