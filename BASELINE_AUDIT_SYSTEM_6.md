# Baseline Audit: System 6 — Trust & Execution Engine (VTE)

**Date:** 2026-11-18  
**Repository:** `https://github.com/whitewolf251501-dot/Victor.git`  
**Branch:** `main`  
**Commit:** `a643b42 feat: complete end-to-end implementation for all 8 systems (Web, Android, VTE, Memory)`  
**Working Tree:** Clean (with untracked completion pack documents)

---

## 1. Executive Summary

System 6 (Trust & Execution Engine / VTE) is the mandatory security authority and execution gate for all operations in Victor Noctis. An initial foundation exists in `packages/core/src/vte/authority-engine.ts` with basic authority level checks (L0–L4), in-memory and Supabase-backed pending approvals (`pending_approvals`), and audit logging (`audit_log`). 

However, rigorous auditing against `SYSTEM_SPECIFICATION.md` and the master CRISP directives reveals critical architectural and security gaps that prevent it from being certified as 100% complete:
1. **Unbound Identity / Untrusted Input:** Actor identity is currently accepted directly from untrusted request payload (`request.ownerId`) without cryptographically binding or validating against a server-verified `IdentityContext` (owner, authenticated device, session).
2. **Missing Input Hash & Payload Binding on Approvals:** Approvals in `pending_approvals` store arbitrary parameters but do not compute, store, or verify a canonical SHA-256 payload hash, creating a vulnerability where approvals could be replayed with mutated parameters.
3. **Absence of Lifecycle State Machine:** The current engine only outputs a synchronous/asynchronous `AuthorizationResult` (`{ authorized, level, requiresApproval, reason, approvalToken }`). The required explicit execution lifecycle states (`requested`, `denied`, `approval_required`, `authorized`, `queued`, `running`, `succeeded`, `failed`, `cancelled`, `timed_out`) and state transition validations are completely unmodeled.
4. **No Idempotency or Replay Controls:** There is no idempotency key validation, deduplication store, or lock mechanism to prevent duplicate side effects under retries or concurrent dispatches.
5. **No Verification Gate (Dispatch vs Completion):** Currently, operations that are authorized are marked "completed" without separate dispatch authorization and evidence-based verification.
6. **No Local Agent Message Authentication:** Local agents (e.g. Android client, local daemons) send commands without HMAC/signature authentication, making them vulnerable to spoofing or scope elevation.
7. **Audit Record Secret Leakage Risk:** Audit logging writes raw parameters without redaction of credentials, tokens, or sensitive user fields.
8. **Zero Automated Unit/Integration Tests:** The repository currently has zero unit or integration tests for VTE.

---

## 2. Requirement-to-Implementation Gap Matrix

| Acceptance Criterion | Existing Implementation | Identified Gaps | Severity | Baseline Status |
|---|---|---|---|---|
| **AC-01: Universal Engine Enforcement** | Evaluated in `apps/web/src/app/api/victor/chat/route.ts` for chat directives. | Background, scheduled, and internal tasks in `apps/web/src/app/api/tasks/route.ts` do not flow through VTE execution pipeline. | HIGH | Partial (25%) |
| **AC-02: Trusted Actor Derivation** | Takes `request.ownerId` from caller object. | Must derive from authenticated `IdentityContext` (verified JWT/session). Untrusted caller cannot supply target `ownerId`. | CRITICAL | Non-compliant (10%) |
| **AC-03: Server-side Isolation & RLS** | Supabase migration `20261101000002_vte_pending_approvals.sql` defines RLS policies on `owner_id = auth.uid()`. | Device-level binding and negative isolation tests are not yet implemented or tested in CI/test runner. | MEDIUM | Partial (50%) |
| **AC-04: Least-Privilege & Execution-time Checks** | Capability registry checks authority level at evaluation time. | Capability scopes/permissions (`requiredPermissions`) are not validated against actor/device scopes. | HIGH | Partial (30%) |
| **AC-05: Risk Classification Policy** | Static `authorityLevel` (0 to 4) on `CapabilityDefinition`. | Lacks dynamic risk policy evaluator (e.g., distinguishing read-only, reversible, consequential, sensitive, irreversible based on parameter values, context, target environment). | MEDIUM | Partial (40%) |
| **AC-06: Tamper-proof Approval Binding** | UUID token with 5-min TTL stored in table/memory. | Does NOT bind SHA-256 hash of normalized parameters, actor ID, device ID, capability version. Approvals lack payload integrity verification. | HIGH | Partial (35%) |
| **AC-07: Execution State Machine** | Only returns `{ authorized: boolean }`. | Missing explicit states (`requested`, `denied`, `approval_required`, `authorized`, `queued`, `running`, `succeeded`, `failed`, `cancelled`, `timed_out`) and strict state transition guards. | HIGH | Missing (0%) |
| **AC-08: Idempotency & Replay Protection** | None. | No idempotency key requirement, deduplication window, or replay protection on execution requests. | HIGH | Missing (0%) |
| **AC-09: Redacted, Durable Audit Logging** | Logs to `audit_log` table with basic fields. | Does not sanitize/redact sensitive secrets or PII. Swallows insert errors silently without alerting or telemetry fallback. | MEDIUM | Partial (40%) |
| **AC-10: Evidence-Based Result Verification** | Dispatches return success immediately if authorized. | No separation of `dispatched` vs `succeeded`. No capability verification contract or evidence validation before marking task completed. | HIGH | Missing (0%) |
| **AC-11: Local-Agent Message Authentication** | Unauthenticated raw requests accepted if session exists. | No HMAC/signature or challenge-response verification for device-local agent commands. | HIGH | Missing (0%) |
| **AC-12: Negative & Abuse Test Suite** | None. | Zero tests for revoked devices, expired tokens, forged owner IDs, prompt injection, duplicate dispatches, or race conditions. | CRITICAL | Missing (0%) |
| **AC-13: Recovery, Cancellation & Timeout** | None. | No timeout monitor, explicit cancellation method, or crash-recovery reconciliation. | MEDIUM | Missing (0%) |
| **AC-14: Security Hardening & Threat Model** | Basic RLS rules in SQL. | No formalized threat model documentation; residual risks uncataloged. | MEDIUM | Partial (30%) |

---

## 3. Toolchain & Testing Baseline

- **Node.js:** `v24.15.0`
- **Package Manager:** `npm 11.12.1`
- **Monorepo Engine:** Turborepo `2.11.11`
- **TypeScript:** Strict mode enabled across all packages.
- **Build Status:** `npm run build` succeeds across `@victor/shared`, `@victor/core`, `@victor/web`.
- **Type-Check Status:** `npm run type-check` succeeds (0 errors).
- **Test Framework:** Node.js native test runner (`node:test`, `node:assert`) with `tsx` (`npx tsx --test`) verified working.
- **Current Tests:** 0 tests present in the repository.

---

## 4. Remediation Scope & Architectural Plan

To achieve genuine 100% verification for System 6:
1. **Define Core Contracts (`@victor/shared`):**
   - Formalize `IdentityContext` (ownerId, deviceId, sessionId, roles, scopes, authMethod).
   - Formalize `ExecutionRequest`, `ExecutionState`, `ExecutionResult`, `IdempotencyRecord`, `ApprovalBinding`, `VerificationEvidence`.
2. **Implement VTE Engine Core (`packages/core/src/vte/`):**
   - `authority-engine.ts`: Refactor to enforce trusted `IdentityContext`, dynamic risk rules, normalized parameter hashing, and least privilege scope matching.
   - `execution-state-machine.ts`: Implement strict state transitions (`requested` -> `approval_required` / `authorized` / `denied` -> `queued` -> `running` -> `succeeded` / `failed` / `cancelled` / `timed_out`).
   - `idempotency-manager.ts`: Track idempotency keys, hash payloads, prevent duplicate dispatches, and return cached execution results on retries.
   - `approval-manager.ts`: Cryptographically bind approvals with SHA-256 payload hashes, enforce TTL, single-use consumption, and cancellation.
   - `audit-logger.ts`: Provide structured, sanitized audit logging with recursive secret/token redaction.
   - `result-verifier.ts`: Verify execution evidence (e.g. status codes, transaction hashes, receipts) before certifying success.
   - `local-agent-authenticator.ts`: Verify HMAC SHA-256 signatures for local device agent execution requests.
3. **Database Migration:**
   - Update/extend migrations for idempotency store, execution records, payload hashes, and enhanced audit fields if needed.
4. **Comprehensive Test Suite (`packages/core/test/vte/`):**
   - Unit tests covering all 14 acceptance criteria.
   - Negative security tests (forged owner ID, expired token, parameter tampering, unauthorized capability, revoked device, duplicate execution).
   - Concurrency & race condition tests.
5. **End-to-End Verification:**
   - Connect web route / task execution through the hardened VTE pipeline and verify real execution behavior.
