import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ApprovalBinding,
  CapabilityId,
  OwnerId,
  DeviceId,
  SessionId,
  AuthorityLevel,
  RiskClassification,
} from '@victor/shared';
import { computePayloadHash } from './hash-util';

export interface CreateApprovalOptions {
  ownerId: OwnerId;
  capabilityId: CapabilityId;
  params: Record<string, unknown>;
  authorityLevel: AuthorityLevel;
  riskClassification: RiskClassification;
  deviceId?: DeviceId;
  sessionId?: SessionId;
  capabilityVersion?: string;
  ttlSeconds?: number;
}

export interface ConfirmApprovalResult {
  success: boolean;
  reason?: string;
  binding?: ApprovalBinding;
}

export class ApprovalManager {
  private readonly inMemoryBindings = new Map<string, ApprovalBinding>();

  constructor(private readonly supabase?: SupabaseClient) {}

  /**
   * Generates a tamper-proof approval binding tied to the exact payload hash and caller identity.
   */
  async createApproval(options: CreateApprovalOptions): Promise<ApprovalBinding> {
    const token = randomUUID();
    const ttlSeconds = options.ttlSeconds ?? 300; // 5 minutes default
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const createdAt = new Date().toISOString();
    const payloadHash = computePayloadHash(options.params);

    const binding: ApprovalBinding = {
      token,
      ownerId: options.ownerId,
      deviceId: options.deviceId,
      sessionId: options.sessionId,
      capabilityId: options.capabilityId,
      capabilityVersion: options.capabilityVersion,
      payloadHash,
      params: options.params,
      riskClassification: options.riskClassification,
      authorityLevel: options.authorityLevel,
      expiresAt,
      createdAt,
    };

    this.inMemoryBindings.set(token, binding);

    if (this.supabase) {
      try {
        await this.supabase.from('pending_approvals').insert({
          owner_id: options.ownerId,
          capability_id: options.capabilityId,
          params: options.params,
          token,
          expires_at: expiresAt,
        });
      } catch (err) {
        console.error('[ApprovalManager] Error persisting to Supabase:', err);
      }
    }

    return binding;
  }

  /**
   * Confirms a pending approval.
   * If params are provided, verifies that computePayloadHash(params) matches the bound payloadHash.
   */
  async confirmApproval(
    token: string,
    ownerId: OwnerId,
    paramsToVerify?: Record<string, unknown>
  ): Promise<ConfirmApprovalResult> {
    const now = new Date();
    const binding = this.inMemoryBindings.get(token);

    if (!binding) {
      // Check Supabase if available
      if (this.supabase) {
        return this.confirmInSupabase(token, ownerId, paramsToVerify);
      }
      return { success: false, reason: 'Approval token not found.' };
    }

    // 1. Verify owner isolation
    if (binding.ownerId !== ownerId) {
      return { success: false, reason: 'Forbidden: Approval does not belong to owner.' };
    }

    // 2. Verify state
    if (binding.confirmedAt) {
      return { success: false, reason: 'Approval has already been confirmed.' };
    }
    if (binding.deniedAt) {
      return { success: false, reason: 'Approval was already denied.' };
    }
    if (binding.consumedAt) {
      return { success: false, reason: 'Approval token has already been consumed.' };
    }

    // 3. Verify expiry
    if (new Date(binding.expiresAt).getTime() <= now.getTime()) {
      return { success: false, reason: 'Approval token has expired.' };
    }

    // 4. Verify parameter integrity (Tamper Detection)
    if (paramsToVerify) {
      const incomingHash = computePayloadHash(paramsToVerify);
      if (incomingHash !== binding.payloadHash) {
        return {
          success: false,
          reason: 'Security violation: Approval parameters do not match original request (tamper detected).',
        };
      }
    }

    // Mark confirmed
    binding.confirmedAt = now.toISOString();

    if (this.supabase) {
      try {
        await this.supabase
          .from('pending_approvals')
          .update({ confirmed_at: binding.confirmedAt })
          .eq('token', token)
          .eq('owner_id', ownerId);
      } catch (err) {
        console.error('[ApprovalManager] Error updating Supabase confirmation:', err);
      }
    }

    return { success: true, binding };
  }

  /**
   * Atomically marks an approval as consumed when executed, preventing replay.
   * Can consume an already-confirmed approval or atomically confirm & consume.
   */
  async consumeApproval(
    token: string,
    ownerId: OwnerId,
    paramsToVerify?: Record<string, unknown>
  ): Promise<ConfirmApprovalResult> {
    const binding = this.inMemoryBindings.get(token);

    if (binding) {
      if (binding.ownerId !== ownerId) {
        return { success: false, reason: 'Forbidden: Approval does not belong to owner.' };
      }
      if (binding.deniedAt) {
        return { success: false, reason: 'Approval was already denied.' };
      }
      if (binding.consumedAt) {
        return { success: false, reason: 'Approval token has already been consumed.' };
      }
      if (new Date(binding.expiresAt).getTime() <= Date.now()) {
        return { success: false, reason: 'Approval token has expired.' };
      }
      if (paramsToVerify) {
        const incomingHash = computePayloadHash(paramsToVerify);
        if (incomingHash !== binding.payloadHash) {
          return {
            success: false,
            reason: 'Security violation: Approval parameters do not match original request (tamper detected).',
          };
        }
      }

      const nowIso = new Date().toISOString();
      if (!binding.confirmedAt) {
        binding.confirmedAt = nowIso;
      }
      binding.consumedAt = nowIso;
      return { success: true, binding };
    }

    // If not in-memory, fall back to confirmApproval logic
    const confirmRes = await this.confirmApproval(token, ownerId, paramsToVerify);
    if (!confirmRes.success || !confirmRes.binding) {
      return confirmRes;
    }

    if (confirmRes.binding.consumedAt) {
      return { success: false, reason: 'Approval token has already been consumed.' };
    }

    confirmRes.binding.consumedAt = new Date().toISOString();
    return { success: true, binding: confirmRes.binding };
  }

  /**
   * Denies an approval token.
   */
  async denyApproval(token: string, ownerId: OwnerId): Promise<{ success: boolean; reason?: string }> {
    const binding = this.inMemoryBindings.get(token);

    if (!binding) {
      if (this.supabase) {
        return this.denyInSupabase(token, ownerId);
      }
      return { success: false, reason: 'Approval token not found.' };
    }

    if (binding.ownerId !== ownerId) {
      return { success: false, reason: 'Forbidden: Approval does not belong to owner.' };
    }

    if (binding.confirmedAt || binding.deniedAt || binding.consumedAt) {
      return { success: false, reason: 'Approval state cannot be modified.' };
    }

    binding.deniedAt = new Date().toISOString();

    if (this.supabase) {
      try {
        await this.supabase
          .from('pending_approvals')
          .update({ denied_at: binding.deniedAt })
          .eq('token', token)
          .eq('owner_id', ownerId);
      } catch (err) {
        console.error('[ApprovalManager] Error updating Supabase denial:', err);
      }
    }

    return { success: true };
  }

  /**
   * Retrieves an in-memory binding for testing or inspection.
   */
  getBinding(token: string): ApprovalBinding | null {
    const b = this.inMemoryBindings.get(token);
    return b ? { ...b } : null;
  }

  private async confirmInSupabase(
    token: string,
    ownerId: OwnerId,
    paramsToVerify?: Record<string, unknown>
  ): Promise<ConfirmApprovalResult> {
    if (!this.supabase) return { success: false, reason: 'No Supabase client' };

    const { data, error } = await this.supabase
      .from('pending_approvals')
      .select('*')
      .eq('token', token)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error || !data) {
      return { success: false, reason: 'Approval not found in database.' };
    }

    if (data.confirmed_at || data.denied_at) {
      return { success: false, reason: 'Approval has already been resolved.' };
    }

    if (new Date(data.expires_at).getTime() <= Date.now()) {
      return { success: false, reason: 'Approval token has expired.' };
    }

    if (paramsToVerify && data.params) {
      const incomingHash = computePayloadHash(paramsToVerify);
      const storedHash = computePayloadHash(data.params);
      if (incomingHash !== storedHash) {
        return {
          success: false,
          reason: 'Security violation: Parameters mismatch (tamper detected).',
        };
      }
    }

    const confirmedAt = new Date().toISOString();
    await this.supabase
      .from('pending_approvals')
      .update({ confirmed_at: confirmedAt })
      .eq('token', token);

    return {
      success: true,
      binding: {
        token: data.token,
        ownerId: data.owner_id as OwnerId,
        capabilityId: data.capability_id as CapabilityId,
        payloadHash: computePayloadHash(data.params ?? {}),
        params: data.params ?? {},
        riskClassification: 'consequential',
        authorityLevel: 3,
        expiresAt: data.expires_at,
        confirmedAt,
        createdAt: data.created_at,
      },
    };
  }

  private async denyInSupabase(
    token: string,
    ownerId: OwnerId
  ): Promise<{ success: boolean; reason?: string }> {
    if (!this.supabase) return { success: false, reason: 'No Supabase client' };

    const { data, error } = await this.supabase
      .from('pending_approvals')
      .select('*')
      .eq('token', token)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error || !data) {
      return { success: false, reason: 'Approval not found in database.' };
    }

    if (data.confirmed_at || data.denied_at) {
      return { success: false, reason: 'Approval already resolved.' };
    }

    await this.supabase
      .from('pending_approvals')
      .update({ denied_at: new Date().toISOString() })
      .eq('token', token);

    return { success: true };
  }
}
