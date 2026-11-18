import { randomUUID, createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Device,
  DeviceId,
  OwnerId,
  DeviceType,
  DeviceStatus,
  DeviceTrustStatus,
} from '@victor/shared';

export interface RegisterDeviceParams {
  id?: DeviceId;
  ownerId: OwnerId;
  type: DeviceType;
  name: string;
  metadata?: Record<string, unknown>;
  deviceSecret?: string;
}

export class DeviceRegistry {
  private readonly inMemoryDevices = new Map<string, Device>();
  private readonly secretHashes = new Map<string, string>(); // deviceId -> sha256(secret)

  constructor(private readonly supabase?: SupabaseClient) {}

  /**
   * Registers a new device or updates an existing one for an owner.
   */
  async registerDevice(params: RegisterDeviceParams): Promise<Device> {
    const id = params.id ?? (randomUUID() as DeviceId);
    const now = new Date().toISOString();

    const device: Device = {
      id,
      ownerId: params.ownerId,
      type: params.type,
      name: params.name,
      status: 'online',
      trustStatus: 'active',
      lastSeen: now,
      enrolledAt: now,
      metadata: params.metadata,
    };

    if (params.deviceSecret) {
      const hash = createHash('sha256').update(params.deviceSecret).digest('hex');
      this.secretHashes.set(id, hash);
    }

    this.inMemoryDevices.set(id, device);

    if (this.supabase) {
      try {
        await this.supabase.from('devices').upsert({
          id,
          owner_id: params.ownerId,
          type: params.type,
          name: params.name,
          status: 'online',
          last_seen: now,
          enrolled_at: now,
          metadata: params.metadata ?? {},
        });
      } catch (err) {
        console.error('[DeviceRegistry] Error persisting device to Supabase:', err);
      }
    }

    return device;
  }

  /**
   * Retrieves a device by its ID.
   */
  async getDevice(deviceId: DeviceId): Promise<Device | null> {
    const mem = this.inMemoryDevices.get(deviceId);
    if (mem) return { ...mem };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .maybeSingle();

      if (!error && data) {
        const device: Device = {
          id: data.id as DeviceId,
          ownerId: data.owner_id as OwnerId,
          type: data.type as DeviceType,
          name: data.name,
          status: data.status as DeviceStatus,
          trustStatus: data.revoked_at ? 'revoked' : 'active',
          lastSeen: data.last_seen,
          enrolledAt: data.enrolled_at,
          revokedAt: data.revoked_at,
          metadata: data.metadata,
        };
        this.inMemoryDevices.set(deviceId, device);
        return device;
      }
    }

    return null;
  }

  /**
   * Lists all devices belonging to an owner.
   */
  async listDevices(ownerId: OwnerId): Promise<Device[]> {
    const devices: Device[] = [];
    for (const d of this.inMemoryDevices.values()) {
      if (d.ownerId === ownerId) {
        devices.push({ ...d });
      }
    }

    if (this.supabase) {
      const { data } = await this.supabase
        .from('devices')
        .select('*')
        .eq('owner_id', ownerId)
        .order('last_seen', { ascending: false });

      if (data && data.length > 0) {
        return data.map((row) => ({
          id: row.id as DeviceId,
          ownerId: row.owner_id as OwnerId,
          type: row.type as DeviceType,
          name: row.name,
          status: row.status as DeviceStatus,
          trustStatus: row.revoked_at ? 'revoked' : 'active',
          lastSeen: row.last_seen,
          enrolledAt: row.enrolled_at,
          revokedAt: row.revoked_at,
          metadata: row.metadata,
        }));
      }
    }

    return devices;
  }

  /**
   * Updates device heartbeat and online status.
   */
  async updateStatus(
    deviceId: DeviceId,
    status: DeviceStatus
  ): Promise<boolean> {
    const device = this.inMemoryDevices.get(deviceId);
    const now = new Date().toISOString();

    if (device) {
      if (device.trustStatus === 'revoked') {
        return false; // Revoked devices cannot report online
      }
      device.status = status;
      device.lastSeen = now;
    }

    if (this.supabase) {
      try {
        await this.supabase
          .from('devices')
          .update({ status, last_seen: now })
          .eq('id', deviceId)
          .is('revoked_at', null);
      } catch {
        // Non-blocking
      }
    }

    return true;
  }

  /**
   * Revokes a device, invalidating all trust.
   */
  async revokeDevice(deviceId: DeviceId, ownerId: OwnerId): Promise<boolean> {
    const device = this.inMemoryDevices.get(deviceId);

    if (device) {
      if (device.ownerId !== ownerId) {
        return false;
      }
      device.trustStatus = 'revoked';
      device.status = 'offline';
      device.revokedAt = new Date().toISOString();
    }

    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('devices')
          .update({
            status: 'offline',
            revoked_at: new Date().toISOString(),
          })
          .eq('id', deviceId)
          .eq('owner_id', ownerId);

        if (error) return false;
      } catch {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks whether a device is currently revoked.
   */
  isDeviceRevoked(deviceId: DeviceId): boolean {
    const d = this.inMemoryDevices.get(deviceId);
    return d?.trustStatus === 'revoked' || !!d?.revokedAt;
  }

  /**
   * Verifies a device secret against its registered hash.
   */
  verifyDeviceSecret(deviceId: DeviceId, secret: string): boolean {
    const storedHash = this.secretHashes.get(deviceId);
    if (!storedHash) return false;
    const incomingHash = createHash('sha256').update(secret).digest('hex');
    return storedHash === incomingHash;
  }
}
