import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthorityLevel,
  OperationRequest,
  AuthorizationResult,
} from '@victor/shared';
import { CapabilityRegistry } from '../capabilities/capability-registry';

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
  private readonly inMemoryApprovals = new Map<string, PendingApprovalRecord>();

  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly supabase?: SupabaseClient
  ) {}

  /**
   * Evaluates an operation request against the registered capability policy and authority tiers.
   * Can be awaited as a Promise or used synchronously as an AuthorizationResult.
   */
  evaluateOperation(request: OperationRequest): EvaluatedOperation {
    const { capabilityId, ownerId, params = {}, deviceId } = request;

    let result: AuthorizationResult;
    let pendingRecord: PendingApprovalRecord | null = null;

    // 1. Check if capability exists
    const capability = this.registry.getCapability(capabilityId);
    if (!capability) {
      result = {
        authorized: false,
        level: 4,
        requiresApproval: false,
        reason: 'Capability not found or not registered.',
      };
    } else if (capability.status === 'offline' || capability.status === 'disabled') {
      // 2. Check if offline or disabled
      result = {
        authorized: false,
        level: capability.authorityLevel,
        requiresApproval: false,
        reason: 'Capability is currently unavailable.',
      };
    } else if (capability.authorityLevel === 4) {
      // 3. L4 - Restricted (never execute)
      result = {
        authorized: false,
        level: 4,
        requiresApproval: false,
        reason: 'This operation is restricted.',
      };
    } else if (capability.authorityLevel === 3) {
      // 4. L3 - Approval required (generate token, 5-minute expiry)
      const approvalToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      pendingRecord = {
        id: crypto.randomUUID(),
        ownerId,
        capabilityId,
        params,
        token: approvalToken,
        expiresAt,
        confirmedAt: null,
        deniedAt: null,
        createdAt: new Date(),
      };

      this.inMemoryApprovals.set(approvalToken, pendingRecord);

      result = {
        authorized: false,
        level: 3,
        requiresApproval: true,
        reason: 'Approval required for Level 3 operation.',
        approvalToken,
      };
    } else {
      // 5. L0, L1, L2 - Auto-authorize
      result = {
        authorized: true,
        level: capability.authorityLevel,
        requiresApproval: false,
        reason: 'Operation authorized.',
      };
    }

    // Prepare async persistence promise
    const persistencePromise = (async (): Promise<AuthorizationResult> => {
      if (!this.supabase) {
        return result;
      }

      // If L3, persist to pending_approvals table
      if (result.requiresApproval && result.approvalToken && pendingRecord) {
        try {
          await this.supabase.from('pending_approvals').insert({
            owner_id: ownerId,
            capability_id: capabilityId,
            params,
            token: result.approvalToken,
            expires_at: pendingRecord.expiresAt.toISOString(),
          });
        } catch (error) {
          console.error('[VTE] Error persisting pending approval:', error);
        }
      }

      // Log to audit_log table
      try {
        await this.supabase.from('audit_log').insert({
          owner_id: ownerId,
          capability_id: capabilityId,
          authority_level: result.level,
          authorized: result.authorized,
          reason: result.reason,
          device_id: deviceId ?? null,
        });
      } catch {
        // Non-blocking audit failure
      }

      return result;
    })();

    // Merge promise with synchronous result properties
    return Object.assign(persistencePromise, result);
  }

  /**
   * Confirms a pending approval using its token and ownerId.
   * Verifies the token exists, belongs to the owner, and has not expired.
   */
  async confirmApproval(approvalToken: string, ownerId: string): Promise<boolean> {
    if (!approvalToken || !ownerId) {
      return false;
    }

    const now = new Date();

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('pending_approvals')
        .select('*')
        .eq('token', approvalToken)
        .eq('owner_id', ownerId)
        .maybeSingle();

      if (!error && data) {
        if (data.confirmed_at !== null || data.denied_at !== null) {
          return false;
        }

        if (new Date(data.expires_at).getTime() <= now.getTime()) {
          return false;
        }

        const { error: updateError } = await this.supabase
          .from('pending_approvals')
          .update({ confirmed_at: now.toISOString() })
          .eq('token', approvalToken)
          .eq('owner_id', ownerId)
          .is('confirmed_at', null)
          .is('denied_at', null);

        if (updateError) {
          return false;
        }

        // Update in-memory fallback
        this.confirmInMemory(approvalToken, ownerId);

        // Audit confirmation
        try {
          await this.supabase.from('audit_log').insert({
            owner_id: ownerId,
            capability_id: data.capability_id,
            authority_level: 3,
            authorized: true,
            reason: 'Approval confirmed by owner.',
            device_id: null,
          });
        } catch {
          // Non-fatal
        }

        return true;
      }
    }

    // Fallback to in-memory check
    return this.confirmInMemory(approvalToken, ownerId);
  }

  /**
   * Denies a pending approval using its token and ownerId.
   */
  async denyApproval(approvalToken: string, ownerId: string): Promise<boolean> {
    if (!approvalToken || !ownerId) {
      return false;
    }

    const now = new Date();

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('pending_approvals')
        .select('*')
        .eq('token', approvalToken)
        .eq('owner_id', ownerId)
        .maybeSingle();

      if (!error && data) {
        if (data.confirmed_at !== null || data.denied_at !== null) {
          return false;
        }

        const { error: updateError } = await this.supabase
          .from('pending_approvals')
          .update({ denied_at: now.toISOString() })
          .eq('token', approvalToken)
          .eq('owner_id', ownerId)
          .is('confirmed_at', null)
          .is('denied_at', null);

        if (updateError) {
          return false;
        }

        this.denyInMemory(approvalToken, ownerId);

        try {
          await this.supabase.from('audit_log').insert({
            owner_id: ownerId,
            capability_id: data.capability_id,
            authority_level: 3,
            authorized: false,
            reason: 'Approval denied by owner.',
            device_id: null,
          });
        } catch {
          // Non-fatal
        }

        return true;
      }
    }

    return this.denyInMemory(approvalToken, ownerId);
  }

  /**
   * Helper to retrieve in-memory approval record.
   */
  getInMemoryApproval(token: string): PendingApprovalRecord | null {
    const record = this.inMemoryApprovals.get(token);
    return record ? { ...record } : null;
  }

  private confirmInMemory(approvalToken: string, ownerId: string): boolean {
    const record = this.inMemoryApprovals.get(approvalToken);
    if (!record) {
      return false;
    }
    if (record.ownerId !== ownerId) {
      return false;
    }
    if (record.confirmedAt !== null || record.deniedAt !== null) {
      return false;
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      return false;
    }
    record.confirmedAt = new Date();
    return true;
  }

  private denyInMemory(approvalToken: string, ownerId: string): boolean {
    const record = this.inMemoryApprovals.get(approvalToken);
    if (!record) {
      return false;
    }
    if (record.ownerId !== ownerId) {
      return false;
    }
    if (record.confirmedAt !== null || record.deniedAt !== null) {
      return false;
    }
    record.deniedAt = new Date();
    return true;
  }
}
