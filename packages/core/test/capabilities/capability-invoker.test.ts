import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthorityEngine,
  CapabilityRegistry,
  BUILTIN_CAPABILITIES,
  CapabilityInvoker,
  ResultNormalizer,
} from '../../src/index';
import type {
  IdentityContext,
  OwnerId,
  DeviceId,
  SessionId,
  CapabilityDefinition,
  CapabilityId,
} from '@victor/shared';
import type { CapabilityAdapter } from '../../src/capabilities/adapter-interface';

function createOwnerContext(ownerId: string = 'owner-1'): IdentityContext {
  return {
    ownerId: ownerId as OwnerId,
    actorType: 'owner',
    deviceId: 'device-1' as DeviceId,
    sessionId: 'session-1' as SessionId,
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-invoker',
    issuedAt: new Date().toISOString(),
  };
}

describe('System 5: CapabilityInvoker Specification Suite', () => {
  it('AC-04 & AC-05 - Invocations route through System 6 and normalize verified success', async () => {
    const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
    const engine = new AuthorityEngine(registry);
    const invoker = new CapabilityInvoker(registry, engine);

    const context = createOwnerContext();
    const result = await invoker.invoke(
      {
        capabilityId: 'vic.memory.read' as CapabilityId,
        params: { category: 'goal' },
      },
      context
    );

    assert.equal(result.success, true);
    assert.equal(result.state, 'succeeded');
    assert.equal(result.capabilityId, 'vic.memory.read');
    assert(result.data !== undefined);
  });

  it('AC-04 - Enforces L4 Restricted policy denial with normalized outcome', async () => {
    const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
    const engine = new AuthorityEngine(registry);
    const invoker = new CapabilityInvoker(registry, engine);

    const context = createOwnerContext();
    const result = await invoker.invoke(
      {
        capabilityId: 'vic.auth.bypass' as CapabilityId,
      },
      context
    );

    assert.equal(result.success, false);
    assert.equal(result.state, 'denied');
    assert.equal(result.errorCode, 'POLICY_DENIED');
  });

  it('AC-04 & AC-05 - Enforces L3 approval wait state and resumes with confirmed approval token', async () => {
    const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
    const engine = new AuthorityEngine(registry);
    const invoker = new CapabilityInvoker(registry, engine);

    const context = createOwnerContext();
    const l3Params = { recipient: '456', text: 'Important update' };

    // 1. Invocation without approval token -> returns approval_required
    const pendingResult = await invoker.invoke(
      {
        capabilityId: 'vic.message.send' as CapabilityId,
        params: l3Params,
      },
      context
    );

    assert.equal(pendingResult.success, false);
    assert.equal(pendingResult.state, 'approval_required');
    assert.equal(pendingResult.errorCode, 'APPROVAL_REQUIRED');

    // 2. Extract approval token staged by VTE
    const stagedApproval = engine.getApprovalManager();
    // Simulate user approval confirmation in VTE
    const tokenMatch = pendingResult.error?.match(/Token:\s+([a-zA-Z0-9_-]+)/);
    assert(tokenMatch !== null);
    const approvalToken = tokenMatch![1];

    const confirmed = await engine.confirmApproval(approvalToken, context.ownerId, undefined, l3Params);
    assert.equal(confirmed, true);

    // 3. Invocation with confirmed approval token -> succeeds
    const confirmedResult = await invoker.invoke(
      {
        capabilityId: 'vic.message.send' as CapabilityId,
        params: l3Params,
        approvalToken,
      },
      context
    );

    assert.equal(confirmedResult.success, true);
    assert.equal(confirmedResult.state, 'succeeded');
  });

  it('AC-08 - Pluggable custom capability adapter added dynamically without modifying core reasoning', async () => {
    const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
    const engine = new AuthorityEngine(registry);

    // 1. Register custom capability descriptor
    const weatherCap: CapabilityDefinition = {
      id: 'vic.custom.weather' as CapabilityId,
      name: 'Weather Forecaster',
      description: 'Fetch current weather for a city',
      version: '1.0.0',
      authorityLevel: 2, // L2 Execute
      target: 'cloud',
      status: 'available',
      category: 'utility',
      parameters: [
        { name: 'city', type: 'string', description: 'City name', required: true },
        { name: 'units', type: 'string', description: 'Metric or imperial', required: false, default: 'metric' },
      ],
    };
    registry.register(weatherCap);

    // 2. Register custom adapter
    const weatherAdapter: CapabilityAdapter<{ city: string; units: string }> = {
      capabilityId: 'vic.custom.weather' as CapabilityId,
      version: '1.0.0',
      execute: async (params) => {
        return {
          data: {
            city: params.city,
            temp: 22,
            units: params.units,
            condition: 'Clear sky',
          },
        };
      },
      checkHealth: async () => ({ status: 'healthy', latencyMs: 12 }),
    };
    registry.registerAdapter(weatherAdapter);

    // 3. Invoke custom capability via CapabilityInvoker
    const invoker = new CapabilityInvoker(registry, engine);
    const context = createOwnerContext();

    const result = await invoker.invoke(
      {
        capabilityId: 'vic.custom.weather' as CapabilityId,
        params: { city: 'Neo-Tokyo' },
      },
      context
    );

    assert.equal(result.success, true);
    assert.equal(result.state, 'succeeded');
    assert.deepEqual(result.data, {
      city: 'Neo-Tokyo',
      temp: 22,
      units: 'metric', // default applied by SchemaValidator
      condition: 'Clear sky',
    });
  });

  it('AC-06 - Dispatched/queued response is never represented as completed success', () => {
    const denial = ResultNormalizer.normalizeDenial('vic.test' as CapabilityId, '1.0.0', 'denied');
    assert.equal(denial.success, false);

    const timeout = ResultNormalizer.normalizeTimeout('vic.test' as CapabilityId, '1.0.0', 5000);
    assert.equal(timeout.success, false);

    const failure = ResultNormalizer.normalizeFailure('vic.test' as CapabilityId, '1.0.0', 'fail');
    assert.equal(failure.success, false);

    const approvalReq = ResultNormalizer.normalizeApprovalRequired('vic.test' as CapabilityId, '1.0.0', 'tok-1');
    assert.equal(approvalReq.success, false);
  });
});
