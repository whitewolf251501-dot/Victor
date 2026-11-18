import type { Brand, IdentityContext } from './identity';

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

export type RiskClassification =
  | 'read_only'
  | 'reversible'
  | 'consequential'
  | 'sensitive'
  | 'irreversible';

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
  category?: string;
  parameters?: CapabilityParameter[];
  parametersSchema?: Record<string, unknown>;
  returnsSchema?: Record<string, unknown>;
  requiredPermissions?: string[];
  requiredScopes?: string[];
  riskClassification?: RiskClassification;
  verificationRequired?: boolean;
  version?: string;
  tags?: string[];
  timeoutMs?: number;
  isIdempotent?: boolean;
}

export interface OperationRequest {
  capabilityId: string;
  params?: Record<string, unknown>;
  ownerId: string;
  deviceId?: string;
  context?: Record<string, unknown>;
  identityContext?: IdentityContext;
  idempotencyKey?: string;
  capabilityVersion?: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  level: AuthorityLevel;
  requiresApproval: boolean;
  reason: string;
  approvalToken?: string;
  payloadHash?: string;
  riskClassification?: RiskClassification;
  expiresAt?: string;
}

export type CapabilityHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface CapabilityHealthCheckResult {
  capabilityId: CapabilityId;
  status: CapabilityHealthStatus;
  latencyMs?: number;
  error?: string;
  checkedAt: string;
}

export interface NormalizedCapabilityResult<T = unknown> {
  success: boolean;
  state: 'succeeded' | 'failed' | 'denied' | 'timed_out' | 'approval_required';
  capabilityId: CapabilityId;
  version: string;
  data?: T;
  error?: string;
  errorCode?: string;
  executionTimeMs: number;
  evidence?: {
    verified: boolean;
    verificationLevel: 'none' | 'structural' | 'deterministic' | 'external_receipt';
    receipt?: Record<string, unknown>;
    timestamp: string;
    verifier: string;
    notes?: string;
  };
}

export interface CapabilityDiscoveryFilter {
  status?: CapabilityStatus;
  category?: string;
  target?: ExecutionTarget;
  authorityLevelMax?: AuthorityLevel;
  scopes?: string[];
  version?: string;
  healthyOnly?: boolean;
}

