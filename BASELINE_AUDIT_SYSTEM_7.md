# Baseline Audit: System 7 — Universal Access

**Date:** 2026-11-18  
**Repository:** `https://github.com/whitewolf251501-dot/Victor.git`  
**Branch:** `main`  
**Base Commit:** `a643b42 feat: complete end-to-end implementation for all 8 systems (Web, Android, VTE, Memory)`  
**Working Tree:** Clean with System 6 verified implementations  

---

## 1. Executive Summary

System 7 (Universal Access) is responsible for providing secure, consistent, owner-controlled access to one persistent Victor identity across authorized devices and interfaces. It manages authentication integration, session lifecycles, device registration, pairing, trust states, revocation, API gateway ingress, and cross-device realtime subscription isolation.

An initial foundation exists:
- Database schema for `profiles`, `devices` (`20261101000001_victor_foundation.sql`)
- Android `DeviceManager.kt` managing device UUID and online/offline status updates via Supabase
- Web API route `/api/devices` with basic GET handler
- Web middleware `apps/web/src/middleware.ts` for cookie session validation
- Integration with VTE's `LocalAgentAuthenticator` (System 6)

However, a thorough audit against `SYSTEM_SPECIFICATION.md` identifies critical gaps and defects:
1. **Schema Mismatch in Web Devices Route:** `apps/web/src/app/api/devices/route.ts` queries `device_name` and `created_at` which do not match the Postgres schema (`name`, `enrolled_at`), causing runtime failures or null outputs.
2. **Missing Device Management Endpoints:** There are no endpoints for device registration, pairing authorization, status updates, or revocation (`POST`, `PATCH`, `DELETE`).
3. **No Formalized Pairing Protocol:** Pairing requires an owner-authorized flow producing revocable device credentials; currently devices are directly inserted via client without pairing authorization.
4. **No Prompt Revocation Enforcement:** When a device is marked revoked or removed, existing sessions and API tokens are not immediately invalidated across API routes or realtime channels.
5. **No Unified Access Guard:** Web routes validate auth ad-hoc via `supabase.auth.getUser()`, but do not validate whether the calling device is registered or revoked, nor do they construct a unified `IdentityContext`.
6. **No Realtime Channel Authorization Rules:** Subscription authorization for WebSocket / Realtime channels (`user:${ownerId}`, `device:${deviceId}`) is not formalized or protected from cross-owner eavesdropping.
7. **Zero Automated Tests:** System 7 currently has 0 automated tests in the repository.

---

## 2. Requirement-to-Implementation Gap Matrix

| Acceptance Criterion | Existing Implementation | Identified Gaps | Severity | Baseline Status |
|---|---|---|---|---|
| **AC-01: Consistent Owner Auth** | Supabase Auth via Web Cookie SSR and Android GoTrue. | API ingress does not cleanly unify Cookie and Bearer token parsing in a single gateway guard. | HIGH | Partial (50%) |
| **AC-02: Separately Scoped Device Identity** | `devices` table with UUID `id` and `owner_id`. | Schema column mismatch in web route; no validation of device trust status on API calls. | HIGH | Partial (40%) |
| **AC-03: Secure Owner-Authorized Pairing** | Direct upsert from Android `DeviceManager.kt`. | Missing pairing handshake (pairing code, challenge, public key/secret exchange, owner confirmation). | CRITICAL | Missing (10%) |
| **AC-04: Immediate Revocation Propagation** | `devices` table deletion policy in RLS. | Revoking a device does not immediately terminate active sessions or block incoming requests using cached credentials. | CRITICAL | Missing (15%) |
| **AC-05: Cookie & Bearer Dual-Auth Ingress** | Middleware checks cookies; Android uses Bearer headers. | No centralized gateway guard resolving both auth modes into canonical `IdentityContext`. | HIGH | Partial (40%) |
| **AC-06: Realtime Channel Authorization** | Supabase Realtime configured. | No channel authorization policies preventing a client from subscribing to another owner's or device's channel. | CRITICAL | Missing (20%) |
| **AC-07: Secret Protection & Short-lived Tokens** | Android stores credentials via DataStore; no secrets in web bundle. | Need automated negative tests proving secrets and device private keys are never exposed in responses or logs. | MEDIUM | Partial (60%) |
| **AC-08: Offline / Reconnect & Session Expiry** | Android `NetworkMonitor.kt` monitors network connectivity. | Explicit session expiry, heartbeat tracking, and reconnect reconciliation not formalized in core package. | MEDIUM | Partial (35%) |
| **AC-09: Documented Client API Contracts** | Web API routes and Android Ktor/Supabase calls. | Error responses are inconsistent (`{ error: string }` vs `{ message: string }`); schema needs strict contracts. | MEDIUM | Partial (50%) |
| **AC-10: Negative & Security Test Suite** | None. | Zero automated tests for revoked devices, expired tokens, forged IDs, realtime isolation, and concurrent sessions. | CRITICAL | Missing (0%) |

---

## 3. Toolchain & Test Baseline

- **Node.js:** `v24.15.0`
- **Monorepo:** Turborepo `2.11.11`
- **TypeScript:** Strict mode enabled across `@victor/shared`, `@victor/core`, `@victor/web`.
- **Test Runner:** `npx tsx --test` (33 tests currently passing in System 6).
- **Lint / Build:** `npm run build` and `npm run lint` passing with 0 errors.

---

## 4. Remediation Plan

1. **Shared Contracts:**
   - Extend `packages/shared/src/types/identity.ts` with `DeviceTrustStatus`, `PairingRequest`, `PairingClaimResult`, `DeviceSession`, `RealtimeChannelPolicy`.
2. **Core Access Module (`packages/core/src/access/`):**
   - `access-guard.ts`: Unified gateway guard resolving Cookie or Bearer auth into trusted `IdentityContext` and validating device trust.
   - `device-registry.ts`: Complete device lifecycle manager (register, heartbeat, trust state, revoke).
   - `pairing-protocol.ts`: Secure pairing code generator (6-digit, 10-min TTL), signature verification, and device secret exchange.
   - `session-manager.ts`: Device session tracking, heartbeat updates, and instant revocation propagation.
   - `realtime-authorizer.ts`: Authorizes topic/channel access for `owner:${ownerId}`, `device:${deviceId}`, and `chat:${conversationId}`.
3. **Database Migration:**
   - `supabase/migrations/20261101000004_device_pairing_and_revocation.sql` adding `revoked_at`, `device_secret_hash`, pairing requests, and session tracking.
4. **Web API Updates:**
   - Fix `/api/devices` column names and add `POST` handler for registration.
   - Add `/api/devices/[id]` for revocation and updates.
   - Add `/api/devices/pair` for pairing code generation and confirmation.
5. **Automated Test Suite:**
   - Create comprehensive automated tests in `packages/core/test/access/` covering all 10 acceptance criteria.
