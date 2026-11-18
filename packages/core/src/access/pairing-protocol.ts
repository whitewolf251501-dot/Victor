import { randomBytes, randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PairingRequest,
  PairingClaimResult,
  OwnerId,
  DeviceId,
  DeviceType,
} from '@victor/shared';
import { DeviceRegistry } from './device-registry';

export class PairingProtocol {
  private readonly inMemoryRequests = new Map<string, PairingRequest>(); // code -> request

  constructor(
    private readonly deviceRegistry: DeviceRegistry,
    private readonly supabase?: SupabaseClient
  ) {}

  /**
   * Generates a secure, short-lived 6-digit numeric pairing code authorized by the owner.
   */
  async createPairingCode(
    ownerId: OwnerId,
    deviceType: DeviceType = 'android',
    deviceName?: string,
    ttlMinutes: number = 10
  ): Promise<PairingRequest> {
    // Generate clean 6-digit code formatted as XXX-XXX
    const part1 = randomInt(100, 999).toString();
    const part2 = randomInt(100, 999).toString();
    const code = `${part1}-${part2}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

    const request: PairingRequest = {
      code,
      ownerId,
      deviceType,
      deviceName: deviceName || `New ${deviceType} device`,
      expiresAt,
      createdAt: now.toISOString(),
    };

    this.inMemoryRequests.set(code, request);

    if (this.supabase) {
      try {
        await this.supabase.from('device_pairing_requests').insert({
          code,
          owner_id: ownerId,
          device_type: deviceType,
          device_name: request.deviceName,
          expires_at: expiresAt,
        });
      } catch (err) {
        console.error('[PairingProtocol] Error inserting pairing request to Supabase:', err);
      }
    }

    return request;
  }

  /**
   * New device claims a pairing code. If valid, generates unique device credentials and enrolls the device.
   */
  async claimPairingCode(
    code: string,
    clientReportedName?: string,
    clientReportedType?: DeviceType
  ): Promise<PairingClaimResult> {
    const cleanCode = code.trim().toUpperCase();
    const now = new Date();

    const request = this.inMemoryRequests.get(cleanCode);

    if (!request) {
      return { success: false, reason: 'Invalid pairing code.' };
    }

    if (request.claimedAt) {
      return { success: false, reason: 'Pairing code has already been claimed.' };
    }

    if (new Date(request.expiresAt).getTime() <= now.getTime()) {
      return { success: false, reason: 'Pairing code has expired.' };
    }

    // Generate cryptographic device credentials
    const deviceSecret = randomBytes(32).toString('hex');
    const deviceName = clientReportedName || request.deviceName || 'Authorized Device';
    const deviceType = clientReportedType || request.deviceType || 'android';

    // Enroll device through device registry
    const device = await this.deviceRegistry.registerDevice({
      ownerId: request.ownerId,
      name: deviceName,
      type: deviceType,
      deviceSecret,
    });

    // Mark pairing request as claimed
    request.claimedAt = now.toISOString();
    request.claimedDeviceId = device.id;

    if (this.supabase) {
      try {
        await this.supabase
          .from('device_pairing_requests')
          .update({
            claimed_at: request.claimedAt,
            claimed_device_id: device.id,
          })
          .eq('code', cleanCode);
      } catch {
        // Non-fatal
      }
    }

    return {
      success: true,
      deviceId: device.id,
      deviceSecret,
      ownerId: request.ownerId,
    };
  }

  /**
   * Retrieves active pairing request for inspection.
   */
  getPairingRequest(code: string): PairingRequest | null {
    const req = this.inMemoryRequests.get(code.trim().toUpperCase());
    return req ? { ...req } : null;
  }
}
