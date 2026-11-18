import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IdempotencyRecord,
  ExecutionId,
  ExecutionResult,
  OwnerId,
  CapabilityId,
} from '@victor/shared';

export interface BeginExecutionResult {
  allowed: boolean;
  isCached?: boolean;
  cachedResult?: ExecutionResult;
  reason?: string;
}

export class IdempotencyManager {
  private readonly inMemoryRecords = new Map<string, IdempotencyRecord>();

  constructor(private readonly supabase?: SupabaseClient) {}

  /**
   * Attempts to reserve an idempotency key.
   * If already completed, returns the cached result.
   * If pending, blocks duplicate concurrent execution.
   * If key is reused with different payloadHash, rejects as conflict.
   */
  async beginExecution(
    idempotencyKey: string,
    ownerId: OwnerId,
    capabilityId: CapabilityId,
    payloadHash: string,
    executionId: ExecutionId,
    ttlSeconds: number = 86400 // 24 hours
  ): Promise<BeginExecutionResult> {
    const memoryKey = `${ownerId}:${idempotencyKey}`;
    const existing = this.inMemoryRecords.get(memoryKey);

    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        return {
          allowed: false,
          reason: 'Idempotency conflict: Key was previously used with different parameters.',
        };
      }

      if (existing.status === 'pending') {
        return {
          allowed: false,
          reason: 'Duplicate execution: Request is currently being processed.',
        };
      }

      if (existing.status === 'completed' && existing.result) {
        return {
          allowed: false,
          isCached: true,
          cachedResult: existing.result,
        };
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    const record: IdempotencyRecord = {
      idempotencyKey,
      ownerId,
      capabilityId,
      payloadHash,
      executionId,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt,
    };

    this.inMemoryRecords.set(memoryKey, record);
    return { allowed: true };
  }

  /**
   * Commits the finished execution result to the idempotency store.
   */
  async commitExecution(
    idempotencyKey: string,
    ownerId: OwnerId,
    result: ExecutionResult
  ): Promise<void> {
    const memoryKey = `${ownerId}:${idempotencyKey}`;
    const existing = this.inMemoryRecords.get(memoryKey);
    if (existing) {
      existing.status = 'completed';
      existing.result = result;
    }
  }

  /**
   * Marks the execution as failed so retries can be evaluated according to policy.
   */
  async failExecution(
    idempotencyKey: string,
    ownerId: OwnerId,
    error: string
  ): Promise<void> {
    const memoryKey = `${ownerId}:${idempotencyKey}`;
    const existing = this.inMemoryRecords.get(memoryKey);
    if (existing) {
      existing.status = 'failed';
    }
  }

  /**
   * Retrieves an idempotency record for inspection.
   */
  getRecord(idempotencyKey: string, ownerId: OwnerId): IdempotencyRecord | null {
    const memoryKey = `${ownerId}:${idempotencyKey}`;
    const r = this.inMemoryRecords.get(memoryKey);
    return r ? { ...r } : null;
  }
}
