import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PlanStep, StepId, PlanId, TaskId, IdempotencyKey } from '@victor/shared';
import {
  PlanGraph,
  CyclicDependencyError,
  InvalidDependencyError,
  InvalidStepStateTransitionError,
} from '../../src/planning/plan-graph';

function makeStep(id: string, dependencies: string[] = [], state: PlanStep['state'] = 'pending'): PlanStep {
  return {
    id: id as StepId,
    planId: 'plan-1' as PlanId,
    taskId: 'task-1' as TaskId,
    name: `Step ${id}`,
    capabilityId: 'vic.test' as any,
    authorityLevel: 2,
    params: {},
    dependencies: dependencies as StepId[],
    state,
    idempotencyKey: `key-${id}` as IdempotencyKey,
    retryCount: 0,
    maxRetries: 3,
  };
}

describe('System 4: PlanGraph Specification Suite', () => {
  it('AC-02 - Detects and rejects missing / dangling dependencies', () => {
    const steps = [
      makeStep('step-1'),
      makeStep('step-2', ['non-existent-step']),
    ];

    assert.throws(
      () => new PlanGraph(steps),
      (err: any) => {
        assert(err instanceof InvalidDependencyError);
        assert.equal(err.missingDependencyId, 'non-existent-step');
        return true;
      }
    );
  });

  it('AC-02 - Detects and rejects cyclic dependencies (direct and indirect)', () => {
    // Direct cycle: A -> B -> A
    const directCycle = [
      makeStep('A', ['B']),
      makeStep('B', ['A']),
    ];

    assert.throws(
      () => new PlanGraph(directCycle),
      (err: any) => {
        assert(err instanceof CyclicDependencyError);
        return true;
      }
    );

    // Indirect cycle: A -> B -> C -> A
    const indirectCycle = [
      makeStep('A', ['C']),
      makeStep('B', ['A']),
      makeStep('C', ['B']),
    ];

    assert.throws(
      () => new PlanGraph(indirectCycle),
      (err: any) => {
        assert(err instanceof CyclicDependencyError);
        return true;
      }
    );
  });

  it('AC-02 - Performs topological sorting for valid DAGs', () => {
    // D depends on B and C; B depends on A; C depends on A; A has no deps
    const steps = [
      makeStep('D', ['B', 'C']),
      makeStep('B', ['A']),
      makeStep('A', []),
      makeStep('C', ['A']),
    ];

    const graph = new PlanGraph(steps);
    const order = graph.getExecutionOrder().map((s) => s.id);

    assert.equal(order[0], 'A');
    assert(order.indexOf('B') > order.indexOf('A'));
    assert(order.indexOf('C') > order.indexOf('A'));
    assert(order.indexOf('D') > order.indexOf('B'));
    assert(order.indexOf('D') > order.indexOf('C'));
  });

  it('AC-02 - Resolves ready steps only when dependencies are fully completed', () => {
    const steps = [
      makeStep('A', [], 'pending'),
      makeStep('B', ['A'], 'pending'),
      makeStep('C', ['B'], 'pending'),
    ];

    const graph = new PlanGraph(steps);

    // Initially, only A is ready
    let ready = graph.getReadySteps();
    assert.equal(ready.length, 1);
    assert.equal(ready[0].id, 'A');

    // Transition A to running -> no steps ready
    graph.transitionStep('A' as StepId, 'running');
    ready = graph.getReadySteps();
    assert.equal(ready.length, 0);

    // Transition A to completed -> B becomes ready
    graph.transitionStep('A' as StepId, 'completed');
    ready = graph.getReadySteps();
    assert.equal(ready.length, 1);
    assert.equal(ready[0].id, 'B');

    // Complete B -> C becomes ready
    graph.transitionStep('B' as StepId, 'ready');
    graph.transitionStep('B' as StepId, 'running');
    graph.transitionStep('B' as StepId, 'completed');
    ready = graph.getReadySteps();
    assert.equal(ready.length, 1);
    assert.equal(ready[0].id, 'C');
  });

  it('AC-02 - Enforces valid step state transitions and rejects illegal transitions', () => {
    const steps = [makeStep('A', [], 'pending')];
    const graph = new PlanGraph(steps);

    // pending -> completed is illegal (must execute/run first)
    assert.throws(
      () => graph.transitionStep('A' as StepId, 'completed'),
      (err: any) => err instanceof InvalidStepStateTransitionError
    );

    // Valid: pending -> ready -> running -> completed
    graph.transitionStep('A' as StepId, 'ready');
    graph.transitionStep('A' as StepId, 'running');
    const completed = graph.transitionStep('A' as StepId, 'completed');
    assert.equal(completed.state, 'completed');
    assert(completed.completedAt !== undefined);

    // completed is terminal -> cannot transition to ready
    assert.throws(
      () => graph.transitionStep('A' as StepId, 'ready'),
      (err: any) => err instanceof InvalidStepStateTransitionError
    );
  });

  it('AC-07 - Calculates progress percentage accurately without false completion', () => {
    const steps = [
      makeStep('A', [], 'completed'),
      makeStep('B', ['A'], 'completed'),
      makeStep('C', ['B'], 'running'),
      makeStep('D', ['C'], 'pending'),
    ];

    const graph = new PlanGraph(steps);
    assert.equal(graph.calculateProgressPct(), 50);
    assert.equal(graph.isPlanCompleted(), false);

    graph.transitionStep('C' as StepId, 'completed');
    assert.equal(graph.calculateProgressPct(), 75);

    graph.transitionStep('D' as StepId, 'ready');
    graph.transitionStep('D' as StepId, 'running');
    graph.transitionStep('D' as StepId, 'completed');
    assert.equal(graph.calculateProgressPct(), 100);
    assert.equal(graph.isPlanCompleted(), true);
  });
});
