import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DeviceRegistry } from '@victor/core';
import type { OwnerId, DeviceId, DeviceType } from '@victor/shared';

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: devices, error } = await supabase
      .from('devices')
      .select('id, owner_id, type, name, status, last_seen, enrolled_at')
      .eq('owner_id', user.id)
      .order('last_seen', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ devices: devices ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: {
      id?: string;
      name?: string;
      type?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Device name is required.' }, { status: 400 });
    }

    const registry = new DeviceRegistry(supabase);
    const device = await registry.registerDevice({
      id: body.id as DeviceId | undefined,
      ownerId: user.id as OwnerId,
      name: body.name.trim(),
      type: (body.type as DeviceType) || 'web',
      metadata: body.metadata,
    });

    return NextResponse.json({ device }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
