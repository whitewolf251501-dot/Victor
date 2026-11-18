# Implementation Plan: System 6 — Trust & Execution Engine (VTE)

**Target System:** System 6 — Victor Trust & Execution Engine (VTE)  
**Execution Order Sequence:** 1 of 8  
**Prerequisites:** Node.js 24+, Turborepo, TypeScript strict mode  
**Estimated Verification Artifacts:** Unit tests, integration tests, security test suite, completion report, completion ledger update

---

## 1. Objectives & Boundaries

### Mission
Transform the initial VTE foundation into an immutable, production-grade security and execution authority that:
1. Derives actor identity strictly from verified server-side `IdentityContext`.
2. Validates capability permissions, scopes, and dynamic risk classifications.
3. Cryptographically binds approvals to exact actor, device, capability version, and SHA-256 payload hash with non-reusable single-consumption semantics.
4. Implements a validated execution lifecycle state machine (`requested`, `denied`, `approval_required`, `authorized`, `queued`, `running`, `succeeded`, `failed`, `cancelled`, `timed_out`).
5. Enforces idempotency and replay prevention.
6. Authenticates local device agents via HMAC-SHA256 request signatures.
7. Performs durable, sanitized audit logging with recursive secret redaction.
8. Distinguishes dispatch from evidence-verified completion.

### Explicit Non-Scope
- Model reasoning and intent parsing (owned by System 1).
- Capability discovery or external tool adapters (owned by System 5).
- Frontend UI rendering of approval prompts (owned by System 8).
- Device registration authority (owned by System 7), though device trust status is validated here.

---

## 2. Sequenced Implementation Phases

### Phase 1: Shared Contracts & Type Definitions (`packages/shared`)
1. **Extend `packages/shared/src/types/identity.ts`:**
   - Define `IdentityContext` with `ownerId`, `deviceId`, `sessionId`, `scopes`, `roles`, `authMethod`, `correlationId`, `timestamp`.
2. **Extend `packages/shared/src/types/capability.ts`:**
   - Define `RiskClassification` (`read_only` | `reversible` | `consequential` | `sensitive` | `irreversible`).
   - Add `riskClassification`, `requiredScopes`, `hashAlgorithm` to capability metadata.
3. **Extend `packages/shared/src/types/task.ts` & execution types:**
   - Define `ExecutionEnvelope`, `ExecutionState`, `ExecutionRecord`, `IdempotencyRecord`, `ApprovalBinding`, `VerificationEvidence`, `ExecutionResultPayload`.
4. **Update `packages/shared/src/index.ts`** to export all new contracts.

### Phase 2: Core VTE Components (`packages/core/src/vte/`)
1. **`secret-sanitizer.ts`:**
   - Recursive masking for API keys, passwords, bearer tokens, credit cards, and sensitive parameters before audit logging or tracing.
2. **`idempotency-manager.ts`:**
   - In-memory and DB-backed deduplication store using idempotency keys, tracking `pending`, `completed`, and `failed` execution outputs.
3. **`approval-manager.ts`:**
   - Creates cryptographically secure approval tokens bound to `(ownerId, deviceId, capabilityId, capabilityVersion, sha256(normalizedParams), expiresAt)`.
   - Single-use consumption (mark confirmed/denied atomically to prevent race conditions or replay).
4. **`execution-state-machine.ts`:**
   - Strict transition table enforcing permitted transitions:
     - `requested` -> `authorized` | `approval_required` | `denied`
     - `authorized` -> `queued`
     - `queued` -> `running` | `cancelled`
     - `running` -> `succeeded` | `failed` | `timed_out` | `cancelled`
   - Invalid transitions throw `InvalidStateTransitionError`.
5. **`local-agent-authenticator.ts`:**
   - HMAC-SHA256 signature generation and validation for local agent requests using shared device secret or public/private key pairs.
6. **`result-verifier.ts`:**
   - Evaluates execution evidence (`VerificationEvidence`) against capability-declared verification requirements before declaring `succeeded`.
7. **`authority-engine.ts` (Major Upgrade):**
   - Refactor to integrate `IdentityContext`, `ApprovalManager`, `IdempotencyManager`, `ExecutionStateMachine`, `ResultVerifier`, `LocalAgentAuthenticator`, and `SecretSanitizer`.
   - Backward-compatible API for existing callers while exposing full execution envelope processing.

### Phase 3: Database & Migration Hardening
1. **`supabase/migrations/20261101000003_vte_hardening.sql`:**
   - Add `payload_hash`, `device_id`, `capability_version` to `pending_approvals`.
   - Create `idempotency_records` table with unique key, owner_id, status, payload_hash, response, expires_at.
   - Create `execution_records` table tracking execution state machine, evidence, and timing.
   - Enforce RLS policies for owner isolation.

### Phase 4: Integration with Web & Chat Dispatch
1. **Update `apps/web/src/app/api/victor/chat/route.ts`:**
   - Construct validated `IdentityContext` from authenticated Supabase user and verified device headers.
   - Pass normalized parameters and verify payload hash on approval confirmation.
   - Ensure all action executions go through the upgraded VTE pipeline.
2. **Update `apps/web/src/app/api/tasks/route.ts`:**
   - Route task state mutations through VTE state machine.

### Phase 5: Verification & Test Suite (`packages/core/test/vte/`)
Create comprehensive automated test suites using `tsx --test`:
1. **`authority-engine.test.ts`:**
   - Unit tests for L0, L1, L2 auto-authorization.
   - L3 approval generation and parameter hash binding.
   - L4 restricted capability immediate denial.
   - Offline/disabled capability checks.
2. **`approval-binding.test.ts`:**
   - Approval confirmation with exact payload hash.
   - Rejection on tampered payload parameters.
   - Expired token denial.
   - Single-use consumption (replay attack prevention).
   - Owner isolation (Owner B cannot confirm Owner A's token).
3. **`execution-state-machine.test.ts`:**
   - Valid lifecycle state transitions.
   - Illegal transition rejections (e.g., `running` -> `requested`).
   - Terminal state protections.
4. **`idempotency.test.ts`:**
   - Replay protection with identical idempotency key.
   - Concurrency lock on concurrent duplicate requests.
   - Stored response caching for idempotent operations.
5. **`local-agent-auth.test.ts`:**
   - Valid HMAC signature acceptance.
   - Tampered signature or expired timestamp rejection.
   - Device impersonation prevention.
6. **`security-abuse.test.ts`:**
   - Forged identity context injection attempts.
   - Secret redaction in audit logs.
   - Privilege escalation prevention.

### Phase 6: Documentation & Completion Certification
1. Run all tests and record exact commands, runtimes, and exit codes.
2. Produce `SYSTEM_COMPLETION_REPORT_SYSTEM_6.md`.
3. Update `COMPLETION_LEDGER.md`.
4. Review Git status and diff.
