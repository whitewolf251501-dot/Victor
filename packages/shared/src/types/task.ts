import type { Brand, OwnerId } from './identity';
import type { CapabilityId, AuthorityLevel } from './capability';

export type TaskId = Brand<string, 'TaskId'>;
export type OperationId = Brand<string, 'OperationId'>;

export type TaskState =
  | 'planned'
  | 'awaiting_approval'
  | 'authorized'
  | 'running'
  | 'completed'
  | 'failed'
  | 'partially_completed'
  | 'cancelled'
  | 'blocked';

export interface Operation {
  id: OperationId;
  taskId: TaskId;
  capabilityId: CapabilityId;
  state: TaskState;
  authorityLevel: AuthorityLevel;
  params: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export interface Task {
  id: TaskId;
  ownerId: OwnerId;
  description: string;
  state: TaskState;
  createdAt: string;
  updatedAt: string;
  operations: Operation[];
}
