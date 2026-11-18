import test from 'node:test';
import assert from 'node:assert/strict';
import { ResultVerifier } from '../../src/vte/result-verifier';
import type { CapabilityDefinition, CapabilityId } from '@victor/shared';

test('ResultVerifier: AC-10 - Capability requiring evidence rejects outcome if evidence missing', () => {
  const capability: CapabilityDefinition = {
    id: 'vic.external.charge' as CapabilityId,
    name: 'External Charge',
    description: 'Requires receipt evidence',
    authorityLevel: 3,
    target: 'cloud',
    status: 'available',
    verificationRequired: true,
  };

  const outcomeWithoutEvidence = ResultVerifier.verifyOutcome(capability, { charged: true });
  assert.equal(outcomeWithoutEvidence.valid, false);
  assert.match(outcomeWithoutEvidence.reason || '', /requires verified outcome evidence/i);
});

test('ResultVerifier: AC-10 - External receipt level rejects empty receipts', () => {
  const capability: CapabilityDefinition = {
    id: 'vic.external.charge' as CapabilityId,
    name: 'External Charge',
    description: 'Requires receipt evidence',
    authorityLevel: 3,
    target: 'cloud',
    status: 'available',
    verificationRequired: true,
  };

  const outcomeWithEmptyReceipt = ResultVerifier.verifyOutcome(capability, { charged: true }, {
    verified: true,
    verificationLevel: 'external_receipt',
    receipt: {}, // Empty
  });
  assert.equal(outcomeWithEmptyReceipt.valid, false);
  assert.match(outcomeWithEmptyReceipt.reason || '', /receipt is missing or empty/i);
});

test('ResultVerifier: Valid verification evidence is certified successfully', () => {
  const capability: CapabilityDefinition = {
    id: 'vic.external.charge' as CapabilityId,
    name: 'External Charge',
    description: 'Requires receipt evidence',
    authorityLevel: 3,
    target: 'cloud',
    status: 'available',
    verificationRequired: true,
  };

  const outcome = ResultVerifier.verifyOutcome(capability, { charged: true }, {
    verified: true,
    verificationLevel: 'external_receipt',
    receipt: { txId: 'tx-9999', status: 'CONFIRMED' },
    verifier: 'payment-gateway',
  });
  assert.equal(outcome.valid, true);
  assert.equal(outcome.evidence.verified, true);
  assert.equal(outcome.evidence.verificationLevel, 'external_receipt');
});
