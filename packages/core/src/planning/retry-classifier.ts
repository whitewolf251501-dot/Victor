import type { RetryPolicy, RetryClassification, IdempotencyKey } from '@victor/shared';

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffFactor: 2,
};

const PERMANENT_ERROR_PATTERNS = [
  /unauthorized/i,
  /forbidden/i,
  /restricted/i,
  /permission denied/i,
  /invalid argument/i,
  /validation/i,
  /not found/i,
  /unknown capability/i,
  /cancelled/i,
  /abort/i,
];

const TRANSIENT_ERROR_PATTERNS = [
  /timeout/i,
  /econnreset/i,
  /etimedout/i,
  /connection refused/i,
  /rate limit/i,
  /too many requests/i,
  /503/i,
  /502/i,
  /504/i,
  /network/i,
  /conflict/i,
  /lock/i,
];

export class RetryClassifier {
  public static classify(
    error: unknown,
    currentAttempt: number,
    policy: RetryPolicy = DEFAULT_RETRY_POLICY
  ): RetryClassification {
    const message = error instanceof Error ? error.message : String(error);

    // If max retries reached, non-retryable
    if (currentAttempt >= policy.maxRetries) {
      return {
        isRetryable: false,
        delayMs: 0,
        reason: `Exceeded maximum retry attempts (${policy.maxRetries})`,
      };
    }

    // Check permanent error patterns
    for (const pattern of PERMANENT_ERROR_PATTERNS) {
      if (pattern.test(message)) {
        return {
          isRetryable: false,
          delayMs: 0,
          reason: `Permanent non-retryable failure: ${message}`,
        };
      }
    }

    // Check transient error patterns
    let isTransient = false;
    for (const pattern of TRANSIENT_ERROR_PATTERNS) {
      if (pattern.test(message)) {
        isTransient = true;
        break;
      }
    }

    // If policy has explicit retryable error codes
    if (policy.retryableErrorCodes && policy.retryableErrorCodes.length > 0) {
      const hasMatchingCode = policy.retryableErrorCodes.some((code) => message.includes(code));
      if (hasMatchingCode) isTransient = true;
    }

    if (!isTransient) {
      return {
        isRetryable: false,
        delayMs: 0,
        reason: `Unclassified failure treated as non-retryable: ${message}`,
      };
    }

    // Calculate exponential backoff with jitter
    const rawDelay = policy.initialDelayMs * Math.pow(policy.backoffFactor, currentAttempt);
    const cappedDelay = Math.min(rawDelay, policy.maxDelayMs);
    // Add 10% jitter to prevent thundering herd
    const jitter = Math.floor(Math.random() * (cappedDelay * 0.1));
    const delayMs = cappedDelay + jitter;

    return {
      isRetryable: true,
      delayMs,
      reason: `Transient failure detected (${message}), backing off for ${delayMs}ms`,
    };
  }

  public static deriveRetryIdempotencyKey(baseKey: IdempotencyKey, retryCount: number): IdempotencyKey {
    return `${baseKey}:retry:${retryCount}` as IdempotencyKey;
  }
}
