import type { Brand, OwnerId, DeviceId, SessionId, IdentityContext } from './identity';
import type { CapabilityId, AuthorityLevel, RiskClassification } from './capability';

export type ExecutionId = Brand<string, 'ExecutionId'>;
export type ApprovalToken = Brand<string, 'ApprovalToken'>;
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;

export type ExecutionState =
  | 'requested'
  | 'denied'
  | 'approval_required'
  | 'authorized'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export interface ApprovalBinding {
  token: string;
  ownerId: OwnerId;
  deviceId?: DeviceId;
  sessionId?: SessionId;
  capabilityId: CapabilityId;
  capabilityVersion?: string;
  payloadHash: string;
  params: Record<string, unknown>;
  riskClassification: RiskClassification;
  authorityLevel: AuthorityLevel;
  expiresAt: string;
  confirmedAt?: string;
  deniedAt?: string;
  consumedAt?: string;
  createdAt: string;
}

export interface VerificationEvidence {
  verified: boolean;
  verificationLevel: 'none' | 'structural' | 'deterministic' | 'external_receipt';
  receipt?: Record<string, unknown>;
  timestamp: string;
  verifier: string;
  notes?: string;
}

export interface ExecutionEnvelope {
  executionId: ExecutionId;
  identityContext: IdentityContext;
  capabilityId: CapabilityId;
  capabilityVersion?: string;
  params: Record<string, unknown>;
  payloadHash: string;
  idempotencyKey?: string;
  riskClassification: RiskClassification;
  authorityLevel: AuthorityLevel;
  approvalToken?: string;
  timeoutMs?: number;
  createdAt: string;
}

export interface ExecutionResult<T = unknown> {
  executionId: ExecutionId;
  state: ExecutionState;
  authorized: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  evidence?: VerificationEvidence;
  executionTimeMs: number;
  timestamps: {
    requestedAt: string;
    authorizedAt?: string;
    startedAt?: string;
    completedAt?: string;
  };
}

export interface IdempotencyRecord {
  idempotencyKey: string;
  ownerId: OwnerId;
  capabilityId: CapabilityId;
  payloadHash: string;
  executionId: ExecutionId;
  status: 'pending' | 'completed' | 'failed';
  result?: ExecutionResult;
  createdAt: string;
  expiresAt: string;
}
