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
- Android: Kotlin (Phase 7 — do not touch until Phase 6 is verified)

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
