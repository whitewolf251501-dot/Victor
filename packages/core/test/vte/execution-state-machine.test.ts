import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ExecutionStateMachine,
  InvalidStateTransitionError,
} from '../../src/vte/execution-state-machine';

test('ExecutionStateMachine: Valid lifecycle transition progression', () => {
  const executionId = 'exec-1';

  // Happy path
  assert.doesNotThrow(() => {
    ExecutionStateMachine.assertTransition('requested', 'authorized', executionId);
    ExecutionStateMachine.assertTransition('authorized', 'queued', executionId);
    ExecutionStateMachine.assertTransition('queued', 'running', executionId);
    ExecutionStateMachine.assertTransition('running', 'succeeded', executionId);
  });

  // Approval path
  assert.doesNotThrow(() => {
    ExecutionStateMachine.assertTransition('requested', 'approval_required', executionId);
    ExecutionStateMachine.assertTransition('approval_required', 'authorized', executionId);
  });

  // Timeout path
  assert.doesNotThrow(() => {
    ExecutionStateMachine.assertTransition('running', 'timed_out', executionId);
  });

  // Cancellation path
  assert.doesNotThrow(() => {
    ExecutionStateMachine.assertTransition('queued', 'cancelled', executionId);
  });
});

test('ExecutionStateMachine: Illegal state transitions are rejected with InvalidStateTransitionError', () => {
  const executionId = 'exec-invalid';

  // Cannot skip authorization directly to succeeded
  assert.throws(
    () => ExecutionStateMachine.assertTransition('requested', 'succeeded', executionId),
    InvalidStateTransitionError
  );

  // Cannot rewind from running back to requested
  assert.throws(
    () => ExecutionStateMachine.assertTransition('running', 'requested', executionId),
    InvalidStateTransitionError
  );

  // Terminal state: succeeded cannot transition to anything
  assert.throws(
    () => ExecutionStateMachine.assertTransition('succeeded', 'running', executionId),
    InvalidStateTransitionError
  );

  // Terminal state: failed cannot transition to running
  assert.throws(
    () => ExecutionStateMachine.assertTransition('failed', 'running', executionId),
    InvalidStateTransitionError
  );
});

test('ExecutionStateMachine: isTerminal correctly identifies terminal states', () => {
  assert.equal(ExecutionStateMachine.isTerminal('succeeded'), true);
  assert.equal(ExecutionStateMachine.isTerminal('failed'), true);
  assert.equal(ExecutionStateMachine.isTerminal('cancelled'), true);
  assert.equal(ExecutionStateMachine.isTerminal('timed_out'), true);
  assert.equal(ExecutionStateMachine.isTerminal('denied'), true);

  assert.equal(ExecutionStateMachine.isTerminal('requested'), false);
  assert.equal(ExecutionStateMachine.isTerminal('authorized'), false);
  assert.equal(ExecutionStateMachine.isTerminal('queued'), false);
  assert.equal(ExecutionStateMachine.isTerminal('running'), false);
  assert.equal(ExecutionStateMachine.isTerminal('approval_required'), false);
});
