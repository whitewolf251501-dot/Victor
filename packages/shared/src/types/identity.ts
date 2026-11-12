declare const __brand: unique symbol;
export type Brand<K, T> = K & { readonly [__brand]: T };

export type OwnerId = Brand<string, 'OwnerId'>;
export type DeviceId = Brand<string, 'DeviceId'>;
export type SessionId = Brand<string, 'SessionId'>;

export type DeviceType = 'android' | 'web' | 'desktop' | 'tv' | 'watch';
export type DeviceStatus = 'online' | 'offline' | 'unknown';

export interface Device {
  id: DeviceId;
  ownerId: OwnerId;
  type: DeviceType;
  name: string;
  status: DeviceStatus;
  lastSeen: string;
  enrolledAt: string;
}

export interface Session {
  id: SessionId;
  ownerId: OwnerId;
  deviceId: DeviceId;
  createdAt: string;
  expiresAt: string;
}
