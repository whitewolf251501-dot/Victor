import test from 'node:test';
import assert from 'node:assert/strict';
import { IdempotencyManager } from '../../src/vte/idempotency-manager';
import type { OwnerId, CapabilityId, ExecutionId, ExecutionResult } from '@victor/shared';

test('IdempotencyManager: Replay of completed request returns cached result without re-executing', async () => {
  const manager = new IdempotencyManager();
  const ownerId = 'owner-idempotent' as OwnerId;
  const capabilityId = 'vic.file.write' as CapabilityId;
  const idempotencyKey = 'key-12345';
  const payloadHash = 'hash-abcde';
  const executionId = 'exec-initial' as ExecutionId;

  // 1. First execution begins
  const begin1 = await manager.beginExecution(
    idempotencyKey,
    ownerId,
    capabilityId,
    payloadHash,
    executionId
  );
  assert.equal(begin1.allowed, true);

  // 2. Commit execution result
  const cachedExecutionResult: ExecutionResult = {
    executionId,
    state: 'succeeded',
    authorized: true,
    data: { bytesWritten: 512 },
    executionTimeMs: 42,
    timestamps: { requestedAt: new Date().toISOString() },
  };
  await manager.commitExecution(idempotencyKey, ownerId, cachedExecutionResult);

  // 3. Second execution with same key and payloadHash (Replay)
  const begin2 = await manager.beginExecution(
    idempotencyKey,
    ownerId,
    capabilityId,
    payloadHash,
    'exec-replay' as ExecutionId
  );
  assert.equal(begin2.allowed, false);
  assert.equal(begin2.isCached, true);
  assert.deepEqual(begin2.cachedResult, cachedExecutionResult);
});

test('IdempotencyManager: Reusing idempotency key with different payload is rejected as conflict', async () => {
  const manager = new IdempotencyManager();
  const ownerId = 'owner-idempotent' as OwnerId;
  const capabilityId = 'vic.file.write' as CapabilityId;
  const idempotencyKey = 'key-reuse';

  await manager.beginExecution(
    idempotencyKey,
    ownerId,
    capabilityId,
    'original-hash',
    'exec-1' as ExecutionId
  );

  const conflictAttempt = await manager.beginExecution(
    idempotencyKey,
    ownerId,
    capabilityId,
    'different-hash',
    'exec-2' as ExecutionId
  );

  assert.equal(conflictAttempt.allowed, false);
  assert.match(conflictAttempt.reason || '', /idempotency conflict/i);
});

test('IdempotencyManager: Duplicate concurrent execution while pending is blocked', async () => {
  const manager = new IdempotencyManager();
  const ownerId = 'owner-idempotent' as OwnerId;
  const capabilityId = 'vic.file.write' as CapabilityId;
  const idempotencyKey = 'key-concurrent';
  const payloadHash = 'same-hash';

  const begin1 = await manager.beginExecution(
    idempotencyKey,
    ownerId,
    capabilityId,
    payloadHash,
    'exec-1' as ExecutionId
  );
  assert.equal(begin1.allowed, true);

  // Concurrent second call before first commits
  const begin2 = await manager.beginExecution(
    idempotencyKey,
    ownerId,
    capabilityId,
    payloadHash,
    'exec-2' as ExecutionId
  );
  assert.equal(begin2.allowed, false);
  assert.match(begin2.reason || '', /duplicate execution|currently being processed/i);
});
