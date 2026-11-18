import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthorityEngine,
  CapabilityRegistry,
  BUILTIN_CAPABILITIES,
} from '../../src/index';
import type { IdentityContext, OwnerId, DeviceId, CapabilityId } from '@victor/shared';

test('AuthorityEngine: AC-01 - Capability registration and lookup enforcement', () => {
  const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
  const engine = new AuthorityEngine(registry);

  const res = engine.evaluateOperation({
    capabilityId: 'non.existent.capability',
    ownerId: 'owner-1',
  });

  assert.equal(res.authorized, false);
  assert.equal(res.level, 4);
  assert.match(res.reason, /not found or not registered/i);
});

test('AuthorityEngine: AC-02 - IdentityContext derivation and forged ownerId rejection', () => {
  const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
  const engine = new AuthorityEngine(registry);

  const validContext: IdentityContext = {
    ownerId: 'legit-owner' as OwnerId,
    actorType: 'owner',
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-1',
    issuedAt: new Date().toISOString(),
  };

  // 1. Untrusted ownerId matches context
  const validRes = engine.evaluateOperation({
    capabilityId: 'vic.memory.read',
    ownerId: 'legit-owner',
    identityContext: validContext,
  });
  assert.equal(validRes.authorized, true);

  // 2. Forgery attempt: untrusted ownerId does NOT match context
  const forgedRes = engine.evaluateOperation({
    capabilityId: 'vic.memory.read',
    ownerId: 'attacker-owner-id',
    identityContext: validContext,
  });
  assert.equal(forgedRes.authorized, false);
  assert.equal(forgedRes.level, 4);
  assert.match(forgedRes.reason, /Security violation: Untrusted ownerId does not match/i);
});

test('AuthorityEngine: AC-04 - Least-privilege and required scope validation', () => {
  const registry = new CapabilityRegistry([
    {
      id: 'custom.admin.tool' as CapabilityId,
      name: 'Admin Tool',
      description: 'restricted to admin scope',
      authorityLevel: 2,
      target: 'cloud',
      status: 'available',
      requiredScopes: ['system:admin', 'memory:write'],
    },
  ]);
  const engine = new AuthorityEngine(registry);

  // Insufficient scopes
  const lowPrivContext: IdentityContext = {
    ownerId: 'owner-1' as OwnerId,
    actorType: 'owner',
    scopes: ['memory:read'],
    roles: ['user'],
    authMethod: 'session_jwt',
    correlationId: 'corr-2',
    issuedAt: new Date().toISOString(),
  };

  const deniedRes = engine.evaluateOperation({
    capabilityId: 'custom.admin.tool',
    ownerId: 'owner-1',
    identityContext: lowPrivContext,
  });
  assert.equal(deniedRes.authorized, false);
  assert.match(deniedRes.reason, /Insufficient scopes/i);

  // Sufficient scopes
  const adminContext: IdentityContext = {
    ...lowPrivContext,
    scopes: ['system:admin', 'memory:write'],
  };
  const allowedRes = engine.evaluateOperation({
    capabilityId: 'custom.admin.tool',
    ownerId: 'owner-1',
    identityContext: adminContext,
  });
  assert.equal(allowedRes.authorized, true);
});

test('AuthorityEngine: AC-05 & AC-07 - L4 Restricted capability denial', () => {
  const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
  const engine = new AuthorityEngine(registry);

  const res = engine.evaluateOperation({
    capabilityId: 'vic.auth.bypass',
    ownerId: 'owner-1',
  });
  assert.equal(res.authorized, false);
  assert.equal(res.level, 4);
  assert.equal(res.riskClassification, 'irreversible');
  assert.match(res.reason, /restricted/i);
});

test('AuthorityEngine: AC-06 - L3 Approval generation with bound payload hash and 5-min TTL', async () => {
  const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
  const engine = new AuthorityEngine(registry);

  const params = { recipient: 'target-user', message: 'Hello Victor' };
  const res = await engine.evaluateOperation({
    capabilityId: 'vic.message.send',
    ownerId: 'owner-1',
    params,
  });

  assert.equal(res.authorized, false);
  assert.equal(res.level, 3);
  assert.equal(res.requiresApproval, true);
  assert.ok(res.approvalToken);
  assert.ok(res.payloadHash);
  assert.equal(res.riskClassification, 'consequential');

  const inMem = engine.getInMemoryApproval(res.approvalToken);
  assert.ok(inMem);
  assert.equal(inMem.ownerId, 'owner-1');
  assert.deepEqual(inMem.params, params);
  assert.ok(inMem.expiresAt.getTime() > Date.now());
});

test('AuthorityEngine: Offline / Disabled status enforcement', () => {
  const registry = new CapabilityRegistry([
    {
      id: 'vic.offline.tool' as CapabilityId,
      name: 'Offline Tool',
      description: 'currently offline',
      authorityLevel: 2,
      target: 'cloud',
      status: 'offline',
    },
  ]);
  const engine = new AuthorityEngine(registry);

  const res = engine.evaluateOperation({
    capabilityId: 'vic.offline.tool',
    ownerId: 'owner-1',
  });
  assert.equal(res.authorized, false);
  assert.match(res.reason, /offline/i);
});
