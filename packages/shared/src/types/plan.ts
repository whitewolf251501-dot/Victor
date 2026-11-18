import type { Brand, OwnerId } from './identity';
import type { CapabilityId, AuthorityLevel } from './capability';
import type { TaskId } from './task';
import type { IdempotencyKey } from './execution';

export type PlanId = Brand<string, 'PlanId'>;
export type StepId = Brand<string, 'StepId'>;

export type PlanStepState =
  | 'pending'
  | 'ready'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export type PlanState =
  | 'draft'
  | 'validated'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableErrorCodes?: string[];
}

export interface RetryClassification {
  isRetryable: boolean;
  delayMs: number;
  reason: string;
}

export interface PlanStep {
  id: StepId;
  planId: PlanId;
  taskId: TaskId;
  name: string;
  capabilityId: CapabilityId;
  authorityLevel: AuthorityLevel;
  params: Record<string, unknown>;
  dependencies: StepId[];
  state: PlanStepState;
  idempotencyKey: IdempotencyKey;
  retryCount: number;
  maxRetries: number;
  timeoutMs?: number;
  approvalId?: string;
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskPlan {
  id: PlanId;
  taskId: TaskId;
  ownerId: OwnerId;
  goal: string;
  state: PlanState;
  steps: PlanStep[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export type PlanProgressEventType =
  | 'plan_started'
  | 'step_started'
  | 'step_waiting_approval'
  | 'step_completed'
  | 'step_failed'
  | 'step_retrying'
  | 'plan_paused'
  | 'plan_completed'
  | 'plan_failed'
  | 'plan_cancelled';

export interface PlanProgressEvent {
  id: string;
  planId: PlanId;
  taskId: TaskId;
  ownerId: OwnerId;
  type: PlanProgressEventType;
  stepId?: StepId;
  progressPct: number;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
