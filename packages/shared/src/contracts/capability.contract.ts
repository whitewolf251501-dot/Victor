import type {
  CapabilityId,
  CapabilityDefinition,
  AuthorityLevel,
} from '../types/capability';

export interface ExecuteCapabilityParams {
  capabilityId: CapabilityId;
  authorityLevel: AuthorityLevel;
  params: Record<string, unknown>;
  deviceId?: string;
}

export interface CapabilityExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  executionTimeMs: number;
}

export interface ICapabilityRegistry {
  register(capability: CapabilityDefinition): Promise<void>;
  unregister(id: CapabilityId): Promise<void>;
  get(id: CapabilityId): Promise<CapabilityDefinition | null>;
  list(filter?: { authorityLevel?: AuthorityLevel; status?: string }): Promise<CapabilityDefinition[]>;
  execute<T = unknown>(params: ExecuteCapabilityParams): Promise<CapabilityExecutionResult<T>>;
}
