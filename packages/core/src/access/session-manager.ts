import { randomBytes, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DeviceSession,
  SessionId,
  DeviceId,
  OwnerId,
} from '@victor/shared';
import { DeviceRegistry } from './device-registry';

export class SessionManager {
  private readonly inMemorySessions = new Map<string, DeviceSession>(); // sessionToken -> DeviceSession

  constructor(
    private readonly deviceRegistry: DeviceRegistry,
    private readonly supabase?: SupabaseClient
  ) {}

  /**
   * Creates a new persistent device session.
   */
  async createSession(
    deviceId: DeviceId,
    ownerId: OwnerId,
    ttlSeconds: number = 7 * 24 * 60 * 60 // 7 days
  ): Promise<DeviceSession> {
    const sessionId = randomUUID() as SessionId;
    const sessionToken = `vses_${randomBytes(24).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    const session: DeviceSession = {
      sessionId,
      deviceId,
      ownerId,
      sessionToken,
      lastActive: now.toISOString(),
      expiresAt,
      isRevoked: false,
    };

    this.inMemorySessions.set(sessionToken, session);

    if (this.supabase) {
      try {
        await this.supabase.from('device_sessions').insert({
          id: sessionId,
          device_id: deviceId,
          owner_id: ownerId,
          session_token: sessionToken,
          last_active: session.lastActive,
          expires_at: expiresAt,
          is_revoked: false,
        });
      } catch (err) {
        console.error('[SessionManager] Error creating session in Supabase:', err);
      }
    }

    return session;
  }

  /**
   * Validates a session token. Enforces immediate revocation if either the session or device was revoked.
   */
  async validateSession(
    sessionToken: string
  ): Promise<{ valid: boolean; session?: DeviceSession; reason?: string }> {
    const session = this.inMemorySessions.get(sessionToken);

    if (!session) {
      return { valid: false, reason: 'Session not found.' };
    }

    if (session.isRevoked) {
      return { valid: false, reason: 'Session has been revoked.' };
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return { valid: false, reason: 'Session has expired.' };
    }

    // Prompt revocation check: inspect device trust state
    if (this.deviceRegistry.isDeviceRevoked(session.deviceId)) {
      session.isRevoked = true;
      return { valid: false, reason: 'Device has been revoked by owner.' };
    }

    // Update lastActive
    session.lastActive = new Date().toISOString();
    return { valid: true, session };
  }

  /**
   * Revokes an individual session.
   */
  async revokeSession(sessionToken: string): Promise<boolean> {
    const session = this.inMemorySessions.get(sessionToken);
    if (session) {
      session.isRevoked = true;
      return true;
    }
    return false;
  }

  /**
   * Immediately revokes all active sessions belonging to a specific device.
   */
  async revokeAllDeviceSessions(deviceId: DeviceId): Promise<number> {
    let count = 0;
    for (const session of this.inMemorySessions.values()) {
      if (session.deviceId === deviceId && !session.isRevoked) {
        session.isRevoked = true;
        count++;
      }
    }

    if (this.supabase) {
      try {
        await this.supabase
          .from('device_sessions')
          .update({ is_revoked: true })
          .eq('device_id', deviceId);
      } catch {
        // Non-fatal
      }
    }

    return count;
  }
}
