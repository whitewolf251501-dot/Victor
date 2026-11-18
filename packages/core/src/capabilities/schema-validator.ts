import type { CapabilityParameter } from '@victor/shared';

export class SchemaValidationError extends Error {
  constructor(message: string, public readonly field?: string, public readonly expectedType?: string) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

export class SchemaValidator {
  public static validateParameters(
    parameters: CapabilityParameter[] | undefined,
    inputParams: Record<string, unknown> | undefined,
    strict: boolean = false
  ): Record<string, unknown> {
    const params = inputParams ? { ...inputParams } : {};

    // 1. Check for Prototype Pollution attempts
    for (const key of Object.keys(params)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new SchemaValidationError(`Malicious parameter detected: '${key}'`, key);
      }
    }

    if (!parameters || parameters.length === 0) {
      return params;
    }

    const paramMap = new Map<string, CapabilityParameter>();
    for (const p of parameters) {
      paramMap.set(p.name, p);
    }

    // 2. Validate known parameters & apply defaults
    for (const [name, def] of paramMap.entries()) {
      const val = params[name];

      if (val === undefined || val === null) {
        if (def.required) {
          throw new SchemaValidationError(
            `Missing required parameter '${name}' (${def.type}): ${def.description}`,
            name,
            def.type
          );
        }
        if (def.default !== undefined) {
          params[name] = def.default;
        }
        continue;
      }

      // Type verification
      const actualType = SchemaValidator.getType(val);
      if (actualType !== def.type) {
        throw new SchemaValidationError(
          `Invalid type for parameter '${name}': expected '${def.type}', got '${actualType}'`,
          name,
          def.type
        );
      }
    }

    // 3. Strict mode unknown property rejection
    if (strict) {
      for (const key of Object.keys(params)) {
        if (!paramMap.has(key)) {
          throw new SchemaValidationError(`Unknown parameter in strict mode: '${key}'`, key);
        }
      }
    }

    return params;
  }

  private static getType(val: unknown): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'other' {
    if (Array.isArray(val)) return 'array';
    if (val === null) return 'other';
    const t = typeof val;
    if (t === 'string') return 'string';
    if (t === 'number') return 'number';
    if (t === 'boolean') return 'boolean';
    if (t === 'object') return 'object';
    return 'other';
  }
}
