declare const __brand: unique symbol;
export type Brand<K, T> = K & { readonly [__brand]: T };

export type OwnerId = Brand<string, 'OwnerId'>;
export type DeviceId = Brand<string, 'DeviceId'>;
export type SessionId = Brand<string, 'SessionId'>;

export type DeviceType = 'android' | 'web' | 'desktop' | 'tv' | 'watch';
export type DeviceStatus = 'online' | 'offline' | 'unknown';
export type DeviceTrustStatus = 'enrolled' | 'paired' | 'active' | 'offline' | 'revoked';

export interface Device {
  id: DeviceId;
  ownerId: OwnerId;
  type: DeviceType;
  name: string;
  status: DeviceStatus;
  trustStatus?: DeviceTrustStatus;
  lastSeen: string;
  enrolledAt: string;
  revokedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface Session {
  id: SessionId;
  ownerId: OwnerId;
  deviceId: DeviceId;
  createdAt: string;
  expiresAt: string;
}

export interface DeviceSession {
  sessionId: SessionId;
  deviceId: DeviceId;
  ownerId: OwnerId;
  sessionToken: string;
  lastActive: string;
  expiresAt: string;
  isRevoked: boolean;
}

export interface PairingRequest {
  code: string;
  ownerId: OwnerId;
  deviceType?: DeviceType;
  deviceName?: string;
  expiresAt: string;
  claimedAt?: string;
  claimedDeviceId?: DeviceId;
  createdAt: string;
}

export interface PairingClaimResult {
  success: boolean;
  deviceId?: DeviceId;
  deviceSecret?: string;
  ownerId?: OwnerId;
  reason?: string;
}

export interface RealtimeSubscriptionRequest {
  channel: string;
  identityContext: IdentityContext;
}

export interface RealtimeSubscriptionResult {
  authorized: boolean;
  reason?: string;
}


export type ActorType = 'owner' | 'authorized_device' | 'system_internal' | 'local_agent';

export interface IdentityContext {
  ownerId: OwnerId;
  deviceId?: DeviceId;
  sessionId?: SessionId;
  actorType: ActorType;
  scopes: string[];
  roles: string[];
  authMethod: 'session_jwt' | 'device_hmac' | 'internal' | 'token';
  correlationId: string;
  issuedAt: string;
  expiresAt?: string;
}

