/**
 * Secret and PII Sanitizer for VTE
 * Recursively redacts sensitive keys and values from parameters, audit logs, and diagnostic traces.
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /bearer/i,
  /credential/i,
  /private[_-]?key/i,
  /credit[_-]?card/i,
  /cvv/i,
  /ssn/i,
];

const SENSITIVE_VALUE_PATTERNS = [
  /^Bearer\s+[A-Za-z0-9\-._~+/]+=*$/i,
  /^sk-[A-Za-z0-9_-]{20,}$/, // OpenAI/Gemini/API key shape
  /^[A-Za-z0-9_-]{32,}$/, // Generic hex/base64 tokens
];

export function redactValue(val: unknown, keyName?: string): unknown {
  if (val === null || val === undefined) {
    return val;
  }

  if (typeof val === 'string') {
    if (keyName && SENSITIVE_KEY_PATTERNS.some((p) => p.test(keyName))) {
      return '[REDACTED]';
    }
    if (SENSITIVE_VALUE_PATTERNS.some((p) => p.test(val))) {
      return '[REDACTED]';
    }
    return val;
  }

  if (typeof val === 'number' || typeof val === 'boolean') {
    if (keyName && SENSITIVE_KEY_PATTERNS.some((p) => p.test(keyName))) {
      return '[REDACTED]';
    }
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((item) => redactValue(item, keyName));
  }

  if (typeof val === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERNS.some((p) => p.test(k))) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = redactValue(v, k);
      }
    }
    return sanitized;
  }

  return val;
}

export function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  return redactValue(payload) as T;
}

export class SecretSanitizer {
  public static sanitizeString(raw: string): string {
    return raw
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
      .replace(/Bearer\s+[A-Za-z0-9_\-\.]{20,}/gi, 'Bearer [REDACTED_API_KEY]')
      .replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED_API_KEY]');
  }

  public static sanitizeObject<T extends Record<string, unknown>>(payload: T): T {
    return sanitizePayload(payload);
  }
}
