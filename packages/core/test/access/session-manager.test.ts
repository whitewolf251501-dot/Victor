import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceRegistry } from '../../src/access/device-registry';
import { SessionManager } from '../../src/access/session-manager';
import type { OwnerId, DeviceId } from '@victor/shared';

test('SessionManager: AC-08 - Session creation and validation', async () => {
  const registry = new DeviceRegistry();
  const sessionManager = new SessionManager(registry);
  const ownerId = 'owner-ses-1' as OwnerId;

  const device = await registry.registerDevice({
    ownerId,
    name: 'Test Device',
    type: 'android',
  });

  const session = await sessionManager.createSession(device.id, ownerId, 3600);
  assert.ok(session.sessionToken.startsWith('vses_'));
  assert.equal(session.deviceId, device.id);
  assert.equal(session.ownerId, ownerId);
  assert.equal(session.isRevoked, false);

  const valRes = await sessionManager.validateSession(session.sessionToken);
  assert.equal(valRes.valid, true);
  assert.equal(valRes.session?.sessionId, session.sessionId);
});

test('SessionManager: AC-08 - Expired session rejection', async () => {
  const registry = new DeviceRegistry();
  const sessionManager = new SessionManager(registry);
  const ownerId = 'owner-ses-2' as OwnerId;

  const device = await registry.registerDevice({
    ownerId,
    name: 'Expiring Device',
    type: 'web',
  });

  // TTL = -10 seconds (expired)
  const session = await sessionManager.createSession(device.id, ownerId, -10);

  const valRes = await sessionManager.validateSession(session.sessionToken);
  assert.equal(valRes.valid, false);
  assert.match(valRes.reason || '', /expired/i);
});

test('SessionManager: AC-04 - Prompt revocation: Revoking device immediately terminates active sessions', async () => {
  const registry = new DeviceRegistry();
  const sessionManager = new SessionManager(registry);
  const ownerId = 'owner-ses-3' as OwnerId;

  const device = await registry.registerDevice({
    ownerId,
    name: 'Compromised Watch',
    type: 'watch',
  });

  const session = await sessionManager.createSession(device.id, ownerId, 3600);

  // Before device revocation: session is valid
  const preRevoke = await sessionManager.validateSession(session.sessionToken);
  assert.equal(preRevoke.valid, true);

  // Owner revokes device
  await registry.revokeDevice(device.id, ownerId);

  // After device revocation: session validation immediately fails!
  const postRevoke = await sessionManager.validateSession(session.sessionToken);
  assert.equal(postRevoke.valid, false);
  assert.match(postRevoke.reason || '', /revoked by owner/i);
});

test('SessionManager: AC-04 - Revoking all device sessions invalidates all tokens', async () => {
  const registry = new DeviceRegistry();
  const sessionManager = new SessionManager(registry);
  const ownerId = 'owner-ses-4' as OwnerId;

  const device = await registry.registerDevice({
    ownerId,
    name: 'Multi-Session TV',
    type: 'tv',
  });

  const session1 = await sessionManager.createSession(device.id, ownerId, 3600);
  const session2 = await sessionManager.createSession(device.id, ownerId, 3600);

  const revokedCount = await sessionManager.revokeAllDeviceSessions(device.id);
  assert.equal(revokedCount, 2);

  const check1 = await sessionManager.validateSession(session1.sessionToken);
  assert.equal(check1.valid, false);

  const check2 = await sessionManager.validateSession(session2.sessionToken);
  assert.equal(check2.valid, false);
});
