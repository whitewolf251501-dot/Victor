# System 3: Context & Conversation — Implementation Plan

**System Under Execution:** System 3: Context & Conversation  
**Target Completion:** 100% Production-Ready & Verified  
**Date:** 2026-11-18  

---

## 1. Objectives & Architectural Invariants

1. **Owner-Only Isolation:** Conversations, messages, and derived summaries are strictly scoped to `owner_id` with server-side RLS and query constraints.
2. **Deterministic Sequence Ordering:** Messages have strict sequence numbering ensuring consistent ordering under concurrent turns across devices.
3. **Strict Context Budgeting:** `ContextAssembler` enforces strict character/token limits across slots (system prompt, verified memories, conversation summaries, rolling recent messages) to prevent context overflow.
4. **Safe Summarization:** Summaries preserve verified decisions, active goals, and open loops without fabricating facts or hallucinating state.
5. **Cross-Device Seamless Continuity:** Validates device handovers and active conversation resumption across authorized devices without duplicated messages or corrupted context.
6. **Cascading Deletion:** Deleting a conversation immediately purges all messages, summaries, and associated caches.

---

## 2. Sequenced Implementation Phases

### Phase 1: Shared Contracts & Database Migration
1. **Shared Types (`packages/shared/src/types/conversation.ts`)**:
   - Add `ConversationSummary`, `ContextBudget`, `AssembledContext`, `PaginatedMessages`.
   - Update `Message` with `sequenceNumber: number`.
   - Recompile `@victor/shared`.
2. **Database Migration (`supabase/migrations/20261101000006_conversation_context_hardening.sql`)**:
   - Add `sequence_number` to `messages`.
   - Create `conversation_summaries` table with RLS and foreign key cascade to `conversations`.

### Phase 2: Context Assembler & Budgeting
1. **Context Assembler (`packages/core/src/conversation/context-assembler.ts`)**:
   - Allocate token/char budgets across system prompt, memories, summary, and recent messages.
   - Priority allocation: system prompt > recent turn > memories > safe summary > older messages.
   - Strict bounded output generation.

### Phase 3: Safe Summarization Engine
1. **Conversation Summarizer (`packages/core/src/conversation/conversation-summarizer.ts`)**:
   - Extract key decisions, committed actions, and open questions from message turns.
   - Deterministic structuring of summaries with message range boundaries.

### Phase 4: Conversation Manager & Web API
1. **Conversation Manager (`packages/core/src/conversation/conversation-manager.ts`)**:
   - Class-based manager handling conversation CRUD, monotonic sequence assignment, pagination, summary storage, and cross-device continuity validation.
2. **Web API Updates (`apps/web/src/app/api/victor/conversations/[id]/route.ts`)**:
   - Add `DELETE` method for conversation removal.
   - Add cursor pagination (`?limit=20&before=...`).

### Phase 5: Verification & Handover
1. Build test suites in `packages/core/test/conversation/`:
   - `context-assembler.test.ts`
   - `conversation-summarizer.test.ts`
   - `conversation-manager.test.ts`
2. Run full monorepo verification (`npm test`, `npm run type-check`, `npm run build`, `npm run lint`).
3. Generate `SYSTEM_COMPLETION_REPORT_SYSTEM_3.md` and update `COMPLETION_LEDGER.md`.
