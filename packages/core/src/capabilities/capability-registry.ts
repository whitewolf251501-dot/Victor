import type {
  CapabilityDefinition,
  CapabilityStatus,
  AuthorityLevel,
  ExecutionTarget,
} from '@victor/shared';

export interface CapabilityFilter {
  status?: CapabilityStatus;
  category?: string;
  target?: ExecutionTarget;
}

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityDefinition>();

  constructor(initialCapabilities: CapabilityDefinition[] = []) {
    for (const capability of initialCapabilities) {
      this.register(capability);
    }
  }

  /**
   * Registers a capability definition in memory.
   */
  register(capability: CapabilityDefinition): void {
    if (!capability || !capability.id) {
      throw new Error('Invalid capability definition: id is required.');
    }
    this.capabilities.set(capability.id, { ...capability });
  }

  /**
   * Retrieves a capability definition by its ID, or returns null if not found.
   */
  getCapability(id: string): CapabilityDefinition | null {
    const cap = this.capabilities.get(id);
    return cap ? { ...cap } : null;
  }

  /**
   * Lists capabilities matching optional filters (status, category, target).
   */
  listCapabilities(filters?: CapabilityFilter): CapabilityDefinition[] {
    let result = Array.from(this.capabilities.values());

    if (filters) {
      if (filters.status !== undefined) {
        result = result.filter((c) => c.status === filters.status);
      }
      if (filters.category !== undefined) {
        result = result.filter((c) => c.category === filters.category);
      }
      if (filters.target !== undefined) {
        result = result.filter((c) => c.target === filters.target);
      }
    }

    return result.map((c) => ({ ...c }));
  }

  /**
   * Returns all available capabilities (status === 'available').
   */
  getAvailable(): CapabilityDefinition[] {
    return this.listCapabilities({ status: 'available' });
  }

  /**
   * Updates the status of a registered capability.
   */
  updateStatus(id: string, status: CapabilityStatus): void {
    const cap = this.capabilities.get(id);
    if (!cap) {
      throw new Error(`Capability '${id}' is not registered.`);
    }
    cap.status = status;
    this.capabilities.set(id, cap);
  }

  /**
   * Checks whether a capability is currently available.
   */
  isAvailable(id: string): boolean {
    const cap = this.capabilities.get(id);
    return Boolean(cap && cap.status === 'available');
  }

  /**
   * Returns the authority level of a registered capability.
   * Throws an error if the capability is not registered.
   */
  getAuthorityLevel(id: string): AuthorityLevel {
    const cap = this.capabilities.get(id);
    if (!cap) {
      throw new Error(`Capability '${id}' is not registered.`);
    }
    return cap.authorityLevel;
  }
}
