import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthorityEngine,
  CapabilityRegistry,
} from '../../src/index';
import type {
  IdentityContext,
  OwnerId,
  DeviceId,
  CapabilityId,
  ExecutionEnvelope,
  ExecutionId,
} from '@victor/shared';

test('ExecutionLifecycle E2E: L2 capability execution progression to succeeded', async () => {
  const registry = new CapabilityRegistry([
    {
      id: 'vic.math.add' as CapabilityId,
      name: 'Add Numbers',
      description: 'L2 computation',
      authorityLevel: 2,
      target: 'cloud',
      status: 'available',
    },
  ]);
  const engine = new AuthorityEngine(registry);

  const context: IdentityContext = {
    ownerId: 'owner-1' as OwnerId,
    actorType: 'owner',
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-1',
    issuedAt: new Date().toISOString(),
  };

  const envelope: ExecutionEnvelope = {
    executionId: 'exec-math-1' as ExecutionId,
    identityContext: context,
    capabilityId: 'vic.math.add' as CapabilityId,
    params: { a: 10, b: 20 },
    payloadHash: 'hash-math',
    riskClassification: 'reversible',
    authorityLevel: 2,
    createdAt: new Date().toISOString(),
  };

  const result = await engine.executeEnvelope(envelope, async () => {
    return { data: { sum: 30 } };
  });

  assert.equal(result.state, 'succeeded');
  assert.equal(result.authorized, true);
  assert.deepEqual(result.data, { sum: 30 });
  assert.ok(result.evidence?.verified);
  assert.ok(result.timestamps.requestedAt);
  assert.ok(result.timestamps.authorizedAt);
  assert.ok(result.timestamps.startedAt);
  assert.ok(result.timestamps.completedAt);
});

test('ExecutionLifecycle E2E: L3 capability without approval token returns approval_required', async () => {
  const registry = new CapabilityRegistry([
    {
      id: 'vic.system.reboot' as CapabilityId,
      name: 'Reboot System',
      description: 'L3 operation',
      authorityLevel: 3,
      target: 'device',
      status: 'available',
    },
  ]);
  const engine = new AuthorityEngine(registry);

  const context: IdentityContext = {
    ownerId: 'owner-1' as OwnerId,
    actorType: 'owner',
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-reboot',
    issuedAt: new Date().toISOString(),
  };

  const envelope: ExecutionEnvelope = {
    executionId: 'exec-reboot-1' as ExecutionId,
    identityContext: context,
    capabilityId: 'vic.system.reboot' as CapabilityId,
    params: { force: true },
    payloadHash: 'hash-reboot',
    riskClassification: 'consequential',
    authorityLevel: 3,
    createdAt: new Date().toISOString(),
  };

  const result = await engine.executeEnvelope(envelope, async () => {
    return { data: { rebooted: true } };
  });

  assert.equal(result.state, 'approval_required');
  assert.equal(result.authorized, false);
  assert.equal(result.errorCode, 'APPROVAL_REQUIRED');
});

test('ExecutionLifecycle E2E: L3 capability with confirmed approval executes and consumes token', async () => {
  const registry = new CapabilityRegistry([
    {
      id: 'vic.system.reboot' as CapabilityId,
      name: 'Reboot System',
      description: 'L3 operation',
      authorityLevel: 3,
      target: 'device',
      status: 'available',
    },
  ]);
  const engine = new AuthorityEngine(registry);

  const context: IdentityContext = {
    ownerId: 'owner-1' as OwnerId,
    actorType: 'owner',
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-reboot',
    issuedAt: new Date().toISOString(),
  };

  const params = { force: true };

  // Step 1: Stage operation to generate approval token
  const stageRes = await engine.evaluateOperation({
    capabilityId: 'vic.system.reboot',
    params,
    ownerId: 'owner-1',
    identityContext: context,
  });

  assert.ok(stageRes.approvalToken);

  // Step 2: Owner confirms approval
  const confirmed = await engine.confirmApproval(
    stageRes.approvalToken,
    'owner-1',
    params
  );
  assert.equal(confirmed, true);

  // Step 3: Execute envelope with approvalToken
  const envelope: ExecutionEnvelope = {
    executionId: 'exec-reboot-confirmed' as ExecutionId,
    identityContext: context,
    capabilityId: 'vic.system.reboot' as CapabilityId,
    params,
    payloadHash: stageRes.payloadHash!,
    riskClassification: 'consequential',
    authorityLevel: 3,
    approvalToken: stageRes.approvalToken,
    createdAt: new Date().toISOString(),
  };

  const result = await engine.executeEnvelope(envelope, async () => {
    return { data: { rebooted: true } };
  });

  assert.equal(result.state, 'succeeded');
  assert.equal(result.authorized, true);
  assert.deepEqual(result.data, { rebooted: true });

  // Step 4: Replay attack prevention - attempting to execute with same token again is denied
  const replayResult = await engine.executeEnvelope(
    { ...envelope, executionId: 'exec-reboot-replay' as ExecutionId },
    async () => ({ data: { rebooted: true } })
  );

  assert.equal(replayResult.state, 'denied');
  assert.equal(replayResult.errorCode, 'INVALID_APPROVAL');
});

test('ExecutionLifecycle E2E: AC-13 - Execution timeout triggers timed_out state', async () => {
  const registry = new CapabilityRegistry([
    {
      id: 'vic.slow.task' as CapabilityId,
      name: 'Slow Task',
      description: 'Takes too long',
      authorityLevel: 2,
      target: 'cloud',
      status: 'available',
    },
  ]);
  const engine = new AuthorityEngine(registry);

  const context: IdentityContext = {
    ownerId: 'owner-1' as OwnerId,
    actorType: 'owner',
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-slow',
    issuedAt: new Date().toISOString(),
  };

  const envelope: ExecutionEnvelope = {
    executionId: 'exec-slow-1' as ExecutionId,
    identityContext: context,
    capabilityId: 'vic.slow.task' as CapabilityId,
    params: {},
    payloadHash: 'hash-slow',
    riskClassification: 'reversible',
    authorityLevel: 2,
    timeoutMs: 50, // 50ms timeout
    createdAt: new Date().toISOString(),
  };

  const result = await engine.executeEnvelope(envelope, async () => {
    // Deliberately delay 200ms
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { data: { done: true } };
  });

  assert.equal(result.state, 'timed_out');
  assert.equal(result.errorCode, 'EXECUTION_TIMEOUT');
  assert.match(result.error || '', /timed out/i);
});

test('ExecutionLifecycle E2E: Idempotency integration caches completed result', async () => {
  const registry = new CapabilityRegistry([
    {
      id: 'vic.generate.uuid' as CapabilityId,
      name: 'Generate UUID',
      description: 'Idempotent call',
      authorityLevel: 2,
      target: 'cloud',
      status: 'available',
    },
  ]);
  const engine = new AuthorityEngine(registry);

  const context: IdentityContext = {
    ownerId: 'owner-1' as OwnerId,
    actorType: 'owner',
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-idemp',
    issuedAt: new Date().toISOString(),
  };

  let executionCounter = 0;

  const runCall = (execId: string) =>
    engine.executeEnvelope(
      {
        executionId: execId as ExecutionId,
        identityContext: context,
        capabilityId: 'vic.generate.uuid' as CapabilityId,
        params: { seed: 'fixed-seed' },
        payloadHash: 'hash-seed',
        idempotencyKey: 'idemp-fixed-key',
        riskClassification: 'reversible',
        authorityLevel: 2,
        createdAt: new Date().toISOString(),
      },
      async () => {
        executionCounter++;
        return { data: { generatedId: 'id-alpha', callCount: executionCounter } };
      }
    );

  // Call 1
  const first = await runCall('exec-1');
  assert.equal(first.state, 'succeeded');
  assert.deepEqual(first.data, { generatedId: 'id-alpha', callCount: 1 });
  assert.equal(executionCounter, 1);

  // Call 2 with identical key
  const second = await runCall('exec-2');
  assert.equal(second.state, 'succeeded');
  // Returns cached callCount: 1, executor did NOT run again!
  assert.deepEqual(second.data, { generatedId: 'id-alpha', callCount: 1 });
  assert.equal(executionCounter, 1);
});
