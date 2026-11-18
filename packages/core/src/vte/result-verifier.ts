import type { CapabilityDefinition, VerificationEvidence, ExecutionResult } from '@victor/shared';

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  evidence: VerificationEvidence;
}

export class ResultVerifier {
  /**
   * Verifies an execution outcome against the capability's required verification level.
   * Guarantees that no false success is reported without satisfying required criteria.
   */
  public static verifyOutcome(
    capability: CapabilityDefinition,
    rawResult: unknown,
    providedEvidence?: Partial<VerificationEvidence>
  ): VerificationResult {
    const now = new Date().toISOString();

    // 1. If capability explicitly requires verification evidence
    if (capability.verificationRequired) {
      if (!providedEvidence || !providedEvidence.verified) {
        return {
          valid: false,
          reason: `Capability '${capability.id}' requires verified outcome evidence, but none was provided.`,
          evidence: {
            verified: false,
            verificationLevel: 'none',
            timestamp: now,
            verifier: 'VTE.ResultVerifier',
            notes: 'Missing required evidence.',
          },
        };
      }

      // Check external receipt if required
      if (
        providedEvidence.verificationLevel === 'external_receipt' &&
        (!providedEvidence.receipt || Object.keys(providedEvidence.receipt).length === 0)
      ) {
        return {
          valid: false,
          reason: `Capability '${capability.id}' requires external receipt evidence, but receipt is missing or empty.`,
          evidence: {
            verified: false,
            verificationLevel: 'external_receipt',
            timestamp: now,
            verifier: 'VTE.ResultVerifier',
            notes: 'Empty external receipt.',
          },
        };
      }
    }

    // 2. Structural verification of return data if returnsSchema is defined
    if (capability.returnsSchema && rawResult !== undefined) {
      // Basic structural check: if return is expected to be object/array
      if (typeof rawResult !== 'object' || rawResult === null) {
        return {
          valid: false,
          reason: `Result does not match expected structured schema for '${capability.id}'.`,
          evidence: {
            verified: false,
            verificationLevel: 'structural',
            timestamp: now,
            verifier: 'VTE.ResultVerifier',
            notes: 'Result failed structural type check.',
          },
        };
      }
    }

    // 3. Certified verified
    const level = providedEvidence?.verificationLevel ?? (capability.verificationRequired ? 'deterministic' : 'structural');

    return {
      valid: true,
      evidence: {
        verified: true,
        verificationLevel: level,
        receipt: providedEvidence?.receipt,
        timestamp: now,
        verifier: providedEvidence?.verifier || 'VTE.ResultVerifier',
        notes: providedEvidence?.notes || 'Successfully verified.',
      },
    };
  }
}
