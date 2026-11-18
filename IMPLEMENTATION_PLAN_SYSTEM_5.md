# Implementation Plan — System 5: Capability & Tool Fabric

**Date:** 2026-11-18  
**System:** System 5 — Capability & Tool Fabric  
**Status:** In Progress  

---

## 1. Objectives & Deliverables
1. **Shared Types & Contracts (`packages/shared/src/types/capability.ts`):**
   - Add `CapabilityHealthStatus`, `CapabilityHealthCheckResult`, `NormalizedCapabilityResult<T>`, `CapabilityDiscoveryFilter`.
   - Update `CapabilityDefinition` to make `version: string` standard, with required parameters, schemas, and risk tiers.
2. **Schema Validator (`packages/core/src/capabilities/schema-validator.ts`):**
   - Parameter type checking (`string`, `number`, `boolean`, `object`, `array`).
   - Required vs optional parameter validation.
   - Default value population.
   - Malicious parameter structure rejection.
3. **Adapter Interface & Normalizer (`packages/core/src/capabilities/adapter-interface.ts`):**
   - Generic `CapabilityAdapter<TInput, TOutput>` interface.
   - Result normalizer ensuring `success`, `failure`, `timeout`, `denied` are consistently shaped and never falsely reported.
4. **Enhanced Capability Registry (`packages/core/src/capabilities/capability-registry.ts`):**
   - Version indexing & semver compatibility matching (`findCompatibleVersion`).
   - Scope and permission metadata filtering in `discover()`.
   - Adapter registration and lookup (`registerAdapter`, `getAdapter`).
   - Dynamic health checks (`checkHealth`, `setHealthStatus`).
5. **Secure Capability Invoker (`packages/core/src/capabilities/capability-invoker.ts`):**
   - Direct execution gatekeeper ensuring all invocations go through `AuthorityEngine.evaluateOperation()` and `AuthorityEngine.executeEnvelope()`.
   - Throws or rejects any bypass attempts.
6. **Built-in Capabilities Hardening (`packages/core/src/capabilities/builtin-capabilities.ts`):**
   - Ensure all 22 built-in capabilities have explicit versions (`'1.0.0'`), parameter schemas, risk classifications, and timeouts.
7. **Comprehensive Test Suite (`packages/core/test/capabilities/`):**
   - `schema-validator.test.ts`: Required parameter enforcement, type mismatches, unknown properties, defaults.
   - `capability-registry.test.ts`: Version registration, semver lookup, discovery filtering (scopes, health, status), adapter registration.
   - `capability-invoker.test.ts`: VTE integration enforcement, L3 approval token enforcement, L4 rejection, timeout handling, idempotency deduplication, result normalization, dynamic capability addition without editing core logic.
8. **Documentation & Ledger:**
   - Generate `SYSTEM_COMPLETION_REPORT_SYSTEM_5.md` and update `COMPLETION_LEDGER.md`.

---

## 2. Sequenced Execution Steps

### Step 1: Shared Contracts & Types
- Update `packages/shared/src/types/capability.ts`.
- Build `@victor/shared`.

### Step 2: Schema Validator
- Implement `packages/core/src/capabilities/schema-validator.ts`.

### Step 3: Adapter Contract & Result Normalizer
- Implement `packages/core/src/capabilities/adapter-interface.ts`.

### Step 4: Capability Registry Hardening & Built-ins
- Refactor `packages/core/src/capabilities/capability-registry.ts` with adapter management, health checking, and discovery.
- Update `packages/core/src/capabilities/builtin-capabilities.ts` with versions and schemas.

### Step 5: Secure Capability Invoker
- Implement `packages/core/src/capabilities/capability-invoker.ts`.

### Step 6: Automated Tests & Verification
- Implement test suites in `packages/core/test/capabilities/`.
- Run tests (`npm test`), lint, type checks, and verify 0 regressions.

### Step 7: Completion Report & Ledger Update
- Write `SYSTEM_COMPLETION_REPORT_SYSTEM_5.md`.
- Mark System 5 Accepted 100% in `COMPLETION_LEDGER.md`.
