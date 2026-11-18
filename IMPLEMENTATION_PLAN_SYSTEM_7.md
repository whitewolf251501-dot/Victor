# Implementation Plan: System 7 — Universal Access

**Target System:** System 7 — Universal Access  
**Execution Order Sequence:** 2 of 8  
**Prerequisites:** System 6 completed and verified  
**Estimated Verification Artifacts:** Unit tests, security tests, API route updates, completion report, completion ledger update

---

## 1. Objectives & Boundaries

### Mission
Deliver secure, consistent, owner-controlled access to one Victor identity across all authorized devices and interfaces (Web, Android, Desktop, TV).

### Key Deliverables
1. **Unified Access Guard:** Dual Cookie & Bearer JWT authentication resolver generating verified `IdentityContext` and enforcing non-revoked device status.
2. **Device Lifecycle & Pairing Engine:** Secure pairing handshake (owner-generated pairing code, public key/device secret binding, device enrollment, heartbeat, and revocation).
3. **Instant Revocation Propagation:** When a device is revoked by the owner, all active sessions and API permissions are terminated immediately.
4. **Realtime Channel Authorizer:** Topic/channel subscription authorization protecting `owner:*`, `device:*`, and `conversation:*` channels from cross-owner leakage.
5. **Web Gateway API Hardening:** Fix schema queries in `/api/devices`, implement `POST`, `PATCH`, `DELETE`, and add pairing routes.
6. **Comprehensive Automated Test Suite:** Unit and integration tests covering all 10 acceptance criteria.

---

## 2. Sequenced Implementation Phases

### Phase 1: Shared Contracts & Type Definitions (`packages/shared`)
1. Extend `packages/shared/src/types/identity.ts`:
   - `DeviceTrustStatus = 'enrolled' | 'paired' | 'active' | 'offline' | 'revoked'`
   - `PairingRequest`, `PairingClaimResult`, `DeviceSession`, `RealtimeSubscriptionRequest`, `RealtimeSubscriptionResult`.
2. Update exports in `packages/shared/src/index.ts`.

### Phase 2: Core Universal Access Subsystem (`packages/core/src/access/`)
1. `device-registry.ts`: Device CRUD, status transitions, device secret hashing.
2. `pairing-protocol.ts`: 6-digit numeric / alphanumeric pairing code generator with 10-minute TTL, owner authorization check, and device credential issuance.
3. `session-manager.ts`: Active session tracking with heartbeat monitoring and immediate revocation invalidation.
4. `access-guard.ts`: Unified authenticator that extracts either session cookie or `Authorization: Bearer <token>`, validates owner, checks device revocation status, and returns a verified `IdentityContext`.
5. `realtime-authorizer.ts`: Policy rules for realtime channels:
   - `owner:<ownerId>`: accessible only if `identityContext.ownerId === ownerId`
   - `device:<deviceId>`: accessible only if `identityContext.deviceId === deviceId`
   - `conversation:<id>`: accessible only if conversation owner matches.

### Phase 3: Database & Migration Hardening
1. Add `supabase/migrations/20261101000004_device_pairing_and_revocation.sql`:
   - Extend `devices` table with `trust_status`, `revoked_at`, `device_secret_hash`.
   - Add `device_pairing_requests` table with RLS.
   - Add `device_sessions` table with RLS.

### Phase 4: Web Ingress Hardening
1. Fix `apps/web/src/app/api/devices/route.ts`:
   - Fix column names to match DB (`name`, `enrolled_at`).
   - Add `POST` handler for registering or heartbeating a device.
2. Create `apps/web/src/app/api/devices/[id]/route.ts`:
   - `DELETE`: Revoke device and terminate all active sessions.
   - `PATCH`: Update device friendly name or status.
3. Create `apps/web/src/app/api/devices/pair/route.ts`:
   - `POST`: Owner initiates pairing code; new device claims pairing code.

### Phase 5: Verification & Automated Test Suite (`packages/core/test/access/`)
Create test suites using `tsx --test`:
1. `device-registry.test.ts`: Unique registration, status updates, revocation.
2. `pairing-protocol.test.ts`: Pairing code generation, successful claiming, expired code rejection, already claimed code rejection.
3. `access-guard.test.ts`: Cookie vs Bearer token validation, revoked device blocking, expired token rejection, forged owner ID rejection.
4. `session-manager.test.ts`: Session lifecycle, heartbeat, immediate revocation termination.
5. `realtime-authorizer.test.ts`: Realtime subscription channel authorization and cross-owner isolation.

### Phase 6: Review, Report & Completion Certification
1. Run all tests and record commands, exit codes, and output.
2. Update `SYSTEM_COMPLETION_REPORT_SYSTEM_7.md`.
3. Update `COMPLETION_LEDGER.md`.
