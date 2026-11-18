import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DeviceId, CapabilityId } from '@victor/shared';

export interface LocalAgentSignedMessage {
  deviceId: DeviceId;
  capabilityId: CapabilityId;
  payloadHash: string;
  timestamp: number; // Unix timestamp ms
  nonce: string;
  signature: string;
}

export interface AuthenticateAgentResult {
  valid: boolean;
  reason?: string;
}

export class LocalAgentAuthenticator {
  private readonly deviceSecrets = new Map<string, string>();
  private readonly revokedDevices = new Set<string>();
  private readonly seenNonces = new Set<string>();
  private static readonly MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Registers a trusted secret for an enrolled device.
   */
  public registerDeviceSecret(deviceId: DeviceId, secret: string): void {
    this.deviceSecrets.set(deviceId, secret);
  }

  /**
   * Revokes trust for a device.
   */
  public revokeDevice(deviceId: DeviceId): void {
    this.revokedDevices.add(deviceId);
  }

  /**
   * Generates a valid HMAC signature for a local agent request.
   */
  public static signMessage(
    secret: string,
    deviceId: DeviceId,
    capabilityId: CapabilityId,
    payloadHash: string,
    timestamp: number,
    nonce: string
  ): string {
    const message = `${timestamp}:${nonce}:${deviceId}:${capabilityId}:${payloadHash}`;
    return createHmac('sha256', secret).update(message).digest('hex');
  }

  /**
   * Verifies an incoming signed message from a local agent.
   */
  public authenticateMessage(signed: LocalAgentSignedMessage): AuthenticateAgentResult {
    const { deviceId, capabilityId, payloadHash, timestamp, nonce, signature } = signed;

    // 1. Check if device is revoked
    if (this.revokedDevices.has(deviceId)) {
      return { valid: false, reason: 'Device is revoked and unauthorized.' };
    }

    // 2. Check device secret exists
    const secret = this.deviceSecrets.get(deviceId);
    if (!secret) {
      return { valid: false, reason: 'Unknown or un-enrolled device.' };
    }

    // 3. Check timestamp within acceptable window
    const now = Date.now();
    if (Math.abs(now - timestamp) > LocalAgentAuthenticator.MAX_CLOCK_SKEW_MS) {
      return { valid: false, reason: 'Message timestamp expired or clock skew exceeded.' };
    }

    // 4. Check nonce replay
    const nonceKey = `${deviceId}:${nonce}`;
    if (this.seenNonces.has(nonceKey)) {
      return { valid: false, reason: 'Replay attack detected: Nonce has already been consumed.' };
    }

    // 5. Compute expected signature and verify using constant-time comparison
    const expectedSig = LocalAgentAuthenticator.signMessage(
      secret,
      deviceId,
      capabilityId,
      payloadHash,
      timestamp,
      nonce
    );

    const sigBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, reason: 'Invalid cryptographic signature.' };
    }

    // Record nonce to prevent replay
    this.seenNonces.add(nonceKey);

    return { valid: true };
  }
}
