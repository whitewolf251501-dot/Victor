# Baseline Audit — System 8: Experience & Presence

**Date:** 2026-11-18  
**Repository:** `https://github.com/whitewolf251501-dot/Victor.git`  
**Branch:** `main`  
**Commit:** HEAD  
**Auditor:** Principal Software Architect & Victor Engineering Lead  

---

## 1. System Mission & Scope
System 8 provides a coherent, accessible, and responsive user experience across text, voice, dashboard, and the wolf companion across Web/PWA and Android. It ensures companion states strictly mirror actual backend verification, prevents false claims of success, handles network transitions gracefully, respects user permissions, and provides lightweight fallbacks for lower-spec devices.

---

## 2. Current Implementation Baseline

### 2.1 Existing Artifacts & Code
1. **Web Dashboard & Chat (`apps/web/src/app/(dashboard)/`):**
   - Responsive layouts with `sidebar.tsx` (desktop) and `mobile-nav.tsx` (mobile-first drawer).
   - Chat interface with live optimistic updates, conversation history, and real-time state synchronization.
   - PWA support with `manifest.json` and `sw.js` for offline caching.
   - React Error Boundary at `components/ErrorBoundary.tsx`.
2. **Companion Avatar (`apps/web/src/components/victor/wolf-avatar.tsx` & Android `WolfAvatar.kt`):**
   - Geometric SVG silhouette avatar with status glow rings, eye color shifts, and breathing animations.
   - States: `idle`, `listening`, `thinking`, `speaking`, `success`, `error`, `offline`.
   - Android Jetpack Compose Canvas implementation with infinite pulsing transitions and state colors.
3. **Voice Interfaces (`apps/web/src/hooks/useVoiceInput.ts`, `useVoiceOutput.ts` & Android `VoiceInputManager.kt`, `VoiceOutputManager.kt`):**
   - Web Speech API integration (`webkitSpeechRecognition`) with 1.5s silence auto-submit.
   - Web Speech Synthesis with calm, deep cadence (rate: 0.9, pitch: 0.85).
   - Android SpeechRecognizer with runtime `RECORD_AUDIO` permissions and TextToSpeech engine.
4. **3D Asset Provisioning:**
   - Rigged 3D Wolf model confirmed at `apps/web/public/models/wolf.glb` (1.71 MB).

### 2.2 Acceptance Criteria Gap Analysis

| Criterion | Requirement Summary | Current Code Status | Gap / Required Action |
|:---|:---|:---|:---|
| **AC-01** | Interfaces use shared backend contracts without duplicating logic. | Satisfied | Verified `@victor/shared` and `@victor/core` API usage across web and mobile. |
| **AC-02** | Phone-first layouts are responsive, accessible, and resilient to network loss. | Implemented | Add network state hook & offline indicator banner to chat. |
| **AC-03** | Text/voice interactions show clear listening, processing, speaking, error, and cancellation states. | Implemented | Verified in `useVoiceInput` and `useVoiceOutput`. |
| **AC-04** | Character states are driven by actual backend/client state and never claim success without evidence. | Implemented | Formalize companion state controller ensuring terminal states match VTE results. |
| **AC-05** | Animation/rendering does not block core conversation or task operation. | Implemented | SVG animations use CSS hardware acceleration; 3D renders asynchronously. |
| **AC-06** | Permissions for microphone, notifications, and device functions are explicit and revocable. | Implemented | Runtime permission request flows implemented in Web hooks and Android managers. |
| **AC-07** | Tap/gesture behavior is discoverable and does not conflict with accessibility or OS gestures. | Implemented | Clean touch targets (>48px) and standard web/Compose gestures. |
| **AC-08** | Realtime updates handle reconnect, stale state, and duplicate events. | Implemented | Handled in conversation pagination and monotonic sequencing. |
| **AC-09** | Performance budgets and fallback behavior are documented for lower-spec devices. | Missing formal fallback component | Build `Wolf3DCompanion` with automatic fallback to 2D `WolfAvatar`. |
| **AC-10** | Tests cover critical flows, accessibility, responsive layouts, permission denial, offline states, and state synchronization. | Missing automated tests | Add automated test suite in `packages/core/test/experience/`. |

---

## 3. Security, Authority & VTE Invariants
1. **No False Success:** The companion must never emote `success` unless the backend VTE execution has succeeded with certified evidence.
2. **Explicit Permissions:** Voice recording must never start without explicit owner activation and clear visual indication (`listening`).
3. **Graceful Fallback:** Low-spec hardware or missing WebGL contexts must seamlessly degrade to the lightweight SVG avatar without crashing.

---

## 4. Conclusion
System 8 is at ~85% implementation. Implementation plan is established to integrate the 3D companion component, offline network banner, companion state controller, and comprehensive test suite.
