import type {
  CapabilityId,
  NormalizedCapabilityResult,
  VerificationEvidence,
} from '@victor/shared';

export interface CapabilityAdapter<TInput = Record<string, unknown>, TOutput = unknown> {
  readonly capabilityId: CapabilityId;
  readonly version: string;
  execute(
    params: TInput,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<{ data?: TOutput; evidence?: Partial<VerificationEvidence> }>;
  checkHealth?(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latencyMs?: number;
    error?: string;
  }>;
}

export class ResultNormalizer {
  public static normalizeSuccess<T>(
    capabilityId: CapabilityId,
    version: string,
    data: T,
    executionTimeMs: number,
    evidence?: VerificationEvidence
  ): NormalizedCapabilityResult<T> {
    return {
      success: true,
      state: 'succeeded',
      capabilityId,
      version,
      data,
      executionTimeMs,
      evidence,
    };
  }

  public static normalizeFailure(
    capabilityId: CapabilityId,
    version: string,
    error: string,
    errorCode: string = 'CAPABILITY_EXECUTION_ERROR',
    executionTimeMs: number = 0
  ): NormalizedCapabilityResult {
    return {
      success: false,
      state: 'failed',
      capabilityId,
      version,
      error,
      errorCode,
      executionTimeMs,
    };
  }

  public static normalizeTimeout(
    capabilityId: CapabilityId,
    version: string,
    timeoutMs: number,
    executionTimeMs: number = timeoutMs
  ): NormalizedCapabilityResult {
    return {
      success: false,
      state: 'timed_out',
      capabilityId,
      version,
      error: `Execution timed out after ${timeoutMs}ms`,
      errorCode: 'TIMEOUT',
      executionTimeMs,
    };
  }

  public static normalizeDenial(
    capabilityId: CapabilityId,
    version: string,
    reason: string,
    executionTimeMs: number = 0
  ): NormalizedCapabilityResult {
    return {
      success: false,
      state: 'denied',
      capabilityId,
      version,
      error: reason,
      errorCode: 'POLICY_DENIED',
      executionTimeMs,
    };
  }

  public static normalizeApprovalRequired(
    capabilityId: CapabilityId,
    version: string,
    token: string,
    executionTimeMs: number = 0
  ): NormalizedCapabilityResult {
    return {
      success: false,
      state: 'approval_required',
      capabilityId,
      version,
      error: `Approval required for Level 3 capability (Token: ${token})`,
      errorCode: 'APPROVAL_REQUIRED',
      executionTimeMs,
    };
  }
}
