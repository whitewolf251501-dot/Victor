import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DeviceRegistry, PairingProtocol } from '@victor/core';
import type { OwnerId, DeviceType } from '@victor/shared';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    let body: {
      action: 'create' | 'claim';
      deviceType?: DeviceType;
      deviceName?: string;
      code?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const registry = new DeviceRegistry(supabase);
    const pairingProtocol = new PairingProtocol(registry, supabase);

    if (body.action === 'create') {
      // 1. Owner requests a pairing code (must be authenticated)
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized: Session required to generate pairing code.' }, { status: 401 });
      }

      const pairingRequest = await pairingProtocol.createPairingCode(
        user.id as OwnerId,
        body.deviceType || 'android',
        body.deviceName
      );

      return NextResponse.json({ pairing: pairingRequest }, { status: 201 });
    } else if (body.action === 'claim') {
      // 2. New device claims a pairing code (does not require pre-existing session)
      if (!body.code || typeof body.code !== 'string') {
        return NextResponse.json({ error: 'Pairing code is required.' }, { status: 400 });
      }

      const claimResult = await pairingProtocol.claimPairingCode(
        body.code,
        body.deviceName,
        body.deviceType
      );

      if (!claimResult.success) {
        return NextResponse.json({ error: claimResult.reason || 'Pairing failed.' }, { status: 400 });
      }

      return NextResponse.json({ result: claimResult }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid action. Expected 'create' or 'claim'." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
