import type { PlanStep, PlanStepState, StepId } from '@victor/shared';

export class CyclicDependencyError extends Error {
  constructor(message: string, public readonly cycle: StepId[]) {
    super(message);
    this.name = 'CyclicDependencyError';
  }
}

export class InvalidDependencyError extends Error {
  constructor(message: string, public readonly stepId: StepId, public readonly missingDependencyId: StepId) {
    super(message);
    this.name = 'InvalidDependencyError';
  }
}

export class InvalidStepStateTransitionError extends Error {
  constructor(message: string, public readonly stepId: StepId, public readonly from: PlanStepState, public readonly to: PlanStepState) {
    super(message);
    this.name = 'InvalidStepStateTransitionError';
  }
}

const ALLOWED_STEP_TRANSITIONS: Record<PlanStepState, readonly PlanStepState[]> = {
  pending: ['ready', 'running', 'waiting_approval', 'cancelled', 'skipped'],
  ready: ['running', 'waiting_approval', 'cancelled', 'skipped'],
  waiting_approval: ['ready', 'running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled', 'ready'], // can transition back to ready if retryable or recovered
  failed: ['ready', 'cancelled'], // can transition back to ready if retryable
  completed: [],
  cancelled: [],
  skipped: [],
};

export class PlanGraph {
  private readonly stepMap = new Map<StepId, PlanStep>();
  private readonly adjList = new Map<StepId, Set<StepId>>(); // dependency -> dependents

  constructor(steps: PlanStep[]) {
    for (const step of steps) {
      if (this.stepMap.has(step.id)) {
        throw new Error(`Duplicate step ID detected: ${step.id}`);
      }
      this.stepMap.set(step.id, { ...step });
      this.adjList.set(step.id, new Set<StepId>());
    }

    // Build dependency edges and validate existence
    for (const step of this.stepMap.values()) {
      for (const depId of step.dependencies) {
        if (!this.stepMap.has(depId)) {
          throw new InvalidDependencyError(
            `Step '${step.id}' references unknown dependency '${depId}'`,
            step.id,
            depId
          );
        }
        this.adjList.get(depId)!.add(step.id);
      }
    }

    // Validate that graph is a DAG (no cycles)
    this.detectCycles();
  }

  private detectCycles(): void {
    const visited = new Map<StepId, 'unvisited' | 'visiting' | 'visited'>();
    for (const id of this.stepMap.keys()) {
      visited.set(id, 'unvisited');
    }

    const currentPath: StepId[] = [];

    const dfs = (nodeId: StepId): void => {
      visited.set(nodeId, 'visiting');
      currentPath.push(nodeId);

      const dependents = this.adjList.get(nodeId) ?? new Set<StepId>();
      for (const nextId of dependents) {
        const state = visited.get(nextId);
        if (state === 'visiting') {
          const cycleStartIndex = currentPath.indexOf(nextId);
          const cyclePath = [...currentPath.slice(cycleStartIndex), nextId];
          throw new CyclicDependencyError(
            `Cyclic dependency detected: ${cyclePath.join(' -> ')}`,
            cyclePath
          );
        } else if (state === 'unvisited') {
          dfs(nextId);
        }
      }

      currentPath.pop();
      visited.set(nodeId, 'visited');
    };

    for (const id of this.stepMap.keys()) {
      if (visited.get(id) === 'unvisited') {
        dfs(id);
      }
    }
  }

  public getSteps(): PlanStep[] {
    return Array.from(this.stepMap.values());
  }

  public getStep(id: StepId): PlanStep | undefined {
    return this.stepMap.get(id);
  }

  public getExecutionOrder(): PlanStep[] {
    // Kahn's algorithm for topological sorting
    const inDegree = new Map<StepId, number>();
    for (const step of this.stepMap.values()) {
      inDegree.set(step.id, step.dependencies.length);
    }

    const queue: StepId[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const sorted: PlanStep[] = [];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      sorted.push(this.stepMap.get(currentId)!);

      const dependents = this.adjList.get(currentId) ?? new Set<StepId>();
      for (const depId of dependents) {
        const currentDeg = inDegree.get(depId)! - 1;
        inDegree.set(depId, currentDeg);
        if (currentDeg === 0) {
          queue.push(depId);
        }
      }
    }

    if (sorted.length !== this.stepMap.size) {
      throw new CyclicDependencyError('Graph contains cycles; topological sort impossible', []);
    }

    return sorted;
  }

  public getReadySteps(): PlanStep[] {
    const readySteps: PlanStep[] = [];

    for (const step of this.stepMap.values()) {
      if (step.state !== 'pending' && step.state !== 'ready') {
        continue;
      }

      // Check if all dependencies are 'completed'
      const allDepsCompleted = step.dependencies.every((depId) => {
        const depStep = this.stepMap.get(depId);
        return depStep?.state === 'completed' || depStep?.state === 'skipped';
      });

      if (allDepsCompleted) {
        readySteps.push(step);
      }
    }

    return readySteps;
  }

  public canTransitionStep(current: PlanStepState, next: PlanStepState): boolean {
    if (current === next) return true;
    const allowed = ALLOWED_STEP_TRANSITIONS[current] ?? [];
    return allowed.includes(next);
  }

  public transitionStep(
    stepId: StepId,
    next: PlanStepState,
    update?: Partial<Omit<PlanStep, 'id' | 'planId' | 'taskId' | 'dependencies'>>
  ): PlanStep {
    const step = this.stepMap.get(stepId);
    if (!step) {
      throw new Error(`Step '${stepId}' not found in plan`);
    }

    if (!this.canTransitionStep(step.state, next)) {
      throw new InvalidStepStateTransitionError(
        `Invalid step state transition for '${stepId}' from '${step.state}' to '${next}'`,
        stepId,
        step.state,
        next
      );
    }

    const updated: PlanStep = {
      ...step,
      ...update,
      state: next,
    };

    if (next === 'running' && !updated.startedAt) {
      updated.startedAt = new Date().toISOString();
    }
    if ((next === 'completed' || next === 'failed' || next === 'cancelled') && !updated.completedAt) {
      updated.completedAt = new Date().toISOString();
    }

    this.stepMap.set(stepId, updated);
    return updated;
  }

  public isPlanCompleted(): boolean {
    if (this.stepMap.size === 0) return true;
    for (const step of this.stepMap.values()) {
      if (step.state !== 'completed' && step.state !== 'skipped') {
        return false;
      }
    }
    return true;
  }

  public hasPlanFailed(): boolean {
    for (const step of this.stepMap.values()) {
      if (step.state === 'failed' && step.retryCount >= step.maxRetries) {
        return true;
      }
    }
    return false;
  }

  public isWaitingApproval(): boolean {
    for (const step of this.stepMap.values()) {
      if (step.state === 'waiting_approval') {
        return true;
      }
    }
    return false;
  }

  public calculateProgressPct(): number {
    if (this.stepMap.size === 0) return 100;
    let completedCount = 0;
    for (const step of this.stepMap.values()) {
      if (step.state === 'completed' || step.state === 'skipped') {
        completedCount++;
      }
    }
    return Math.floor((completedCount / this.stepMap.size) * 100);
  }
}
