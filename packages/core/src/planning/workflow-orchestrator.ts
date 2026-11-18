import { randomUUID } from 'crypto';
import type {
  IdentityContext,
  TaskPlan,
  PlanStep,
  StepId,
  ApprovalToken,
  PlanProgressEvent,
  PlanProgressEventType,
  ExecutionEnvelope,
  ExecutionResult,
  VerificationEvidence,
  ExecutionId,
  PlanStepState,
} from '@victor/shared';
import { PlanGraph } from './plan-graph';
import { RetryClassifier } from './retry-classifier';
import { AuthorityEngine } from '../vte/authority-engine';
import { IdempotencyManager } from '../vte/idempotency-manager';

export type PlanEventListener = (event: PlanProgressEvent) => void | Promise<void>;

export type StepExecutor = (
  step: PlanStep,
  context: IdentityContext
) => Promise<{ data?: unknown; evidence?: Partial<VerificationEvidence> }>;

export class WorkflowOrchestrator {
  private readonly eventListeners: PlanEventListener[] = [];
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(
    private readonly authorityEngine: AuthorityEngine,
    private readonly stepExecutor?: StepExecutor,
    private readonly idempotencyManager?: IdempotencyManager
  ) {}

  public onEvent(listener: PlanEventListener): () => void {
    this.eventListeners.push(listener);
    return () => {
      const idx = this.eventListeners.indexOf(listener);
      if (idx !== -1) this.eventListeners.splice(idx, 1);
    };
  }

  private transitionStep(
    graph: PlanGraph,
    plan: TaskPlan,
    stepId: StepId,
    next: PlanStepState,
    update?: Partial<Omit<PlanStep, 'id' | 'planId' | 'taskId' | 'dependencies'>>
  ): PlanStep {
    const updated = graph.transitionStep(stepId, next, update);
    plan.steps = graph.getSteps();
    return updated;
  }

  private async emitEvent(
    plan: TaskPlan,
    type: PlanProgressEventType,
    message: string,
    stepId?: StepId,
    details?: Record<string, unknown>
  ): Promise<void> {
    const graph = new PlanGraph(plan.steps);
    const progressPct = graph.calculateProgressPct();

    const event: PlanProgressEvent = {
      id: randomUUID(),
      planId: plan.id,
      taskId: plan.taskId,
      ownerId: plan.ownerId,
      type,
      stepId,
      progressPct,
      message,
      timestamp: new Date().toISOString(),
      details,
    };

    for (const listener of this.eventListeners) {
      try {
        await listener(event);
      } catch (err) {
        console.error('Error in plan event listener:', err);
      }
    }
  }

  public async executePlan(
    plan: TaskPlan,
    context: IdentityContext,
    options?: { signal?: AbortSignal }
  ): Promise<TaskPlan> {
    // Verify owner scoping
    if (context.ownerId !== plan.ownerId) {
      throw new Error(`Unauthorized: Context owner '${context.ownerId}' does not match plan owner '${plan.ownerId}'`);
    }

    if (plan.state === 'completed' || plan.state === 'cancelled') {
      return plan;
    }

    const abortController = new AbortController();
    this.abortControllers.set(plan.id, abortController);

    if (options?.signal) {
      options.signal.addEventListener('abort', () => abortController.abort());
    }

    const graph = new PlanGraph(plan.steps);

    plan.state = 'executing';
    plan.updatedAt = new Date().toISOString();
    await this.emitEvent(plan, 'plan_started', `Execution started for plan: ${plan.goal}`);

    while (true) {
      if (abortController.signal.aborted) {
        return this.cancelPlan(plan, 'Execution aborted via cancellation signal');
      }

      if (graph.isPlanCompleted()) {
        plan.state = 'completed';
        plan.completedAt = new Date().toISOString();
        plan.updatedAt = new Date().toISOString();
        await this.emitEvent(plan, 'plan_completed', `Plan completed successfully: ${plan.goal}`);
        break;
      }

      if (graph.hasPlanFailed()) {
        plan.state = 'failed';
        plan.updatedAt = new Date().toISOString();
        await this.emitEvent(plan, 'plan_failed', `Plan execution failed: ${plan.error ?? 'Step failure'}`);
        break;
      }

      const readySteps = graph.getReadySteps();

      if (readySteps.length === 0) {
        if (graph.isWaitingApproval()) {
          plan.state = 'paused';
          plan.updatedAt = new Date().toISOString();
          await this.emitEvent(plan, 'plan_paused', 'Plan paused waiting for owner approval on pending step');
          break;
        }

        plan.state = 'failed';
        plan.error = 'Deadlock: unresolved dependencies or stuck steps';
        plan.updatedAt = new Date().toISOString();
        await this.emitEvent(plan, 'plan_failed', plan.error);
        break;
      }

      for (const step of readySteps) {
        if (abortController.signal.aborted) {
          return this.cancelPlan(plan, 'Execution cancelled');
        }

        const stepResult = await this.executeStep(step, plan, graph, context, abortController.signal);
        if (stepResult === 'paused') {
          plan.state = 'paused';
          plan.updatedAt = new Date().toISOString();
          await this.emitEvent(plan, 'plan_paused', `Plan paused for approval on step: ${step.name}`, step.id);
          this.abortControllers.delete(plan.id);
          return plan;
        }
      }
    }

    this.abortControllers.delete(plan.id);
    return plan;
  }

  private async executeStep(
    step: PlanStep,
    plan: TaskPlan,
    graph: PlanGraph,
    context: IdentityContext,
    signal: AbortSignal
  ): Promise<'completed' | 'failed' | 'paused'> {
    // 1. Evaluate with VTE Authority Engine
    const evalResult = await this.authorityEngine.evaluateOperation({
      capabilityId: step.capabilityId,
      params: step.params,
      ownerId: context.ownerId,
      deviceId: context.deviceId,
      identityContext: context,
    });

    // If L4 Restricted or unauthorized
    if (!evalResult.authorized && !evalResult.requiresApproval) {
      const errorMsg = evalResult.reason || 'Capability execution denied by VTE policy';
      this.transitionStep(graph, plan, step.id, 'failed', { error: errorMsg });
      await this.emitEvent(plan, 'step_failed', `Step '${step.name}' denied: ${errorMsg}`, step.id);
      plan.error = errorMsg;
      return 'failed';
    }

    // If L3 Approval Required and step does not yet have an approved token attached
    if (evalResult.requiresApproval && !step.approvalId) {
      this.transitionStep(graph, plan, step.id, 'waiting_approval', {
        approvalId: evalResult.approvalToken,
      });
      await this.emitEvent(
        plan,
        'step_waiting_approval',
        `Step '${step.name}' requires owner approval (Token: ${evalResult.approvalToken})`,
        step.id,
        { approvalToken: evalResult.approvalToken }
      );
      return 'paused';
    }

    // 2. Mark step as running
    this.transitionStep(graph, plan, step.id, 'running');
    await this.emitEvent(plan, 'step_started', `Step '${step.name}' started`, step.id);

    // 3. Execution Envelope
    const envelope: ExecutionEnvelope = {
      executionId: randomUUID() as ExecutionId,
      identityContext: context,
      capabilityId: step.capabilityId,
      params: step.params,
      payloadHash: evalResult.payloadHash ?? 'none',
      idempotencyKey: step.idempotencyKey,
      riskClassification: evalResult.riskClassification ?? 'reversible',
      authorityLevel: step.authorityLevel,
      approvalToken: step.approvalId,
      timeoutMs: step.timeoutMs ?? 30000,
      createdAt: new Date().toISOString(),
    };

    // 4. Dispatch through VTE AuthorityEngine.executeEnvelope
    try {
      const executor = this.stepExecutor
        ? () => this.stepExecutor!(step, context)
        : async () => ({
            data: { executed: true, capabilityId: step.capabilityId, params: step.params },
          });

      const result: ExecutionResult = await this.authorityEngine.executeEnvelope(envelope, executor);

      if (result.state === 'succeeded') {
        this.transitionStep(graph, plan, step.id, 'completed', {
          result: result.data,
        });
        await this.emitEvent(plan, 'step_completed', `Step '${step.name}' completed successfully`, step.id, {
          result: result.data,
        });
        return 'completed';
      } else {
        throw new Error(result.error ?? 'Execution failed in VTE');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Check retry policy
      const classification = RetryClassifier.classify(err, step.retryCount);
      if (classification.isRetryable) {
        const nextRetryCount = step.retryCount + 1;
        const nextIdempotencyKey = RetryClassifier.deriveRetryIdempotencyKey(step.idempotencyKey, nextRetryCount);

        this.transitionStep(graph, plan, step.id, 'ready', {
          retryCount: nextRetryCount,
          idempotencyKey: nextIdempotencyKey,
          error: errorMsg,
        });

        await this.emitEvent(
          plan,
          'step_retrying',
          `Step '${step.name}' failed (${errorMsg}), retrying (attempt ${nextRetryCount}/${step.maxRetries}) in ${classification.delayMs}ms`,
          step.id,
          { delayMs: classification.delayMs, retryCount: nextRetryCount }
        );

        return 'completed';
      } else {
        this.transitionStep(graph, plan, step.id, 'failed', { error: errorMsg });
        await this.emitEvent(plan, 'step_failed', `Step '${step.name}' failed permanently: ${errorMsg}`, step.id);
        plan.error = `Step '${step.name}' failed: ${errorMsg}`;
        return 'failed';
      }
    }
  }

  public async resumePlanWithApproval(
    plan: TaskPlan,
    stepId: StepId,
    approvalToken: ApprovalToken,
    context: IdentityContext
  ): Promise<TaskPlan> {
    const graph = new PlanGraph(plan.steps);
    const step = graph.getStep(stepId);
    if (!step) {
      throw new Error(`Step '${stepId}' not found in plan`);
    }

    if (step.state !== 'waiting_approval') {
      throw new Error(`Step '${stepId}' is in state '${step.state}', not 'waiting_approval'`);
    }

    this.transitionStep(graph, plan, stepId, 'ready', { approvalId: approvalToken });

    plan.state = 'executing';
    plan.updatedAt = new Date().toISOString();

    return this.executePlan(plan, context);
  }

  public cancelPlan(plan: TaskPlan, reason: string): TaskPlan {
    const controller = this.abortControllers.get(plan.id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(plan.id);
    }

    const graph = new PlanGraph(plan.steps);
    for (const step of graph.getSteps()) {
      if (
        step.state === 'pending' ||
        step.state === 'ready' ||
        step.state === 'running' ||
        step.state === 'waiting_approval'
      ) {
        try {
          graph.transitionStep(step.id, 'cancelled', { error: reason });
        } catch {
          // ignore already terminal
        }
      }
    }

    plan.steps = graph.getSteps();
    plan.state = 'cancelled';
    plan.error = reason;
    plan.updatedAt = new Date().toISOString();

    this.emitEvent(plan, 'plan_cancelled', `Plan cancelled: ${reason}`);
    return plan;
  }

  public recoverPlan(plan: TaskPlan): TaskPlan {
    const graph = new PlanGraph(plan.steps);

    for (const step of graph.getSteps()) {
      if (step.state === 'running') {
        if (this.idempotencyManager) {
          const cached = this.idempotencyManager.getRecord(step.idempotencyKey, plan.ownerId);
          if (cached && cached.status === 'completed' && cached.result) {
            graph.transitionStep(step.id, 'completed', { result: cached.result.data });
            continue;
          }
        }

        if (step.retryCount < step.maxRetries) {
          const nextRetry = step.retryCount + 1;
          const nextKey = RetryClassifier.deriveRetryIdempotencyKey(step.idempotencyKey, nextRetry);
          graph.transitionStep(step.id, 'ready', {
            retryCount: nextRetry,
            idempotencyKey: nextKey,
            error: 'Interrupted by process restart, recovered safely for re-execution',
          });
        } else {
          graph.transitionStep(step.id, 'failed', {
            error: 'Interrupted by process restart and exceeded max retries',
          });
        }
      }
    }

    plan.steps = graph.getSteps();
    if (plan.state === 'executing') {
      plan.state = 'validated';
      plan.updatedAt = new Date().toISOString();
    }

    return plan;
  }
}
