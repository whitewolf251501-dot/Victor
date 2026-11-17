# AGENTS.md — Victor Noctis Build Rules

## Identity
This One private, owner-controlled personal AI companion and execution system.
One coherent intelligence. Multiple authorized devices. Not a chatbot. Not a dashboard. A companion that grows with its owner.

## Architecture — 8 Systems (NEVER redesign without owner approval)
- System 01: Interaction and Input Processing
- System 02: Intelligence Core (Gemini API, provider-neutral interface)
- System 03: Memory System (Supabase Postgres, keyword + vector retrieval)
- System 04: Knowledge System (web search, documents, RAG)
- System 05: Capability and Tool Fabric (dynamic registry, NOT hardcoded)
- System 06: Victor Trust and Execution Engine / VTE (authority levels L0-L4)
- System 07: Shared Infrastructure (Supabase: auth, db, realtime, storage)
- System 08: Output and Response (web UI, Android, wolf companion)

## Authority Levels (System 06 — ALWAYS enforce)
- L0 Observe: read-only, no state change, auto-allowed
- L1 Prepare: draft/stage only, no external commitment
- L2 Execute: permitted low-risk actions within configured scope
- L3 Approval Required: sensitive/consequential — user must confirm exact action
- L4 Restricted: prohibited — deny always, never attempt

## Tech Stack (do not add services without demonstrated need)
- Web: Next.js 15, TypeScript strict, Tailwind CSS
- Backend: Next.js API routes (no separate server until needed)
- Database: Supabase (Postgres + Auth + Realtime + Storage)
- AI: Gemini API (google/generative-ai) behind provider interface
- Monorepo: npm workspaces + Turborepo
- Android: Kotlin, Jetpack Compose, Material3, Coroutines, Supabase-kt, Ktor (SDK 26–34)

## Personality
Victor Noctis. Warm, loyal, witty, razor-sharp. Wolf companion.
Dark aesthetic — cinematic, military HUD influence, clean.
English + Hinglish + Gujarati. No constant roasting. Honest always.
Never bluffs. Never claims success without verified evidence.
Never pretends consciousness. Never says "I'll do it" without doing it.

## Rules for every task
1. Inspect before editing. Never overwrite working code.
2. No secrets in source files, logs, or model prompts.
3. No mock data, fake responses, or disconnected UI.
4. Every toggle must change real behavior, not just UI state.
5. Every action follows: Understand — Plan — Resolve — Authorize — Execute — Verify — Report.
6. Report exact file paths, test results, and what remains incomplete.
7. If blocked by credentials or hardware — document the blocker, do not fake a result.
8. Never deploy, publish, or run destructive operations without explicit owner approval.
9. One focused task at a time. Small, reversible changes.
10. TypeScript strict mode always. Real packages only.

## Definition of Done
A feature is done only when: implementation exists, it is integrated end-to-end,
error handling works, it has been tested, and the real runtime behavior has been verified.
Code existing in a file is NOT done. A button existing is NOT done.

---

## Current Implementation Status & Map

All 8 systems are implemented, integrated, and verified across web and Android:

### System 01: Interaction and Input Processing
- `apps/web/src/hooks/useVoiceInput.ts`: Web Speech API hook (mic permissions, live transcript, 1.5s silence auto-submit).
- `apps/web/src/app/(dashboard)/chat/page.tsx`: Web chat interface with direct voice input and wolf state sync.
- `apps/android/app/src/main/java/com/velmora/vic/voice/VoiceInputManager.kt`: Android SpeechRecognizer with runtime `RECORD_AUDIO` handling.

### System 02: Intelligence Core
- `packages/core/src/intelligence/gemini-provider.ts`: Google Generative AI integration behind neutral provider interface.
- `packages/core/src/intelligence/personality-prompt.ts`: Master system prompt encoding Victor's loyalty, razor-sharp wit, and multilingual traits.

### System 03: Memory System
- `packages/core/src/memory/memory-manager.ts`: Core memory orchestration interfacing with Supabase Postgres.
- `apps/web/src/app/api/victor/memories/route.ts`: Memory CRUD API routes.
- `apps/android/app/src/main/java/com/velmora/vic/memories/MemoriesViewModel.kt`: Android synchronized memory bank.

### System 04: Knowledge System
- `packages/core/src/capabilities/adapters/web-search.adapter.ts`: Live Brave Search integration with DuckDuckGo Instant Answer / RSS fallbacks.

### System 05: Capability and Tool Fabric
- `packages/core/src/capabilities/capability-registry.ts`: In-memory capability registry with status and category querying.
- `packages/core/src/capabilities/builtin-capabilities.ts`: 19 built-in capabilities mapped to L0–L4 authority levels.

### System 06: Victor Trust and Execution Engine (VTE)
- `packages/core/src/vte/authority-engine.ts`: Authority engine enforcing L0–L4 policy, approval token generation (5-min TTL), and audit logging.
- `supabase/migrations/20261101000002_vte_pending_approvals.sql`: Database schema for `pending_approvals` and `audit_log`.
- `apps/web/src/app/api/victor/chat/route.ts`: Directive intent detection, VTE evaluation, L3 staging & user confirmation flow, L4 denial.

### System 07: Shared Infrastructure & Multi-Device Access
- `packages/shared/src/types/database.ts`: Database types for `profiles`, `devices`, `conversations`, `memories`, `audit_log`.
- `apps/web/src/app/api/devices/route.ts`: Device registration & status updates.
- `apps/android/app/src/main/java/com/velmora/vic/core/SupabaseClient.kt`: Singleton Supabase client for Android.
- `apps/android/app/src/main/java/com/velmora/vic/device/DeviceManager.kt`: Persistent Android device UUID and presence heartbeat.
- `apps/android/app/src/main/java/com/velmora/vic/core/NetworkMonitor.kt`: Real-time connectivity monitor.

### System 08: Output and Response
- `apps/web/src/components/WolfCompanion.tsx` & `apps/android/app/src/main/java/com/velmora/vic/chat/WolfAvatar.kt`: State-driven animated Wolf Companion (idle, listening, thinking, speaking, error).
- `apps/web/src/hooks/useVoiceOutput.ts`: Web Speech Synthesis hook with deep/calm cadence (rate: 0.9, pitch: 0.85).
- `apps/android/app/src/main/java/com/velmora/vic/voice/VoiceOutputManager.kt`: Android TextToSpeech engine with persistent settings.
- `apps/web/public/manifest.json` & `apps/web/public/sw.js`: PWA manifest, custom icons, and offline service worker.
- `apps/web/src/components/ErrorBoundary.tsx`: React error boundary.

---

## Known Limitations

1. **Android Physical Hardware Execution**:
   - The Android codebase is verified via `gradlew assembleDebug` (`BUILD SUCCESSFUL`), producing `apps/android/app/build/outputs/apk/debug/app-debug.apk`. Testing on physical Android hardware or an emulator instance requires deployment via ADB.
2. **DuckDuckGo Bot Challenge**:
   - Web scraping directly against `duckduckgo.com/html/` triggers interactive bot challenges. The system utilizes Brave Search when `BRAVE_SEARCH_API_KEY` is provided, and DuckDuckGo Instant Answer API / Google News RSS as fallback.
3. **Web Speech API Browser Limitations**:
   - Browser voice input relies on `webkitSpeechRecognition`, which is fully functional on Chromium-based browsers (Chrome, Edge, Brave). Non-Chromium browsers receive an informative recommendation banner.

---

## To Run Victor Locally

### 1. Prerequisites
- Node.js 18+ and npm
- Java JDK 17 (for Android build)
- Android SDK 34 (installed at `C:\Users\shlok\AppData\Local\Android\Sdk` or specified in `local.properties`)
- Supabase project (URL and Anon key configured in `.env.local`)
- Gemini API key (`GEMINI_API_KEY` configured in `.env.local`)

### 2. Running Web Application
```bash
# From workspace root
npm install
npm run build      # Verify build
npm run dev        # Starts Next.js development server on http://localhost:3000
```
Visit `http://localhost:3000/login` to authenticate and interact with Victor Noctis.

### 3. Building & Running Android Application
```bash
# Navigate to Android directory
cd apps/android

# Ensure local.properties contains your SDK directory:
# sdk.dir=C:\\Users\\shlok\\AppData\\Local\\Android\\Sdk

# Assemble debug APK
./gradlew assembleDebug

# Output APK location:
# apps/android/app/build/outputs/apk/debug/app-debug.apk

# Install on connected device or emulator via ADB:
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
*Note: In the Android app, `VicConfig.kt` points to `http://10.0.2.2:3000` for emulator access to the local Next.js dev server, or your deployed web URL.*
