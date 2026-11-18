import type { ExecutionState } from '@victor/shared';

export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly fromState: ExecutionState,
    public readonly toState: ExecutionState,
    public readonly executionId: string,
    message?: string
  ) {
    super(
      message ||
        `Invalid execution state transition from '${fromState}' to '${toState}' for execution '${executionId}'.`
    );
    this.name = 'InvalidStateTransitionError';
  }
}

export class ExecutionStateMachine {
  private static readonly VALID_TRANSITIONS: Record<ExecutionState, ReadonlySet<ExecutionState>> = {
    requested: new Set<ExecutionState>(['denied', 'approval_required', 'authorized']),
    approval_required: new Set<ExecutionState>(['authorized', 'denied', 'cancelled', 'timed_out']),
    authorized: new Set<ExecutionState>(['queued', 'cancelled']),
    queued: new Set<ExecutionState>(['running', 'cancelled', 'timed_out']),
    running: new Set<ExecutionState>(['succeeded', 'failed', 'cancelled', 'timed_out']),
    succeeded: new Set<ExecutionState>(), // Terminal
    failed: new Set<ExecutionState>(), // Terminal
    cancelled: new Set<ExecutionState>(), // Terminal
    timed_out: new Set<ExecutionState>(), // Terminal
    denied: new Set<ExecutionState>(), // Terminal
  };

  /**
   * Checks whether a transition between two states is valid.
   */
  public static isValidTransition(from: ExecutionState, to: ExecutionState): boolean {
    const allowed = this.VALID_TRANSITIONS[from];
    return allowed ? allowed.has(to) : false;
  }

  /**
   * Asserts that a state transition is permitted, throwing InvalidStateTransitionError if not.
   */
  public static assertTransition(from: ExecutionState, to: ExecutionState, executionId: string): void {
    if (!this.isValidTransition(from, to)) {
      throw new InvalidStateTransitionError(from, to, executionId);
    }
  }

  /**
   * Determines if a given state is terminal.
   */
  public static isTerminal(state: ExecutionState): boolean {
    const allowed = this.VALID_TRANSITIONS[state];
    return !allowed || allowed.size === 0;
  }
}
