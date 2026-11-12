import type {
  Task,
  TaskId,
  Operation,
  OperationId,
  TaskState,
} from '../types/task';
import type { OwnerId } from '../types/identity';
import type { CapabilityId, AuthorityLevel } from '../types/capability';

export interface CreateTaskParams {
  ownerId: OwnerId;
  description: string;
  operations?: Array<{
    capabilityId: CapabilityId;
    authorityLevel: AuthorityLevel;
    params: Record<string, unknown>;
  }>;
}

export interface ITaskManager {
  createTask(params: CreateTaskParams): Promise<Task>;
  getTask(id: TaskId): Promise<Task | null>;
  updateTaskState(id: TaskId, state: TaskState): Promise<Task>;
  addOperation(
    taskId: TaskId,
    operation: Omit<Operation, 'id' | 'taskId'>
  ): Promise<Operation>;
  updateOperationState(
    operationId: OperationId,
    state: TaskState,
    result?: unknown,
    error?: string
  ): Promise<Operation>;
  listTasks(ownerId: OwnerId, state?: TaskState): Promise<Task[]>;
}
