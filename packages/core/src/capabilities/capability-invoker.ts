import { randomUUID } from 'crypto';
import type {
  IdentityContext,
  CapabilityId,
  ExecutionEnvelope,
  ExecutionId,
  NormalizedCapabilityResult,
} from '@victor/shared';
import { CapabilityRegistry } from './capability-registry';
import { SchemaValidator } from './schema-validator';
import { ResultNormalizer } from './adapter-interface';
import { AuthorityEngine } from '../vte/authority-engine';

export interface InvokeCapabilityOptions {
  capabilityId: CapabilityId;
  version?: string;
  params?: Record<string, unknown>;
  approvalToken?: string;
  idempotencyKey?: string;
  timeoutMs?: number;
  strictSchema?: boolean;
}

export class CapabilityInvoker {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly authorityEngine: AuthorityEngine
  ) {}

  public async invoke<T = unknown>(
    options: InvokeCapabilityOptions,
    context: IdentityContext
  ): Promise<NormalizedCapabilityResult<T>> {
    const startTime = Date.now();
    const { capabilityId, version, params, approvalToken, idempotencyKey, timeoutMs, strictSchema } = options;

    // 1. Capability Discovery & Compatibility Check
    const capability = this.registry.getCapability(capabilityId, version);
    if (!capability) {
      return ResultNormalizer.normalizeFailure(
        capabilityId,
        version ?? '1.0.0',
        `Capability '${capabilityId}' is not registered or compatible version was not found`,
        'CAPABILITY_NOT_FOUND',
        Date.now() - startTime
      ) as NormalizedCapabilityResult<T>;
    }

    const effectiveVersion = capability.version ?? '1.0.0';

    if (capability.status !== 'available') {
      return ResultNormalizer.normalizeFailure(
        capabilityId,
        effectiveVersion,
        `Capability '${capabilityId}' is currently ${capability.status}`,
        'CAPABILITY_UNAVAILABLE',
        Date.now() - startTime
      ) as NormalizedCapabilityResult<T>;
    }

    // 2. Validate Input Parameters against declared schema
    let validatedParams: Record<string, unknown>;
    try {
      validatedParams = SchemaValidator.validateParameters(
        capability.parameters,
        params,
        strictSchema ?? false
      );
    } catch (err: any) {
      return ResultNormalizer.normalizeFailure(
        capabilityId,
        effectiveVersion,
        `Parameter validation error: ${err.message}`,
        'INVALID_PARAMETERS',
        Date.now() - startTime
      ) as NormalizedCapabilityResult<T>;
    }

    // 3. System 6 (VTE) Authorization Evaluation
    const authResult = await this.authorityEngine.evaluateOperation({
      capabilityId,
      params: validatedParams,
      ownerId: context.ownerId,
      deviceId: context.deviceId,
      identityContext: context,
    });

    if (!authResult.authorized && !authResult.requiresApproval) {
      return ResultNormalizer.normalizeDenial(
        capabilityId,
        effectiveVersion,
        authResult.reason || 'Operation denied by Trust & Execution policy',
        Date.now() - startTime
      ) as NormalizedCapabilityResult<T>;
    }

    if (authResult.requiresApproval && !approvalToken) {
      return ResultNormalizer.normalizeApprovalRequired(
        capabilityId,
        effectiveVersion,
        authResult.approvalToken ?? 'pending',
        Date.now() - startTime
      ) as NormalizedCapabilityResult<T>;
    }

    // 4. Resolve Registered Adapter
    const adapter = this.registry.getAdapter(capabilityId, version);

    // 5. Construct VTE Execution Envelope
    const envelope: ExecutionEnvelope = {
      executionId: randomUUID() as ExecutionId,
      identityContext: context,
      capabilityId,
      capabilityVersion: effectiveVersion,
      params: validatedParams,
      payloadHash: authResult.payloadHash ?? 'none',
      idempotencyKey,
      riskClassification: authResult.riskClassification ?? capability.riskClassification ?? 'reversible',
      authorityLevel: capability.authorityLevel,
      approvalToken,
      timeoutMs: timeoutMs ?? capability.timeoutMs ?? 30000,
      createdAt: new Date().toISOString(),
    };

    // 6. Execute Strictly Through System 6 Authority Engine
    try {
      const adapterExecutor = adapter
        ? () => adapter.execute(validatedParams, { timeoutMs: envelope.timeoutMs })
        : async () => ({
            data: { executed: true, capabilityId, params: validatedParams },
          });

      const execResult = await this.authorityEngine.executeEnvelope<T>(envelope, adapterExecutor as any);

      if (execResult.state === 'succeeded') {
        return ResultNormalizer.normalizeSuccess<T>(
          capabilityId,
          effectiveVersion,
          execResult.data as T,
          execResult.executionTimeMs,
          execResult.evidence
        );
      } else if (execResult.state === 'timed_out') {
        return ResultNormalizer.normalizeTimeout(
          capabilityId,
          effectiveVersion,
          envelope.timeoutMs ?? 30000,
          execResult.executionTimeMs
        ) as NormalizedCapabilityResult<T>;
      } else if (execResult.state === 'denied') {
        return ResultNormalizer.normalizeDenial(
          capabilityId,
          effectiveVersion,
          execResult.error ?? 'Execution denied',
          execResult.executionTimeMs
        ) as NormalizedCapabilityResult<T>;
      } else {
        return ResultNormalizer.normalizeFailure(
          capabilityId,
          effectiveVersion,
          execResult.error ?? 'Capability execution failed',
          execResult.errorCode ?? 'EXECUTION_FAILED',
          execResult.executionTimeMs
        ) as NormalizedCapabilityResult<T>;
      }
    } catch (err: any) {
      return ResultNormalizer.normalizeFailure(
        capabilityId,
        effectiveVersion,
        err.message || 'Unexpected capability failure',
        'UNEXPECTED_ERROR',
        Date.now() - startTime
      ) as NormalizedCapabilityResult<T>;
    }
  }
}
