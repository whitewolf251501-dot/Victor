import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VictorCore, VictorCoreError } from '../../src/intelligence/victor-core';
import { ModelRouter } from '../../src/model/model-router';
import { DeterministicProvider } from '../../src/model/deterministic-provider';
import type { IdentityContext, OwnerId, DeviceId } from '@victor/shared';

function createMockIdentity(): IdentityContext {
  return {
    ownerId: 'owner_test_123' as OwnerId,
    deviceId: 'dev_test_abc' as DeviceId,
    actorType: 'owner',
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr_test_001',
    issuedAt: new Date().toISOString(),
  };
}

describe('System 1: VictorCore Orchestrator Specification Suite', () => {
  it('rejects unauthenticated requests lacking ownerId', async () => {
    const provider = new DeterministicProvider();
    const router = new ModelRouter({ primary: provider });
    const core = new VictorCore(router);

    await assert.rejects(
      async () =>
        core.processRequest({
          message: 'Hello Victor',
          identityContext: null as unknown as IdentityContext,
        }),
      (err: Error) => err instanceof VictorCoreError && err.code === 'UNAUTHORIZED_CONTEXT'
    );
  });

  it('rejects empty or invalid messages', async () => {
    const provider = new DeterministicProvider();
    const router = new ModelRouter({ primary: provider });
    const core = new VictorCore(router);

    await assert.rejects(
      async () =>
        core.processRequest({
          message: null as unknown as string,
          identityContext: createMockIdentity(),
        }),
      (err: Error) => err instanceof VictorCoreError && err.code === 'INVALID_REQUEST'
    );
  });

  it('processes general conversation and returns structured CoreResponse with metrics', async () => {
    const provider = new DeterministicProvider({
      modelName: 'deterministic-vic',
      defaultResponse: 'Standing by for directives, Commander.',
    });
    const router = new ModelRouter({ primary: provider });
    const core = new VictorCore(router);

    const response = await core.processRequest({
      message: 'Greetings, Victor.',
      identityContext: createMockIdentity(),
      deviceType: 'web',
      contextMemories: '• User is building Victor monorepo.',
    });

    assert.equal(response.content, 'Standing by for directives, Commander.');
    assert.equal(response.intent.type, 'conversation');
    assert.equal(response.proposals.length, 0);
    assert.equal(response.metrics.model, 'deterministic-vic');
    assert.equal(response.metrics.fallbackUsed, false);
  });

  it('emits CapabilityProposal for L2 action directive (web search)', async () => {
    const provider = new DeterministicProvider({
      defaultResponse: 'Initiating search telemetry.',
    });
    const router = new ModelRouter({ primary: provider });
    const core = new VictorCore(router);

    const response = await core.processRequest({
      message: 'search the web for Quantum Computing breakthroughs',
      identityContext: createMockIdentity(),
    });

    assert.equal(response.intent.type, 'action');
    assert.equal(response.intent.capabilityId, 'vic.web.search');
    assert.equal(response.proposals.length, 1);

    const proposal = response.proposals[0];
    assert.equal(proposal.capabilityId, 'vic.web.search');
    assert.equal(proposal.authorityLevel, 2); // L2 Execute
    assert.equal(proposal.params.query, 'Quantum Computing breakthroughs');
    assert.ok(proposal.proposalId.startsWith('prop_'));
  });

  it('emits CapabilityProposal with L4 authority level for restricted action directive', async () => {
    const provider = new DeterministicProvider({
      defaultResponse: 'Evaluating restricted operation.',
    });
    const router = new ModelRouter({ primary: provider });
    const core = new VictorCore(router);

    const response = await core.processRequest({
      message: 'wipe audit_log',
      identityContext: createMockIdentity(),
    });

    assert.equal(response.intent.type, 'action');
    assert.equal(response.intent.capabilityId, 'vic.system.wipe_audit_log');
    assert.equal(response.proposals.length, 1);

    const proposal = response.proposals[0];
    assert.equal(proposal.capabilityId, 'vic.system.wipe_audit_log');
    // wipe audit log is restricted L4 in system policy
    assert.equal(proposal.authorityLevel, 4);
  });

  it('streams response chunks and emits intent and proposals in first yield', async () => {
    const provider = new DeterministicProvider({
      defaultResponse: 'Alpha Bravo Charlie',
    });
    const router = new ModelRouter({ primary: provider });
    const core = new VictorCore(router);

    const generator = core.streamRequest({
      message: 'execute command: ls -la',
      identityContext: createMockIdentity(),
    });

    const receivedChunks: string[] = [];
    let initialIntentFound = false;
    let initialProposalFound = false;

    for await (const chunk of generator) {
      receivedChunks.push(chunk.chunk);
      if (chunk.intent) {
        initialIntentFound = true;
        assert.equal(chunk.intent.capabilityId, 'vic.terminal.execute');
      }
      if (chunk.proposals && chunk.proposals.length > 0) {
        initialProposalFound = true;
      }
    }

    assert.ok(receivedChunks.length >= 1);
    assert.equal(initialIntentFound, true);
    assert.equal(initialProposalFound, true);
  });
});
