import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceRegistry } from '../../src/access/device-registry';
import { SessionManager } from '../../src/access/session-manager';
import { AccessGuard } from '../../src/access/access-guard';
import type { OwnerId, DeviceId } from '@victor/shared';

test('AccessGuard: AC-01 & AC-05 - Resolves session token to verified IdentityContext', async () => {
  const registry = new DeviceRegistry();
  const sessionManager = new SessionManager(registry);
  const guard = new AccessGuard(registry, sessionManager);
  const ownerId = 'owner-guard-1' as OwnerId;

  const device = await registry.registerDevice({
    ownerId,
    name: 'Android Phone',
    type: 'android',
  });

  const session = await sessionManager.createSession(device.id, ownerId);

  // Authenticate via Bearer header
  const bearerRes = await guard.authenticateRequest({
    authHeader: `Bearer ${session.sessionToken}`,
    deviceId: device.id,
  });
  assert.equal(bearerRes.authorized, true);
  assert.ok(bearerRes.identityContext);
  assert.equal(bearerRes.identityContext?.ownerId, ownerId);
  assert.equal(bearerRes.identityContext?.deviceId, device.id);
  assert.equal(bearerRes.identityContext?.actorType, 'owner');

  // Authenticate via Cookie token
  const cookieRes = await guard.authenticateRequest({
    cookieToken: session.sessionToken,
    deviceId: device.id,
  });
  assert.equal(cookieRes.authorized, true);
  assert.equal(cookieRes.identityContext?.ownerId, ownerId);
});

test('AccessGuard: AC-01 - Rejects unauthenticated requests with no token', async () => {
  const registry = new DeviceRegistry();
  const sessionManager = new SessionManager(registry);
  const guard = new AccessGuard(registry, sessionManager);

  const res = await guard.authenticateRequest({});
  assert.equal(res.authorized, false);
  assert.equal(res.errorCode, 'UNAUTHENTICATED');
});

test('AccessGuard: AC-04 - Rejects requests from revoked devices', async () => {
  const registry = new DeviceRegistry();
  const sessionManager = new SessionManager(registry);
  const guard = new AccessGuard(registry, sessionManager);
  const ownerId = 'owner-guard-2' as OwnerId;

  const device = await registry.registerDevice({
    ownerId,
    name: 'Revoked Tablet',
    type: 'android',
  });

  const session = await sessionManager.createSession(device.id, ownerId);

  // Revoke device
  await registry.revokeDevice(device.id, ownerId);

  // Attempt authentication from revoked device
  const res = await guard.authenticateRequest({
    authHeader: `Bearer ${session.sessionToken}`,
    deviceId: device.id,
  });

  assert.equal(res.authorized, false);
  assert.equal(res.errorCode, 'DEVICE_REVOKED');
  assert.match(res.reason || '', /device has been revoked/i);
});

test('AccessGuard: AC-02 - Prevents forged owner ID overrides', async () => {
  const registry = new DeviceRegistry();
  const sessionManager = new SessionManager(registry);
  const guard = new AccessGuard(registry, sessionManager);
  const ownerId = 'legit-owner' as OwnerId;

  const device = await registry.registerDevice({
    ownerId,
    name: 'My Laptop',
    type: 'desktop',
  });

  const session = await sessionManager.createSession(device.id, ownerId);

  // Caller claims to act on behalf of 'victim-owner'
  const res = await guard.authenticateRequest({
    authHeader: `Bearer ${session.sessionToken}`,
    expectedOwnerId: 'victim-owner',
  });

  assert.equal(res.authorized, false);
  assert.equal(res.errorCode, 'FORGED_OWNER_ID');
  assert.match(res.reason || '', /does not match authenticated identity/i);
});
