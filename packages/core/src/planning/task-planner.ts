import { randomUUID } from 'crypto';
import type {
  OwnerId,
  TaskId,
  PlanId,
  StepId,
  CapabilityId,
  IdempotencyKey,
  TaskPlan,
  PlanStep,
} from '@victor/shared';
import { PlanGraph } from './plan-graph';
import { CapabilityRegistry } from '../capabilities/capability-registry';

export interface StepProposal {
  name: string;
  capabilityId: CapabilityId;
  params: Record<string, unknown>;
  dependencies?: string[];
  timeoutMs?: number;
  maxRetries?: number;
}

export class TaskPlanner {
  constructor(private readonly capabilityRegistry: CapabilityRegistry) {}

  public createPlan(
    ownerId: OwnerId,
    goal: string,
    proposals: StepProposal[],
    existingTaskId?: TaskId
  ): TaskPlan {
    if (!goal || goal.trim().length === 0) {
      throw new Error('Goal cannot be empty');
    }
    if (!proposals || proposals.length === 0) {
      throw new Error('Plan must contain at least one step proposal');
    }

    const taskId = existingTaskId ?? (randomUUID() as TaskId);
    const planId = randomUUID() as PlanId;

    // First assign StepIds to names or references
    const nameToId = new Map<string, StepId>();
    for (const prop of proposals) {
      const stepId = randomUUID() as StepId;
      nameToId.set(prop.name, stepId);
    }

    const steps: PlanStep[] = [];

    for (const prop of proposals) {
      const capability = this.capabilityRegistry.getCapability(prop.capabilityId);
      if (!capability) {
        throw new Error(`Unknown capability referenced in plan: '${prop.capabilityId}'`);
      }

      const stepId = nameToId.get(prop.name)!;
      const dependencies: StepId[] = [];

      if (prop.dependencies) {
        for (const dep of prop.dependencies) {
          const resolvedId = nameToId.get(dep) ?? (dep as StepId);
          dependencies.push(resolvedId);
        }
      }

      const idempotencyKey = `step:${stepId}:${Date.now()}` as IdempotencyKey;

      steps.push({
        id: stepId,
        planId,
        taskId,
        name: prop.name,
        capabilityId: prop.capabilityId,
        authorityLevel: capability.authorityLevel,
        params: { ...prop.params },
        dependencies,
        state: 'pending',
        idempotencyKey,
        retryCount: 0,
        maxRetries: prop.maxRetries ?? 3,
        timeoutMs: prop.timeoutMs,
      });
    }

    // Validate the graph: checks for duplicate IDs, missing dependencies, cycles
    const graph = new PlanGraph(steps);
    // Topological order check
    graph.getExecutionOrder();

    const plan: TaskPlan = {
      id: planId,
      taskId,
      ownerId,
      goal: goal.trim(),
      state: 'validated',
      steps,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return plan;
  }
}
