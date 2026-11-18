import type {
  CapabilityDefinition,
  CapabilityStatus,
  AuthorityLevel,
  CapabilityDiscoveryFilter,
  CapabilityHealthStatus,
  CapabilityHealthCheckResult,
  CapabilityId,
} from '@victor/shared';
import type { CapabilityAdapter } from './adapter-interface';

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityDefinition>();
  private readonly adapters = new Map<string, CapabilityAdapter>();
  private readonly healthStatuses = new Map<string, { status: CapabilityHealthStatus; error?: string; checkedAt: string }>();

  constructor(initialCapabilities: CapabilityDefinition[] = []) {
    for (const capability of initialCapabilities) {
      this.register(capability);
    }
  }

  private makeKey(id: string, version?: string): string {
    return version ? `${id}@${version}` : id;
  }

  public register(capability: CapabilityDefinition): void {
    if (!capability || !capability.id) {
      throw new Error('Invalid capability definition: id is required.');
    }
    const version = capability.version || '1.0.0';
    const defWithVersion: CapabilityDefinition = {
      ...capability,
      version,
    };

    // Store versioned entry and latest pointer
    this.capabilities.set(this.makeKey(capability.id, version), defWithVersion);
    this.capabilities.set(capability.id, defWithVersion);

    // Initialize health
    if (!this.healthStatuses.has(capability.id)) {
      this.healthStatuses.set(capability.id, {
        status: capability.status === 'available' ? 'healthy' : 'unhealthy',
        checkedAt: new Date().toISOString(),
      });
    }
  }

  public registerAdapter(adapter: CapabilityAdapter): void {
    if (!adapter || !adapter.capabilityId) {
      throw new Error('Invalid adapter: capabilityId is required.');
    }
    const version = adapter.version || '1.0.0';
    this.adapters.set(this.makeKey(adapter.capabilityId, version), adapter);
    this.adapters.set(adapter.capabilityId, adapter);
  }

  public getAdapter(id: string, version?: string): CapabilityAdapter | null {
    if (version) {
      const vAdapter = this.adapters.get(this.makeKey(id, version));
      if (vAdapter) return vAdapter;
    }
    return this.adapters.get(id) ?? null;
  }

  public getCapability(id: string, version?: string): CapabilityDefinition | null {
    if (version) {
      const vCap = this.capabilities.get(this.makeKey(id, version));
      if (vCap) return { ...vCap };

      // Check if latest registered version is compatible with requested version
      const latest = this.capabilities.get(id);
      if (latest && latest.version && this.isCompatible(latest.version, version)) {
        return { ...latest };
      }
      return null;
    }
    const cap = this.capabilities.get(id);
    return cap ? { ...cap } : null;
  }

  public discover(filter?: CapabilityDiscoveryFilter): CapabilityDefinition[] {
    const seen = new Set<string>();
    const results: CapabilityDefinition[] = [];

    for (const [key, cap] of this.capabilities.entries()) {
      // Only iterate canonical latest pointers or unique IDs
      if (key.includes('@')) continue;

      if (filter) {
        if (filter.status && cap.status !== filter.status) continue;
        if (filter.category && cap.category !== filter.category) continue;
        if (filter.target && cap.target !== filter.target) continue;
        if (filter.authorityLevelMax !== undefined && cap.authorityLevel > filter.authorityLevelMax) continue;

        if (filter.scopes && filter.scopes.length > 0) {
          const required = cap.requiredScopes ?? [];
          const hasAllScopes = required.every((req) => filter.scopes!.includes(req) || filter.scopes!.includes('*'));
          if (!hasAllScopes) continue;
        }

        if (filter.version && cap.version) {
          if (!this.isCompatible(cap.version, filter.version)) continue;
        }

        if (filter.healthyOnly) {
          const health = this.healthStatuses.get(cap.id);
          if (health?.status !== 'healthy') continue;
        }
      }

      if (!seen.has(cap.id)) {
        seen.add(cap.id);
        results.push({ ...cap });
      }
    }

    return results;
  }

  public listCapabilities(filters?: any): CapabilityDefinition[] {
    return this.discover(filters);
  }

  public getAvailable(): CapabilityDefinition[] {
    return this.discover({ status: 'available' });
  }

  public updateStatus(id: string, status: CapabilityStatus): void {
    const cap = this.capabilities.get(id);
    if (!cap) {
      throw new Error(`Capability '${id}' is not registered.`);
    }
    cap.status = status;
    this.capabilities.set(id, cap);
    if (cap.version) {
      this.capabilities.set(this.makeKey(id, cap.version), cap);
    }
    this.setHealthStatus(id, status === 'available' ? 'healthy' : 'unhealthy');
  }

  public isAvailable(id: string): boolean {
    const cap = this.capabilities.get(id);
    return Boolean(cap && cap.status === 'available');
  }

  public getAuthorityLevel(id: string): AuthorityLevel {
    const cap = this.capabilities.get(id);
    if (!cap) {
      throw new Error(`Capability '${id}' is not registered.`);
    }
    return cap.authorityLevel;
  }

  public setHealthStatus(id: string, status: CapabilityHealthStatus, error?: string): void {
    this.healthStatuses.set(id, {
      status,
      error,
      checkedAt: new Date().toISOString(),
    });
  }

  public async checkHealth(id: string): Promise<CapabilityHealthCheckResult> {
    const cap = this.getCapability(id);
    if (!cap) {
      return {
        capabilityId: id as CapabilityId,
        status: 'unknown',
        error: `Capability '${id}' not found`,
        checkedAt: new Date().toISOString(),
      };
    }

    const adapter = this.getAdapter(id);
    const start = Date.now();

    if (adapter && adapter.checkHealth) {
      try {
        const res = await adapter.checkHealth();
        const latencyMs = Date.now() - start;
        this.setHealthStatus(id, res.status, res.error);
        return {
          capabilityId: id as CapabilityId,
          status: res.status,
          latencyMs,
          error: res.error,
          checkedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        this.setHealthStatus(id, 'unhealthy', err.message);
        return {
          capabilityId: id as CapabilityId,
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          error: err.message,
          checkedAt: new Date().toISOString(),
        };
      }
    }

    // Default health based on registered status
    const currentStatus = this.healthStatuses.get(id)?.status ?? (cap.status === 'available' ? 'healthy' : 'unhealthy');
    return {
      capabilityId: id as CapabilityId,
      status: currentStatus,
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  }

  public isCompatible(installedVersion: string, requiredVersion: string): boolean {
    if (installedVersion === requiredVersion) return true;
    const [instMajor] = installedVersion.split('.').map(Number);
    const [reqMajor] = requiredVersion.split('.').map(Number);
    // Semantic versioning: same major version is backwards compatible
    return instMajor === reqMajor && !Number.isNaN(instMajor) && !Number.isNaN(reqMajor);
  }
}
