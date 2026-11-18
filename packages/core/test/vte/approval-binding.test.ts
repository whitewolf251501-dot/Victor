import test from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalManager } from '../../src/vte/approval-manager';
import type { OwnerId, CapabilityId } from '@victor/shared';

test('ApprovalBinding: Exact payload hash binding & successful confirmation', async () => {
  const manager = new ApprovalManager();
  const ownerId = 'owner-alpha' as OwnerId;
  const params = { amount: 100, recipient: 'Alice', notes: 'Payment' };

  const binding = await manager.createApproval({
    ownerId,
    capabilityId: 'vic.transfer' as CapabilityId,
    params,
    authorityLevel: 3,
    riskClassification: 'consequential',
  });

  assert.ok(binding.token);
  assert.ok(binding.payloadHash);

  // Confirm with identical params
  const result = await manager.confirmApproval(binding.token, ownerId, {
    amount: 100,
    recipient: 'Alice',
    notes: 'Payment',
  });

  assert.equal(result.success, true);
  assert.ok(result.binding?.confirmedAt);
});

test('ApprovalBinding: Tamper detection rejects confirmation if parameters altered', async () => {
  const manager = new ApprovalManager();
  const ownerId = 'owner-alpha' as OwnerId;
  const originalParams = { amount: 100, recipient: 'Alice' };

  const binding = await manager.createApproval({
    ownerId,
    capabilityId: 'vic.transfer' as CapabilityId,
    params: originalParams,
    authorityLevel: 3,
    riskClassification: 'consequential',
  });

  // Tampered params: amount changed to 10000
  const tamperedParams = { amount: 10000, recipient: 'Alice' };
  const result = await manager.confirmApproval(binding.token, ownerId, tamperedParams);

  assert.equal(result.success, false);
  assert.match(result.reason || '', /tamper detected/i);
});

test('ApprovalBinding: Cross-owner isolation rejects confirmation from different owner', async () => {
  const manager = new ApprovalManager();
  const ownerA = 'owner-A' as OwnerId;
  const ownerB = 'owner-B' as OwnerId;

  const binding = await manager.createApproval({
    ownerId: ownerA,
    capabilityId: 'vic.message.send' as CapabilityId,
    params: { text: 'Secret message' },
    authorityLevel: 3,
    riskClassification: 'consequential',
  });

  const result = await manager.confirmApproval(binding.token, ownerB);
  assert.equal(result.success, false);
  assert.match(result.reason || '', /does not belong to owner/i);
});

test('ApprovalBinding: Expired approval token cannot be confirmed', async () => {
  const manager = new ApprovalManager();
  const ownerId = 'owner-alpha' as OwnerId;

  // TTL = -10 seconds (already expired)
  const binding = await manager.createApproval({
    ownerId,
    capabilityId: 'vic.message.send' as CapabilityId,
    params: { text: 'Fast expiry' },
    authorityLevel: 3,
    riskClassification: 'consequential',
    ttlSeconds: -10,
  });

  const result = await manager.confirmApproval(binding.token, ownerId);
  assert.equal(result.success, false);
  assert.match(result.reason || '', /expired/i);
});

test('ApprovalBinding: Single-use consumption prevents replay attacks', async () => {
  const manager = new ApprovalManager();
  const ownerId = 'owner-alpha' as OwnerId;
  const params = { action: 'delete_backup' };

  const binding = await manager.createApproval({
    ownerId,
    capabilityId: 'vic.backup.delete' as CapabilityId,
    params,
    authorityLevel: 3,
    riskClassification: 'sensitive',
  });

  // First consumption succeeds
  const firstConsume = await manager.consumeApproval(binding.token, ownerId, params);
  assert.equal(firstConsume.success, true);
  assert.ok(firstConsume.binding?.consumedAt);

  // Second consumption attempt (replay attack) fails
  const replayAttempt = await manager.consumeApproval(binding.token, ownerId, params);
  assert.equal(replayAttempt.success, false);
  assert.match(replayAttempt.reason || '', /already been consumed|already been confirmed/i);
});

test('ApprovalBinding: Denied approval cannot be confirmed or re-denied', async () => {
  const manager = new ApprovalManager();
  const ownerId = 'owner-alpha' as OwnerId;

  const binding = await manager.createApproval({
    ownerId,
    capabilityId: 'vic.call.make' as CapabilityId,
    params: { number: '123' },
    authorityLevel: 3,
    riskClassification: 'consequential',
  });

  const denyRes = await manager.denyApproval(binding.token, ownerId);
  assert.equal(denyRes.success, true);

  const confirmRes = await manager.confirmApproval(binding.token, ownerId);
  assert.equal(confirmRes.success, false);
  assert.match(confirmRes.reason || '', /denied/i);
});
