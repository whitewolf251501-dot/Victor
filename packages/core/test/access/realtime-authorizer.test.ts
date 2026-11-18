import test from 'node:test';
import assert from 'node:assert/strict';
import { RealtimeAuthorizer } from '../../src/access/realtime-authorizer';
import type { IdentityContext, OwnerId, DeviceId } from '@victor/shared';

test('RealtimeAuthorizer: AC-06 - Wildcard channels are prohibited', () => {
  const context: IdentityContext = {
    ownerId: 'owner-rt-1' as OwnerId,
    actorType: 'owner',
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-1',
    issuedAt: new Date().toISOString(),
  };

  const res1 = RealtimeAuthorizer.authorizeSubscription('owner:*', context);
  assert.equal(res1.authorized, false);
  assert.match(res1.reason || '', /wildcard subscriptions are forbidden/i);

  const res2 = RealtimeAuthorizer.authorizeSubscription('device:#', context);
  assert.equal(res2.authorized, false);
});

test('RealtimeAuthorizer: AC-06 - Authorizes owner channel for legitimate owner only', () => {
  const context: IdentityContext = {
    ownerId: 'owner-rt-1' as OwnerId,
    actorType: 'owner',
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-2',
    issuedAt: new Date().toISOString(),
  };

  // Legitimate owner subscription
  const validRes = RealtimeAuthorizer.authorizeSubscription('owner:owner-rt-1', context);
  assert.equal(validRes.authorized, true);

  // Cross-owner eavesdropping attempt
  const crossOwnerRes = RealtimeAuthorizer.authorizeSubscription('owner:owner-victim', context);
  assert.equal(crossOwnerRes.authorized, false);
  assert.match(crossOwnerRes.reason || '', /cannot subscribe to another owner’s event channel/i);
});

test('RealtimeAuthorizer: AC-06 - Authorizes device channel for legitimate device only', () => {
  const context: IdentityContext = {
    ownerId: 'owner-rt-1' as OwnerId,
    deviceId: 'device-alpha' as DeviceId,
    actorType: 'owner',
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-3',
    issuedAt: new Date().toISOString(),
  };

  // Legitimate device subscription
  const validRes = RealtimeAuthorizer.authorizeSubscription('device:device-alpha', context);
  assert.equal(validRes.authorized, true);

  // Cross-device eavesdropping attempt
  const crossDeviceRes = RealtimeAuthorizer.authorizeSubscription('device:device-beta', context);
  assert.equal(crossDeviceRes.authorized, false);
  assert.match(crossDeviceRes.reason || '', /cannot subscribe to another device’s event channel/i);
});

test('RealtimeAuthorizer: AC-06 - Authorizes conversation channel for legitimate owner only', () => {
  const context: IdentityContext = {
    ownerId: 'owner-rt-1' as OwnerId,
    actorType: 'owner',
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-4',
    issuedAt: new Date().toISOString(),
  };

  const validRes = RealtimeAuthorizer.authorizeSubscription('conversation:owner-rt-1:conv-123', context);
  assert.equal(validRes.authorized, true);

  const crossRes = RealtimeAuthorizer.authorizeSubscription('conversation:owner-other:conv-123', context);
  assert.equal(crossRes.authorized, false);
  assert.match(crossRes.reason || '', /cannot subscribe to another owner’s conversation/i);
});
