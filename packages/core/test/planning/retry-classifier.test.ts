import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RetryClassifier } from '../../src/planning/retry-classifier';
import type { IdempotencyKey } from '@victor/shared';

describe('System 4: RetryClassifier Specification Suite', () => {
  it('AC-04 - Classifies permanent errors as non-retryable with 0 delay', () => {
    const permanentErrors = [
      new Error('Unauthorized access to capability'),
      new Error('Operation restricted by policy (Level 4)'),
      new Error('Permission denied for device'),
      new Error('Validation failed: missing required parameter name'),
      new Error('Unknown capability vic.fake.tool'),
      new Error('Execution cancelled by user'),
    ];

    for (const err of permanentErrors) {
      const res = RetryClassifier.classify(err, 0);
      assert.equal(res.isRetryable, false, `Expected ${err.message} to be non-retryable`);
      assert.equal(res.delayMs, 0);
      assert(res.reason.includes('Permanent') || res.reason.includes('non-retryable'));
    }
  });

  it('AC-04 - Classifies transient errors as retryable with exponential backoff and jitter', () => {
    const transientErrors = [
      new Error('Network connection timeout'),
      new Error('Socket ECONNRESET'),
      new Error('Server responded with 503 Service Unavailable'),
      new Error('Rate limit exceeded: 429 Too Many Requests'),
      new Error('Resource lock conflict, please retry'),
    ];

    for (const err of transientErrors) {
      const res0 = RetryClassifier.classify(err, 0);
      assert.equal(res0.isRetryable, true, `Expected ${err.message} to be retryable at attempt 0`);
      assert(res0.delayMs >= 500 && res0.delayMs <= 600, `Delay ${res0.delayMs} out of expected range for attempt 0`);

      const res1 = RetryClassifier.classify(err, 1);
      assert.equal(res1.isRetryable, true);
      assert(res1.delayMs >= 1000 && res1.delayMs <= 1200, `Delay ${res1.delayMs} out of range for attempt 1`);
    }
  });

  it('AC-04 - Enforces bounded retries when maximum attempts are reached', () => {
    const err = new Error('Network timeout');
    const res = RetryClassifier.classify(err, 3, {
      maxRetries: 3,
      initialDelayMs: 500,
      maxDelayMs: 10000,
      backoffFactor: 2,
    });

    assert.equal(res.isRetryable, false);
    assert.equal(res.delayMs, 0);
    assert(res.reason.includes('Exceeded maximum retry attempts'));
  });

  it('AC-04 - Derives predictable and distinct retry idempotency keys', () => {
    const baseKey = 'step:step-1:1700000000' as IdempotencyKey;
    const retry1 = RetryClassifier.deriveRetryIdempotencyKey(baseKey, 1);
    const retry2 = RetryClassifier.deriveRetryIdempotencyKey(baseKey, 2);

    assert.equal(retry1, 'step:step-1:1700000000:retry:1');
    assert.equal(retry2, 'step:step-1:1700000000:retry:2');
    assert.notEqual(retry1, retry2);
  });
});
