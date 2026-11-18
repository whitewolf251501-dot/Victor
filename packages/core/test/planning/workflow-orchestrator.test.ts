import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthorityEngine,
  CapabilityRegistry,
  BUILTIN_CAPABILITIES,
  WorkflowOrchestrator,
  TaskPlanner,
} from '../../src/index';
import type {
  IdentityContext,
  OwnerId,
  DeviceId,
  SessionId,
  TaskPlan,
  PlanProgressEvent,
} from '@victor/shared';

function createOwnerContext(ownerId: string = 'owner-123'): IdentityContext {
  return {
    ownerId: ownerId as OwnerId,
    actorType: 'owner',
    deviceId: 'device-456' as DeviceId,
    sessionId: 'session-789' as SessionId,
    scopes: ['*'],
    roles: ['owner'],
    authMethod: 'session_jwt',
    correlationId: 'corr-orch',
    issuedAt: new Date().toISOString(),
  };
}

describe('System 4: WorkflowOrchestrator Specification Suite', () => {
  it('AC-01 & AC-02 - Executes multi-step DAG workflow with verified topological sequence', async () => {
    const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
    const engine = new AuthorityEngine(registry);

    const executedSteps: string[] = [];
    const orchestrator = new WorkflowOrchestrator(engine, async (step) => {
      executedSteps.push(step.name);
      return { data: { completed: true, stepName: step.name } };
    });

    const planner = new TaskPlanner(registry);
    const plan = planner.createPlan(
      'owner-123' as OwnerId,
      'Execute multi-step workflow',
      [
        { name: 'Step 1: Read memory', capabilityId: 'vic.memory.read' as any, params: {} },
        {
          name: 'Step 2: Web Search',
          capabilityId: 'vic.web.search' as any,
          params: { query: 'test' },
          dependencies: ['Step 1: Read memory'],
        },
      ]
    );

    const context = createOwnerContext('owner-123');
    const completedPlan = await orchestrator.executePlan(plan, context);

    assert.equal(completedPlan.state, 'completed');
    assert.equal(executedSteps.length, 2);
    assert.equal(executedSteps[0], 'Step 1: Read memory');
    assert.equal(executedSteps[1], 'Step 2: Web Search');
    assert(completedPlan.completedAt !== undefined);
  });

  it('AC-01 - Strictly enforces owner tenant isolation on plan execution', async () => {
    const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
    const engine = new AuthorityEngine(registry);
    const orchestrator = new WorkflowOrchestrator(engine);

    const planner = new TaskPlanner(registry);
    const plan = planner.createPlan(
      'legit-owner' as OwnerId,
      'Private goal',
      [{ name: 'Step 1', capabilityId: 'vic.memory.read' as any, params: {} }]
    );

    const attackerContext = createOwnerContext('attacker-owner');

    await assert.rejects(
      () => orchestrator.executePlan(plan, attackerContext),
      /Unauthorized: Context owner 'attacker-owner' does not match plan owner 'legit-owner'/
    );
  });

  it('AC-05 - Pauses on L3 approval-required step and resumes after owner confirmation', async () => {
    const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
    const engine = new AuthorityEngine(registry);

    const orchestrator = new WorkflowOrchestrator(engine, async (step) => {
      return { data: { success: true, stepName: step.name } };
    });

    const planner = new TaskPlanner(registry);
    const plan = planner.createPlan(
      'owner-123' as OwnerId,
      'Execute plan with sensitive operation',
      [
        { name: 'Step 1: Read memory', capabilityId: 'vic.memory.read' as any, params: {} },
        {
          name: 'Step 2: Send message (L3)',
          capabilityId: 'vic.message.send' as any,
          params: { recipient: 'john', text: 'hello' },
          dependencies: ['Step 1: Read memory'],
        },
      ]
    );

    const context = createOwnerContext('owner-123');

    // 1. Initial execution: Step 1 completes, Step 2 pauses waiting for approval
    const pausedPlan = await orchestrator.executePlan(plan, context);
    assert.equal(pausedPlan.state, 'paused');

    const step2 = pausedPlan.steps.find((s) => s.name.includes('Step 2'));
    assert(step2 !== undefined);
    assert.equal(step2.state, 'waiting_approval');
    assert(step2.approvalId !== undefined);

    // 2. Owner confirms approval token in VTE
    const approvalConfirmed = await engine.confirmApproval(
      step2.approvalId,
      context.ownerId,
      undefined,
      step2.params
    );
    assert.equal(approvalConfirmed, true);

    // 3. Resume plan with confirmed approval token
    const resumedPlan = await orchestrator.resumePlanWithApproval(
      pausedPlan,
      step2.id,
      step2.approvalId as any,
      context
    );

    assert.equal(resumedPlan.state, 'completed');
    const updatedStep2 = resumedPlan.steps.find((s) => s.id === step2.id);
    assert.equal(updatedStep2?.state, 'completed');
  });

  it('AC-06 - Aborts execution when cancellation signal is triggered', async () => {
    const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
    const engine = new AuthorityEngine(registry);

    const abortController = new AbortController();
    let stepCount = 0;

    const orchestrator = new WorkflowOrchestrator(engine, async (step) => {
      stepCount++;
      if (stepCount === 1) {
        abortController.abort();
      }
      return { data: { success: true } };
    });

    const planner = new TaskPlanner(registry);
    const plan = planner.createPlan(
      'owner-123' as OwnerId,
      'Cancellable plan',
      [
        { name: 'Step 1', capabilityId: 'vic.memory.read' as any, params: {} },
        { name: 'Step 2', capabilityId: 'vic.web.search' as any, params: { query: 'test' }, dependencies: ['Step 1'] },
      ]
    );

    const context = createOwnerContext('owner-123');
    const cancelledPlan = await orchestrator.executePlan(plan, context, { signal: abortController.signal });

    assert.equal(cancelledPlan.state, 'cancelled');
    const step2 = cancelledPlan.steps.find((s) => s.name === 'Step 2');
    assert.equal(step2?.state, 'cancelled');
  });

  it('AC-03 - Safely recovers plan interrupted during process restart', () => {
    const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
    const engine = new AuthorityEngine(registry);
    const orchestrator = new WorkflowOrchestrator(engine);

    const planner = new TaskPlanner(registry);
    const plan = planner.createPlan(
      'owner-123' as OwnerId,
      'Crash recovery plan',
      [
        { name: 'Step 1', capabilityId: 'vic.memory.read' as any, params: {} },
        { name: 'Step 2', capabilityId: 'vic.web.search' as any, params: { query: 'test' }, dependencies: ['Step 1'] },
      ]
    );

    // Simulate crash where Step 1 was left in 'running' and plan in 'executing'
    plan.state = 'executing';
    plan.steps[0].state = 'running';

    const recoveredPlan = orchestrator.recoverPlan(plan);

    assert.equal(recoveredPlan.state, 'validated');
    assert.equal(recoveredPlan.steps[0].state, 'ready');
    assert.equal(recoveredPlan.steps[0].retryCount, 1);
    assert(recoveredPlan.steps[0].idempotencyKey.includes(':retry:1'));
  });

  it('AC-07 - Emits real-time progress events reflecting verified execution steps', async () => {
    const registry = new CapabilityRegistry(BUILTIN_CAPABILITIES);
    const engine = new AuthorityEngine(registry);

    const events: PlanProgressEvent[] = [];
    const orchestrator = new WorkflowOrchestrator(engine, async (step) => ({
      data: { success: true, stepName: step.name },
    }));

    orchestrator.onEvent((evt) => {
      events.push(evt);
    });

    const planner = new TaskPlanner(registry);
    const plan = planner.createPlan(
      'owner-123' as OwnerId,
      'Progress tracking plan',
      [
        { name: 'Step 1', capabilityId: 'vic.memory.read' as any, params: {} },
        { name: 'Step 2', capabilityId: 'vic.web.search' as any, params: { query: 'test' }, dependencies: ['Step 1'] },
      ]
    );

    const context = createOwnerContext('owner-123');
    await orchestrator.executePlan(plan, context);

    const eventTypes = events.map((e) => e.type);
    assert(eventTypes.includes('plan_started'));
    assert(eventTypes.includes('step_started'));
    assert(eventTypes.includes('step_completed'));
    assert(eventTypes.includes('plan_completed'));

    // Verify progress percentage monotonically advances to 100
    const finalEvent = events[events.length - 1];
    assert.equal(finalEvent.type, 'plan_completed');
    assert.equal(finalEvent.progressPct, 100);
  });
});
