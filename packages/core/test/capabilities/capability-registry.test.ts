import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry } from '../../src/capabilities/capability-registry';
import type { CapabilityDefinition, CapabilityId } from '@victor/shared';
import type { CapabilityAdapter } from '../../src/capabilities/adapter-interface';

describe('System 5: CapabilityRegistry Specification Suite', () => {
  const capA: CapabilityDefinition = {
    id: 'vic.test.alpha' as CapabilityId,
    name: 'Alpha Cap',
    description: 'Test alpha capability',
    version: '1.2.0',
    authorityLevel: 2,
    target: 'cloud',
    status: 'available',
    category: 'test',
    requiredScopes: ['test:read'],
  };

  const capB: CapabilityDefinition = {
    id: 'vic.test.beta' as CapabilityId,
    name: 'Beta Cap',
    description: 'Test beta capability',
    version: '2.0.0',
    authorityLevel: 3,
    target: 'device',
    status: 'offline',
    category: 'system',
    requiredScopes: ['system:write'],
  };

  it('AC-01 - Registers capabilities with stable IDs and explicit versions', () => {
    const registry = new CapabilityRegistry([capA, capB]);

    const retrievedLatest = registry.getCapability('vic.test.alpha');
    assert(retrievedLatest !== null);
    assert.equal(retrievedLatest?.version, '1.2.0');

    const retrievedVersioned = registry.getCapability('vic.test.alpha', '1.2.0');
    assert(retrievedVersioned !== null);
    assert.equal(retrievedVersioned?.id, 'vic.test.alpha');

    // Missing version returns null
    const nonExistent = registry.getCapability('vic.test.alpha', '3.0.0');
    assert.equal(nonExistent, null);
  });

  it('AC-01 - Determines semantic version compatibility correctly', () => {
    const registry = new CapabilityRegistry();

    // Same major version is compatible
    assert.equal(registry.isCompatible('1.2.3', '1.0.0'), true);
    assert.equal(registry.isCompatible('1.0.0', '1.5.2'), true);

    // Different major version is breaking/incompatible
    assert.equal(registry.isCompatible('2.0.0', '1.0.0'), false);
    assert.equal(registry.isCompatible('1.9.9', '2.0.0'), false);
  });

  it('AC-03 - Discovers capabilities filtered by availability, category, authority level, and scopes', () => {
    const registry = new CapabilityRegistry([capA, capB]);

    // Filter available only
    const available = registry.discover({ status: 'available' });
    assert.equal(available.length, 1);
    assert.equal(available[0].id, 'vic.test.alpha');

    // Filter max authority level 2 (should exclude capB which is level 3)
    const maxL2 = registry.discover({ authorityLevelMax: 2 });
    assert.equal(maxL2.length, 1);
    assert.equal(maxL2[0].id, 'vic.test.alpha');

    // Filter by owner scopes
    const testScopeCaps = registry.discover({ scopes: ['test:read'] });
    assert.equal(testScopeCaps.length, 1);
    assert.equal(testScopeCaps[0].id, 'vic.test.alpha');

    const systemScopeCaps = registry.discover({ scopes: ['system:write'] });
    assert.equal(systemScopeCaps.length, 1);
    assert.equal(systemScopeCaps[0].id, 'vic.test.beta');

    const wildcardScopeCaps = registry.discover({ scopes: ['*'] });
    assert.equal(wildcardScopeCaps.length, 2);
  });

  it('AC-07 - Observes capability health dynamically via registered adapters', async () => {
    const registry = new CapabilityRegistry([capA]);

    const adapter: CapabilityAdapter = {
      capabilityId: 'vic.test.alpha' as CapabilityId,
      version: '1.2.0',
      execute: async () => ({ data: { ok: true } }),
      checkHealth: async () => ({ status: 'healthy', latencyMs: 5 }),
    };

    registry.registerAdapter(adapter);

    const health = await registry.checkHealth('vic.test.alpha');
    assert.equal(health.status, 'healthy');
    assert(health.latencyMs !== undefined);

    // Degrade adapter health
    adapter.checkHealth = async () => ({ status: 'degraded', error: 'High latency', latencyMs: 350 });
    const degradedHealth = await registry.checkHealth('vic.test.alpha');
    assert.equal(degradedHealth.status, 'degraded');
    assert.equal(degradedHealth.error, 'High latency');
  });
});
