import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalAgentAuthenticator } from '../../src/vte/local-agent-authenticator';
import type { DeviceId, CapabilityId } from '@victor/shared';

test('LocalAgentAuthenticator: AC-11 - Valid HMAC signature passes authentication', () => {
  const auth = new LocalAgentAuthenticator();
  const deviceId = 'android-device-1' as DeviceId;
  const secret = 'super-secret-device-key-32chars!';
  auth.registerDeviceSecret(deviceId, secret);

  const capabilityId = 'vic.device.status' as CapabilityId;
  const payloadHash = 'hash-abc1234';
  const timestamp = Date.now();
  const nonce = 'nonce-uuid-1';

  const signature = LocalAgentAuthenticator.signMessage(
    secret,
    deviceId,
    capabilityId,
    payloadHash,
    timestamp,
    nonce
  );

  const result = auth.authenticateMessage({
    deviceId,
    capabilityId,
    payloadHash,
    timestamp,
    nonce,
    signature,
  });

  assert.equal(result.valid, true);
});

test('LocalAgentAuthenticator: AC-11 & AC-12 - Revoked device is denied execution', () => {
  const auth = new LocalAgentAuthenticator();
  const deviceId = 'compromised-device' as DeviceId;
  const secret = 'secret-compromised';
  auth.registerDeviceSecret(deviceId, secret);

  // Revoke device
  auth.revokeDevice(deviceId);

  const capabilityId = 'vic.device.status' as CapabilityId;
  const payloadHash = 'hash-abc';
  const timestamp = Date.now();
  const nonce = 'nonce-1';

  const signature = LocalAgentAuthenticator.signMessage(
    secret,
    deviceId,
    capabilityId,
    payloadHash,
    timestamp,
    nonce
  );

  const result = auth.authenticateMessage({
    deviceId,
    capabilityId,
    payloadHash,
    timestamp,
    nonce,
    signature,
  });

  assert.equal(result.valid, false);
  assert.match(result.reason || '', /revoked and unauthorized/i);
});

test('LocalAgentAuthenticator: AC-11 - Replayed nonce is rejected', () => {
  const auth = new LocalAgentAuthenticator();
  const deviceId = 'android-device-1' as DeviceId;
  const secret = 'secret-key-1';
  auth.registerDeviceSecret(deviceId, secret);

  const capabilityId = 'vic.device.status' as CapabilityId;
  const payloadHash = 'hash-abc';
  const timestamp = Date.now();
  const nonce = 'replayed-nonce';

  const signature = LocalAgentAuthenticator.signMessage(
    secret,
    deviceId,
    capabilityId,
    payloadHash,
    timestamp,
    nonce
  );

  // 1. First presentation succeeds
  const first = auth.authenticateMessage({
    deviceId,
    capabilityId,
    payloadHash,
    timestamp,
    nonce,
    signature,
  });
  assert.equal(first.valid, true);

  // 2. Replay of same message and nonce fails
  const replay = auth.authenticateMessage({
    deviceId,
    capabilityId,
    payloadHash,
    timestamp,
    nonce,
    signature,
  });
  assert.equal(replay.valid, false);
  assert.match(replay.reason || '', /replay attack detected/i);
});

test('LocalAgentAuthenticator: AC-11 - Expired timestamp (exceeding clock skew) is rejected', () => {
  const auth = new LocalAgentAuthenticator();
  const deviceId = 'android-device-1' as DeviceId;
  const secret = 'secret-key-1';
  auth.registerDeviceSecret(deviceId, secret);

  const capabilityId = 'vic.device.status' as CapabilityId;
  const payloadHash = 'hash-abc';
  // 10 minutes in the past
  const expiredTimestamp = Date.now() - 10 * 60 * 1000;
  const nonce = 'nonce-skew';

  const signature = LocalAgentAuthenticator.signMessage(
    secret,
    deviceId,
    capabilityId,
    payloadHash,
    expiredTimestamp,
    nonce
  );

  const result = auth.authenticateMessage({
    deviceId,
    capabilityId,
    payloadHash,
    timestamp: expiredTimestamp,
    nonce,
    signature,
  });

  assert.equal(result.valid, false);
  assert.match(result.reason || '', /expired or clock skew/i);
});

test('LocalAgentAuthenticator: AC-11 - Invalid or forged signature is rejected', () => {
  const auth = new LocalAgentAuthenticator();
  const deviceId = 'android-device-1' as DeviceId;
  const secret = 'secret-key-1';
  auth.registerDeviceSecret(deviceId, secret);

  const result = auth.authenticateMessage({
    deviceId,
    capabilityId: 'vic.device.status' as CapabilityId,
    payloadHash: 'hash-abc',
    timestamp: Date.now(),
    nonce: 'nonce-forged',
    signature: 'badf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00d0', // invalid 32-byte hex
  });

  assert.equal(result.valid, false);
  assert.match(result.reason || '', /invalid cryptographic signature/i);
});
