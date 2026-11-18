import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceRegistry } from '../../src/access/device-registry';
import type { OwnerId, DeviceId } from '@victor/shared';

test('DeviceRegistry: AC-02 - Device registration and owner scoping', async () => {
  const registry = new DeviceRegistry();
  const ownerA = 'owner-alice' as OwnerId;
  const ownerB = 'owner-bob' as OwnerId;

  const deviceA = await registry.registerDevice({
    ownerId: ownerA,
    name: 'Pixel 8 Pro',
    type: 'android',
  });

  const deviceB = await registry.registerDevice({
    ownerId: ownerB,
    name: 'MacBook Pro',
    type: 'desktop',
  });

  assert.ok(deviceA.id);
  assert.equal(deviceA.ownerId, ownerA);
  assert.equal(deviceA.status, 'online');
  assert.equal(deviceA.trustStatus, 'active');

  // Verify list scoping
  const listA = await registry.listDevices(ownerA);
  assert.equal(listA.length, 1);
  assert.equal(listA[0].id, deviceA.id);

  const listB = await registry.listDevices(ownerB);
  assert.equal(listB.length, 1);
  assert.equal(listB[0].id, deviceB.id);
});

test('DeviceRegistry: AC-08 - Heartbeat and status updates', async () => {
  const registry = new DeviceRegistry();
  const owner = 'owner-charlie' as OwnerId;

  const device = await registry.registerDevice({
    ownerId: owner,
    name: 'Living Room TV',
    type: 'tv',
  });

  // Transition to offline
  const updatedOffline = await registry.updateStatus(device.id, 'offline');
  assert.equal(updatedOffline, true);
  const fetched = await registry.getDevice(device.id);
  assert.equal(fetched?.status, 'offline');

  // Transition to online
  const updatedOnline = await registry.updateStatus(device.id, 'online');
  assert.equal(updatedOnline, true);
  const fetchedOnline = await registry.getDevice(device.id);
  assert.equal(fetchedOnline?.status, 'online');
});

test('DeviceRegistry: AC-04 - Device revocation by owner and blocking status updates', async () => {
  const registry = new DeviceRegistry();
  const owner = 'owner-dan' as OwnerId;
  const attacker = 'owner-mallory' as OwnerId;

  const device = await registry.registerDevice({
    ownerId: owner,
    name: 'Compromised Phone',
    type: 'android',
  });

  // Attacker cannot revoke Dan's device
  const attackerRevoke = await registry.revokeDevice(device.id, attacker);
  assert.equal(attackerRevoke, false);
  assert.equal(registry.isDeviceRevoked(device.id), false);

  // Dan revokes his own device
  const legitRevoke = await registry.revokeDevice(device.id, owner);
  assert.equal(legitRevoke, true);
  assert.equal(registry.isDeviceRevoked(device.id), true);

  const fetched = await registry.getDevice(device.id);
  assert.equal(fetched?.trustStatus, 'revoked');
  assert.equal(fetched?.status, 'offline');
  assert.ok(fetched?.revokedAt);

  // Revoked device cannot report online
  const reportOnlineAttempt = await registry.updateStatus(device.id, 'online');
  assert.equal(reportOnlineAttempt, false);
});

test('DeviceRegistry: Device secret verification', async () => {
  const registry = new DeviceRegistry();
  const owner = 'owner-eve' as OwnerId;
  const secret = 'my-super-secret-key-64chars';

  const device = await registry.registerDevice({
    ownerId: owner,
    name: 'Secure Android',
    type: 'android',
    deviceSecret: secret,
  });

  assert.equal(registry.verifyDeviceSecret(device.id, secret), true);
  assert.equal(registry.verifyDeviceSecret(device.id, 'wrong-secret'), false);
});
