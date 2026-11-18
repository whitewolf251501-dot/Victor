import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaValidator, SchemaValidationError } from '../../src/capabilities/schema-validator';
import type { CapabilityParameter } from '@victor/shared';

describe('System 5: SchemaValidator Specification Suite', () => {
  const testParams: CapabilityParameter[] = [
    { name: 'query', type: 'string', description: 'Search query', required: true },
    { name: 'limit', type: 'number', description: 'Max items', required: false, default: 10 },
    { name: 'tags', type: 'array', description: 'Tag filters', required: false },
    { name: 'config', type: 'object', description: 'Optional options', required: false },
  ];

  it('AC-02 - Validates valid inputs and applies defaults for omitted optional parameters', () => {
    const input = { query: 'victor noctis' };
    const validated = SchemaValidator.validateParameters(testParams, input);

    assert.equal(validated.query, 'victor noctis');
    assert.equal(validated.limit, 10); // default applied
  });

  it('AC-02 - Rejects missing required parameters with SchemaValidationError', () => {
    const input = { limit: 5 };
    assert.throws(
      () => SchemaValidator.validateParameters(testParams, input),
      (err: any) => {
        assert(err instanceof SchemaValidationError);
        assert.equal(err.field, 'query');
        assert.equal(err.expectedType, 'string');
        return true;
      }
    );
  });

  it('AC-02 - Rejects parameter type mismatches', () => {
    const input = { query: 'test', limit: 'ten' }; // limit should be number
    assert.throws(
      () => SchemaValidator.validateParameters(testParams, input as any),
      (err: any) => {
        assert(err instanceof SchemaValidationError);
        assert.equal(err.field, 'limit');
        assert.equal(err.expectedType, 'number');
        return true;
      }
    );
  });

  it('AC-02 - Detects and blocks prototype pollution attempts', () => {
    const maliciousInput = JSON.parse('{"__proto__": {"polluted": true}, "query": "hello"}');
    assert.throws(
      () => SchemaValidator.validateParameters(testParams, maliciousInput),
      (err: any) => {
        assert(err instanceof SchemaValidationError);
        assert.match(err.message, /Malicious parameter detected/);
        return true;
      }
    );
  });

  it('AC-02 - Rejects unknown parameters in strict mode', () => {
    const input = { query: 'search', extraField: 'rogue' };
    assert.throws(
      () => SchemaValidator.validateParameters(testParams, input, true),
      (err: any) => {
        assert(err instanceof SchemaValidationError);
        assert.match(err.message, /Unknown parameter in strict mode/);
        return true;
      }
    );
  });
});
