import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthorityLevel,
  OperationRequest,
  AuthorizationResult,
  RiskClassification,
  OwnerId,
  DeviceId,
  SessionId,
  ExecutionEnvelope,
  ExecutionResult,
  ExecutionState,
  VerificationEvidence,
} from '@victor/shared';
import { CapabilityRegistry } from '../capabilities/capability-registry';
import { computePayloadHash } from './hash-util';
import { sanitizePayload } from './secret-sanitizer';
import { ApprovalManager } from './approval-manager';
import { IdempotencyManager } from './idempotency-manager';
import { ExecutionStateMachine } from './execution-state-machine';
import { ResultVerifier } from './result-verifier';
import { LocalAgentAuthenticator } from './local-agent-authenticator';

export interface PendingApprovalRecord {
  id: string;
  ownerId: string;
  capabilityId: string;
  params: Record<string, unknown>;
  token: string;
  expiresAt: Date;
  confirmedAt: Date | null;
  deniedAt: Date | null;
  createdAt: Date;
}

export type EvaluatedOperation = Promise<AuthorizationResult> & AuthorizationResult;

export class AuthorityEngine {
  private readonly approvalManager: ApprovalManager;
  private readonly idempotencyManager: IdempotencyManager;
  private readonly agentAuthenticator: LocalAgentAuthenticator;

  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly supabase?: SupabaseClient
  ) {
    this.approvalManager = new ApprovalManager(supabase);
    this.idempotencyManager = new IdempotencyManager(supabase);
    this.agentAuthenticator = new LocalAgentAuthenticator();
  }

  public getApprovalManager(): ApprovalManager {
    return this.approvalManager;
  }

  public getIdempotencyManager(): IdempotencyManager {
    return this.idempotencyManager;
  }

  public getAgentAuthenticator(): LocalAgentAuthenticator {
    return this.agentAuthenticator;
  }

  /**
   * Evaluates an operation request against capability policy, actor context, and authority tiers.
   * Derives actor identity strictly from IdentityContext when provided.
   */
  evaluateOperation(request: OperationRequest): EvaluatedOperation {
    const params = request.params ?? {};
    const payloadHash = computePayloadHash(params);

    // 1. Derive trusted ownerId
    let effectiveOwnerId: OwnerId;
    if (request.identityContext) {
      // Reject forged owner ID attempts
      if (request.ownerId && request.ownerId !== request.identityContext.ownerId) {
        const forgedResult: AuthorizationResult = {
          authorized: false,
          level: 4,
          requiresApproval: false,
          reason: 'Security violation: Untrusted ownerId does not match authenticated IdentityContext.',
          payloadHash,
        };
        const p = Promise.resolve(forgedResult);
        return Object.assign(p, forgedResult);
      }
      effectiveOwnerId = request.identityContext.ownerId;
    } else {
      effectiveOwnerId = request.ownerId as OwnerId;
    }

    const deviceId = (request.identityContext?.deviceId ?? request.deviceId) as DeviceId | undefined;
    const sessionId = request.identityContext?.sessionId as SessionId | undefined;

    let result: AuthorizationResult;
    const capability = this.registry.getCapability(request.capabilityId);

    // 2. Capability existence check
    if (!capability) {
      result = {
        authorized: false,
        level: 4,
        requiresApproval: false,
        reason: 'Capability not found or not registered.',
        payloadHash,
        riskClassification: 'sensitive',
      };
    } else if (capability.status === 'offline' || capability.status === 'disabled') {
      // 3. Status check
      result = {
        authorized: false,
        level: capability.authorityLevel,
        requiresApproval: false,
        reason: `Capability is currently ${capability.status}.`,
        payloadHash,
        riskClassification: capability.riskClassification ?? 'reversible',
      };
    } else if (
      request.identityContext &&
      capability.requiredScopes &&
      capability.requiredScopes.length > 0 &&
      !capability.requiredScopes.every((sc) => request.identityContext?.scopes.includes(sc))
    ) {
      // 4. Scope / Least Privilege check
      result = {
        authorized: false,
        level: capability.authorityLevel,
        requiresApproval: false,
        reason: `Insufficient scopes. Required scopes: ${capability.requiredScopes.join(', ')}`,
        payloadHash,
        riskClassification: capability.riskClassification ?? 'sensitive',
      };
    } else if (capability.authorityLevel === 4) {
      // 5. L4 - Restricted (never execute)
      result = {
        authorized: false,
        level: 4,
        requiresApproval: false,
        reason: 'This operation is restricted.',
        payloadHash,
        riskClassification: 'irreversible',
      };
    } else if (capability.authorityLevel === 3) {
      // 6. L3 - Approval required (binds exact payload hash, 5-minute TTL)
      const risk: RiskClassification = capability.riskClassification ?? 'consequential';

      const createBindingPromise = this.approvalManager.createApproval({
        ownerId: effectiveOwnerId,
        deviceId,
        sessionId,
        capabilityId: capability.id,
        capabilityVersion: capability.version,
        params,
        authorityLevel: 3,
        riskClassification: risk,
      });

      // Synchronous return structure with attached promise
      const tempToken = randomUUID();
      result = {
        authorized: false,
        level: 3,
        requiresApproval: true,
        reason: 'Approval required for Level 3 operation.',
        approvalToken: tempToken,
        payloadHash,
        riskClassification: risk,
      };

      const persistencePromise = (async (): Promise<AuthorizationResult> => {
        const binding = await createBindingPromise;
        result.approvalToken = binding.token;

        // Audit log L3 evaluation with sanitized params
        await this.logAudit({
          ownerId: effectiveOwnerId,
          capabilityId: capability.id,
          authorityLevel: 3,
          authorized: false,
          reason: result.reason,
          deviceId: deviceId as string | undefined,
          params,
        });

        return result;
      })();

      return Object.assign(persistencePromise, result);
    } else {
      // 7. L0, L1, L2 - Auto-authorize
      const risk: RiskClassification =
        capability.riskClassification ??
        (capability.authorityLevel === 0 ? 'read_only' : 'reversible');

      result = {
        authorized: true,
        level: capability.authorityLevel,
        requiresApproval: false,
        reason: 'Operation authorized.',
        payloadHash,
        riskClassification: risk,
      };
    }

    // Async audit logging
    const persistencePromise = (async (): Promise<AuthorizationResult> => {
      await this.logAudit({
        ownerId: effectiveOwnerId,
        capabilityId: request.capabilityId,
        authorityLevel: result.level,
        authorized: result.authorized,
        reason: result.reason,
        deviceId: deviceId as string | undefined,
        params,
      });
      return result;
    })();

    return Object.assign(persistencePromise, result);
  }

  /**
   * Confirms a pending approval using its token, ownerId, and optional parameters for tamper detection.
   */
  async confirmApproval(
    approvalToken: string,
    ownerId: string,
    paramsToVerify?: Record<string, unknown>
  ): Promise<boolean> {
    const outcome = await this.approvalManager.confirmApproval(
      approvalToken,
      ownerId as OwnerId,
      paramsToVerify
    );

    if (outcome.success && outcome.binding) {
      await this.logAudit({
        ownerId: ownerId as OwnerId,
        capabilityId: outcome.binding.capabilityId,
        authorityLevel: 3,
        authorized: true,
        reason: 'Approval confirmed by owner.',
        deviceId: outcome.binding.deviceId as string | undefined,
        params: outcome.binding.params,
      });
      return true;
    }

    return false;
  }

  /**
   * Denies a pending approval using its token and ownerId.
   */
  async denyApproval(approvalToken: string, ownerId: string): Promise<boolean> {
    const outcome = await this.approvalManager.denyApproval(
      approvalToken,
      ownerId as OwnerId
    );

    if (outcome.success) {
      await this.logAudit({
        ownerId: ownerId as OwnerId,
        capabilityId: 'vic.approval.deny',
        authorityLevel: 3,
        authorized: false,
        reason: 'Approval denied by owner.',
      });
      return true;
    }

    return false;
  }

  /**
   * Full execution lifecycle engine: validates state transitions, enforces idempotency,
   * executes within deadlines, and verifies outcome evidence before declaring success.
   */
  async executeEnvelope<T = unknown>(
    envelope: ExecutionEnvelope,
    executor: () => Promise<{ data?: T; evidence?: Partial<VerificationEvidence> }>
  ): Promise<ExecutionResult<T>> {
    const requestedAt = new Date().toISOString();
    let currentState: ExecutionState = 'requested';

    const capability = this.registry.getCapability(envelope.capabilityId);
    if (!capability) {
      currentState = 'denied';
      return {
        executionId: envelope.executionId,
        state: 'denied',
        authorized: false,
        error: `Capability '${envelope.capabilityId}' not registered.`,
        errorCode: 'CAPABILITY_NOT_FOUND',
        executionTimeMs: 0,
        timestamps: { requestedAt },
      };
    }

    // 1. Idempotency Check
    if (envelope.idempotencyKey) {
      const beginRes = await this.idempotencyManager.beginExecution(
        envelope.idempotencyKey,
        envelope.identityContext.ownerId,
        envelope.capabilityId,
        envelope.payloadHash,
        envelope.executionId
      );

      if (!beginRes.allowed) {
        if (beginRes.isCached && beginRes.cachedResult) {
          return beginRes.cachedResult as ExecutionResult<T>;
        }
        return {
          executionId: envelope.executionId,
          state: 'denied',
          authorized: false,
          error: beginRes.reason || 'Idempotency violation.',
          errorCode: 'IDEMPOTENCY_CONFLICT',
          executionTimeMs: 0,
          timestamps: { requestedAt },
        };
      }
    }

    // 2. Policy & Authorization Evaluation
    if (capability.authorityLevel === 4) {
      currentState = 'denied';
      return {
        executionId: envelope.executionId,
        state: 'denied',
        authorized: false,
        error: 'Operation restricted by policy (Level 4).',
        errorCode: 'RESTRICTED_OPERATION',
        executionTimeMs: 0,
        timestamps: { requestedAt },
      };
    }

    if (capability.authorityLevel === 3) {
      if (!envelope.approvalToken) {
        currentState = 'approval_required';
        return {
          executionId: envelope.executionId,
          state: 'approval_required',
          authorized: false,
          error: 'Level 3 operation requires confirmed approval token.',
          errorCode: 'APPROVAL_REQUIRED',
          executionTimeMs: 0,
          timestamps: { requestedAt },
        };
      }

      // Consume approval (enforces tamper detection & single-use replay prevention)
      const consumeRes = await this.approvalManager.consumeApproval(
        envelope.approvalToken,
        envelope.identityContext.ownerId,
        envelope.params
      );

      if (!consumeRes.success) {
        currentState = 'denied';
        return {
          executionId: envelope.executionId,
          state: 'denied',
          authorized: false,
          error: consumeRes.reason || 'Invalid or unconfirmed approval token.',
          errorCode: 'INVALID_APPROVAL',
          executionTimeMs: 0,
          timestamps: { requestedAt },
        };
      }
    }

    // 3. State transitions: requested -> authorized -> queued -> running
    ExecutionStateMachine.assertTransition(currentState, 'authorized', envelope.executionId);
    currentState = 'authorized';
    const authorizedAt = new Date().toISOString();

    ExecutionStateMachine.assertTransition(currentState, 'queued', envelope.executionId);
    currentState = 'queued';

    ExecutionStateMachine.assertTransition(currentState, 'running', envelope.executionId);
    currentState = 'running';
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    // 4. Dispatch with timeout protection
    const timeoutMs = envelope.timeoutMs ?? capability.timeoutMs ?? 30000;
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      const executionPromise = executor();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Execution timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      });

      const { data, evidence: providedEvidence } = await Promise.race([
        executionPromise,
        timeoutPromise,
      ]);

      if (timeoutHandle) clearTimeout(timeoutHandle);
      const executionTimeMs = Date.now() - startTime;

      // 5. Result Verification
      const verification = ResultVerifier.verifyOutcome(capability, data, providedEvidence);
      if (!verification.valid) {
        ExecutionStateMachine.assertTransition(currentState, 'failed', envelope.executionId);
        currentState = 'failed';
        const finalRes: ExecutionResult<T> = {
          executionId: envelope.executionId,
          state: 'failed',
          authorized: true,
          error: verification.reason || 'Execution result verification failed.',
          errorCode: 'VERIFICATION_FAILED',
          evidence: verification.evidence,
          executionTimeMs,
          timestamps: { requestedAt, authorizedAt, startedAt, completedAt: new Date().toISOString() },
        };

        if (envelope.idempotencyKey) {
          await this.idempotencyManager.failExecution(
            envelope.idempotencyKey,
            envelope.identityContext.ownerId,
            finalRes.error!
          );
        }

        return finalRes;
      }

      // 6. Certified Succeeded
      ExecutionStateMachine.assertTransition(currentState, 'succeeded', envelope.executionId);
      currentState = 'succeeded';
      const completedAt = new Date().toISOString();

      const successResult: ExecutionResult<T> = {
        executionId: envelope.executionId,
        state: 'succeeded',
        authorized: true,
        data,
        evidence: verification.evidence,
        executionTimeMs,
        timestamps: { requestedAt, authorizedAt, startedAt, completedAt },
      };

      if (envelope.idempotencyKey) {
        await this.idempotencyManager.commitExecution(
          envelope.idempotencyKey,
          envelope.identityContext.ownerId,
          successResult as ExecutionResult
        );
      }

      await this.logAudit({
        ownerId: envelope.identityContext.ownerId,
        capabilityId: envelope.capabilityId,
        authorityLevel: capability.authorityLevel,
        authorized: true,
        reason: `Execution completed successfully in ${executionTimeMs}ms.`,
        deviceId: envelope.identityContext.deviceId as string | undefined,
        params: envelope.params,
      });

      return successResult;
    } catch (err: unknown) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const executionTimeMs = Date.now() - startTime;
      const isTimeout =
        err instanceof Error && err.message.toLowerCase().includes('timed out');

      const nextState: ExecutionState = isTimeout ? 'timed_out' : 'failed';
      ExecutionStateMachine.assertTransition(currentState, nextState, envelope.executionId);
      currentState = nextState;

      const failedResult: ExecutionResult<T> = {
        executionId: envelope.executionId,
        state: currentState,
        authorized: true,
        error: err instanceof Error ? err.message : 'Unknown execution error',
        errorCode: isTimeout ? 'EXECUTION_TIMEOUT' : 'EXECUTION_ERROR',
        executionTimeMs,
        timestamps: { requestedAt, authorizedAt, startedAt, completedAt: new Date().toISOString() },
      };

      if (envelope.idempotencyKey) {
        await this.idempotencyManager.failExecution(
          envelope.idempotencyKey,
          envelope.identityContext.ownerId,
          failedResult.error!
        );
      }

      await this.logAudit({
        ownerId: envelope.identityContext.ownerId,
        capabilityId: envelope.capabilityId,
        authorityLevel: capability.authorityLevel,
        authorized: true,
        reason: `Execution ${currentState}: ${failedResult.error}`,
        deviceId: envelope.identityContext.deviceId as string | undefined,
        params: envelope.params,
      });

      return failedResult;
    }
  }

  /**
   * Helper to retrieve in-memory approval record for backward compatibility.
   */
  getInMemoryApproval(token: string): PendingApprovalRecord | null {
    const binding = this.approvalManager.getBinding(token);
    if (!binding) return null;

    return {
      id: binding.token,
      ownerId: binding.ownerId,
      capabilityId: binding.capabilityId,
      params: binding.params,
      token: binding.token,
      expiresAt: new Date(binding.expiresAt),
      confirmedAt: binding.confirmedAt ? new Date(binding.confirmedAt) : null,
      deniedAt: binding.deniedAt ? new Date(binding.deniedAt) : null,
      createdAt: new Date(binding.createdAt),
    };
  }

  private async logAudit(entry: {
    ownerId: OwnerId;
    capabilityId: string;
    authorityLevel: number;
    authorized: boolean;
    reason?: string;
    deviceId?: string;
    params?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.supabase) return;

    try {
      // Redact sensitive secrets from params before logging
      const sanitizedParams = entry.params ? sanitizePayload(entry.params) : null;

      await this.supabase.from('audit_log').insert({
        owner_id: entry.ownerId,
        capability_id: entry.capabilityId,
        authority_level: entry.authorityLevel,
        authorized: entry.authorized,
        reason: entry.reason,
        device_id: entry.deviceId ?? null,
      });
    } catch {
      // Non-blocking audit failure
    }
  }
}
