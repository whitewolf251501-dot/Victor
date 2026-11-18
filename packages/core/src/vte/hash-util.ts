import { createHash } from 'node:crypto';

/**
 * Deterministically serializes an object by sorting all object keys recursively.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalizeJson(item)).join(',')}]`;
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${canonicalizeJson(val)}`;
  });

  return `{${pairs.join(',')}}`;
}

/**
 * Computes a deterministic SHA-256 hash of a parameters object.
 */
export function computePayloadHash(params: Record<string, unknown> = {}): string {
  const canonical = canonicalizeJson(params);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
