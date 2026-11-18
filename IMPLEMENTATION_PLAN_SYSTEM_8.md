# Implementation Plan — System 8: Experience & Presence

**Date:** 2026-11-18  
**System:** System 8 — Experience & Presence  
**Status:** In Progress  

---

## 1. Objectives & Deliverables
1. **Shared Companion State Machine (`packages/shared/src/types/presence.ts`):**
   - Formalize `CompanionState`: `'idle' | 'listening' | 'thinking' | 'speaking' | 'success' | 'error' | 'offline'`.
   - Companion state controller interface ensuring state updates require verified evidence.
2. **Web 3D Wolf Companion (`apps/web/src/components/victor/wolf-3d-companion.tsx`):**
   - Progressive enhancement component loading `/models/wolf.glb` using `<model-viewer>` or three.js WebGL canvas.
   - Automatic fallback to high-performance SVG `WolfAvatar` for low-spec devices, mobile battery saver, or missing WebGL contexts.
   - Accessible roles (`role="img"`, `aria-label`).
3. **Network Status & Offline Resilience UX (`apps/web/src/hooks/useNetworkStatus.ts`):**
   - Live browser connectivity hook detecting `online` and `offline` events with offline notification banner.
4. **Automated Test Suite (`packages/core/test/experience/presence.test.ts`):**
   - Companion state machine transitions.
   - False success prevention: verifying that `success` state cannot be triggered if execution failed or evidence is missing.
   - Voice state error and permission denial handling.
   - Responsive and accessible presentation contracts.
5. **Full Multi-Platform Verification:**
   - Monorepo turbo build, type checks, lint checks.
   - Android `./gradlew assembleDebug` build verification.
6. **Handover & Documentation:**
   - Generate `SYSTEM_COMPLETION_REPORT_SYSTEM_8.md`.
   - Update `COMPLETION_LEDGER.md` marking System 8 Accepted 100%.

---

## 2. Sequenced Execution Steps

### Step 1: Presence Types
- Add `packages/shared/src/types/presence.ts` and export from `packages/shared/src/index.ts`.
- Build `@victor/shared`.

### Step 2: 3D Companion & Fallback Component
- Implement `apps/web/src/components/victor/wolf-3d-companion.tsx` integrating `models/wolf.glb`.
- Add `apps/web/src/hooks/useNetworkStatus.ts`.

### Step 3: Presence & State Controller in Core
- Implement `packages/core/src/presence/companion-state-controller.ts`.
- Export from `packages/core/src/index.ts`.

### Step 4: Automated Test Suite
- Implement `packages/core/test/experience/presence.test.ts`.
- Run tests (`npm test`).

### Step 5: Android Build Verification
- Run `apps/android/gradlew assembleDebug` to confirm Android build integrity.

### Step 6: Completion Report & Final Handover
- Write `SYSTEM_COMPLETION_REPORT_SYSTEM_8.md`.
- Update `COMPLETION_LEDGER.md`.
