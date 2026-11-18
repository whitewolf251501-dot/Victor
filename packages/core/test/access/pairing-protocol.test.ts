import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceRegistry } from '../../src/access/device-registry';
import { PairingProtocol } from '../../src/access/pairing-protocol';
import type { OwnerId } from '@victor/shared';

test('PairingProtocol: AC-03 - Owner creates pairing code and new device claims it', async () => {
  const registry = new DeviceRegistry();
  const protocol = new PairingProtocol(registry);
  const ownerId = 'owner-pair-1' as OwnerId;

  // 1. Owner generates pairing code
  const pairingReq = await protocol.createPairingCode(ownerId, 'android', 'White Wolf Android Phone');
  assert.ok(pairingReq.code);
  assert.match(pairingReq.code, /^\d{3}-\d{3}$/); // XXX-XXX format
  assert.equal(pairingReq.ownerId, ownerId);
  assert.ok(new Date(pairingReq.expiresAt).getTime() > Date.now());

  // 2. New device claims pairing code
  const claimRes = await protocol.claimPairingCode(pairingReq.code, 'Living Room Tablet', 'android');
  assert.equal(claimRes.success, true);
  assert.ok(claimRes.deviceId);
  assert.ok(claimRes.deviceSecret);
  assert.equal(claimRes.ownerId, ownerId);

  // 3. Verify device exists in registry
  const device = await registry.getDevice(claimRes.deviceId!);
  assert.ok(device);
  assert.equal(device.ownerId, ownerId);
  assert.equal(device.name, 'Living Room Tablet');
  assert.equal(device.trustStatus, 'active');
  assert.equal(registry.verifyDeviceSecret(claimRes.deviceId!, claimRes.deviceSecret!), true);
});

test('PairingProtocol: AC-03 - Claimed pairing code cannot be re-claimed (single use)', async () => {
  const registry = new DeviceRegistry();
  const protocol = new PairingProtocol(registry);
  const ownerId = 'owner-pair-2' as OwnerId;

  const pairingReq = await protocol.createPairingCode(ownerId, 'web', 'Chrome Web Client');

  // First claim succeeds
  const firstClaim = await protocol.claimPairingCode(pairingReq.code);
  assert.equal(firstClaim.success, true);

  // Second claim attempt fails
  const secondClaim = await protocol.claimPairingCode(pairingReq.code);
  assert.equal(secondClaim.success, false);
  assert.match(secondClaim.reason || '', /already been claimed/i);
});

test('PairingProtocol: AC-03 - Expired pairing code is rejected', async () => {
  const registry = new DeviceRegistry();
  const protocol = new PairingProtocol(registry);
  const ownerId = 'owner-pair-3' as OwnerId;

  // TTL = -1 minute (already expired)
  const pairingReq = await protocol.createPairingCode(ownerId, 'desktop', 'Workstation', -1);

  const claimRes = await protocol.claimPairingCode(pairingReq.code);
  assert.equal(claimRes.success, false);
  assert.match(claimRes.reason || '', /expired/i);
});

test('PairingProtocol: AC-03 - Non-existent pairing code is rejected', async () => {
  const registry = new DeviceRegistry();
  const protocol = new PairingProtocol(registry);

  const claimRes = await protocol.claimPairingCode('999-999');
  assert.equal(claimRes.success, false);
  assert.match(claimRes.reason || '', /invalid pairing code/i);
});
