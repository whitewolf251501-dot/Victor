import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DeviceRegistry, SessionManager } from '@victor/core';
import type { OwnerId, DeviceId, DeviceStatus } from '@victor/shared';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const registry = new DeviceRegistry(supabase);
    const sessionManager = new SessionManager(registry, supabase);

    const revoked = await registry.revokeDevice(id as DeviceId, user.id as OwnerId);
    if (!revoked) {
      return NextResponse.json(
        { error: 'Device not found or not owned by caller.' },
        { status: 404 }
      );
    }

    // Immediately terminate all active sessions for this device
    await sessionManager.revokeAllDeviceSessions(id as DeviceId);

    return NextResponse.json({
      success: true,
      message: `Device ${id} revoked and all active sessions terminated.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { name?: string; status?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      last_seen: new Date().toISOString(),
    };
    if (body.name) updates.name = body.name.trim();
    if (body.status && ['online', 'offline', 'unknown'].includes(body.status)) {
      updates.status = body.status as DeviceStatus;
    }

    const { data: updated, error } = await supabase
      .from('devices')
      .update(updates)
      .eq('id', id)
      .eq('owner_id', user.id)
      .select('*')
      .maybeSingle();

    if (error || !updated) {
      return NextResponse.json(
        { error: error?.message || 'Device not found or could not be updated.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ device: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
