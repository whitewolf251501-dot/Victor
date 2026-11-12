import type { Brand } from './identity';

export type CapabilityId = Brand<string, 'CapabilityId'>;

/**
 * Authority Levels (System 06 - Victor Trust and Execution Engine)
 * L0: Observe - read-only, no state change, auto-allowed
 * L1: Prepare - draft/stage only, no external commitment
 * L2: Execute - permitted low-risk actions within configured scope
 * L3: Approval Required - sensitive/consequential, user must confirm exact action
 * L4: Restricted - prohibited, deny always, never attempt
 */
export type AuthorityLevel = 0 | 1 | 2 | 3 | 4;

export type ExecutionTarget = 'cloud' | 'service' | 'device';

export type CapabilityStatus = 'available' | 'degraded' | 'offline' | 'disabled';

export interface CapabilityParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface CapabilityDefinition {
  id: CapabilityId;
  name: string;
  description: string;
  authorityLevel: AuthorityLevel;
  target: ExecutionTarget;
  status: CapabilityStatus;
  parameters?: CapabilityParameter[];
  parametersSchema?: Record<string, unknown>;
  returnsSchema?: Record<string, unknown>;
  requiredPermissions?: string[];
  version?: string;
  tags?: string[];
  timeoutMs?: number;
  isIdempotent?: boolean;
}
