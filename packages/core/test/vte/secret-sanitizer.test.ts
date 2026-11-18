import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePayload, redactValue } from '../../src/vte/secret-sanitizer';

test('SecretSanitizer: AC-09 - Sensitive keys are recursively redacted', () => {
  const payload = {
    username: 'victor_owner',
    password: 'super-secret-password-123',
    apiKey: 'sk-1234567890abcdef1234567890abcdef',
    token: 'jwt-access-token',
    nested: {
      authHeader: 'Bearer my-bearer-token',
      safeData: 'visible_info',
    },
    tags: ['admin', 'owner'],
  };

  const sanitized = sanitizePayload(payload);

  assert.equal(sanitized.username, 'victor_owner');
  assert.equal(sanitized.password, '[REDACTED]');
  assert.equal(sanitized.apiKey, '[REDACTED]');
  assert.equal(sanitized.token, '[REDACTED]');
  assert.equal((sanitized.nested as any).authHeader, '[REDACTED]');
  assert.equal((sanitized.nested as any).safeData, 'visible_info');
  assert.deepEqual(sanitized.tags, ['admin', 'owner']);
});

test('SecretSanitizer: AC-09 - Bearer token and API key shaped values are redacted even if key is generic', () => {
  const payload = {
    customHeader: 'Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
    genericField: 'sk-1234567890abcdef12345678',
    normalText: 'This is completely normal text',
  };

  const sanitized = sanitizePayload(payload);

  assert.equal(sanitized.customHeader, '[REDACTED]');
  assert.equal(sanitized.genericField, '[REDACTED]');
  assert.equal(sanitized.normalText, 'This is completely normal text');
});
