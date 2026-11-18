# Implementation Plan: System 1 — Victor Core (Intelligence)

**Target System:** System 1 — Victor Core (Intelligence)  
**Execution Order Sequence:** 3 of 8  
**Prerequisites:** System 6 and System 7 completed and verified  
**Estimated Verification Artifacts:** Unit tests, integration tests, contract tests, completion report, completion ledger update

---

## 1. Objectives & Boundaries

### Mission
Deliver a provider-independent intelligence core that understands requests, normalizes intents, routes models with resilient fallback, and coordinates execution via typed contracts without owning storage, tool execution, or permissions.

### Key Deliverables
1. **Typed Shared Contracts (`@victor/shared`):**
   - `CoreRequest`, `CoreResponse`, `NormalizedIntent`, `CapabilityProposal`, `ModelRoutingConfig`, `ModelRoutingMetrics`.
2. **Provider Adapters & Resilient Router (`@victor/core`):**
   - `openai-compatible.provider.ts`: Second real provider adapter supporting OpenAI / Groq / Local Ollama endpoints.
   - `deterministic-provider.ts`: Deterministic provider adapter for offline/CI environments and testing.
   - `model-router.ts`: Configurable priority router with automatic failover, timeout handling, and latency metrics.
3. **Intent Classification & Request Normalizer (`@victor/core`):**
   - `intent-classifier.ts`: Modular classification engine separating user directives into actions, memory operations, queries, or tactical conversation.
4. **Victor Core Engine (`@victor/core`):**
   - `victor-core.ts`: Orchestrator taking `CoreRequest` + `IdentityContext`, invoking context/planner contracts, dispatching to `ModelRouter`, and emitting policy-gated `CapabilityProposal`s.
5. **Prompt Versioning & Untrusted Data Isolation:**
   - Versioned prompts (`2026.11.1`) with explicit framing (`<user_directive>`, `<retrieved_context>`) preventing prompt injection from overriding system rules.
6. **Chat Route Integration:**
   - Update `apps/web/src/app/api/victor/chat/route.ts` to use `VictorCore` and `ModelRouter`.
7. **Automated Test Suite:**
   - Comprehensive test suite in `packages/core/test/intelligence/` verifying all 9 acceptance criteria.

---

## 2. Sequenced Implementation Phases

### Phase 1: Shared Contracts (`packages/shared/src/types/intelligence.ts`)
- Define `IntentType = 'action' | 'memory_command' | 'query' | 'conversation'`
- Define `NormalizedIntent`, `CapabilityProposal`, `CoreRequest`, `CoreResponse`, `ModelRoutingMetrics`.
- Export from `packages/shared/src/index.ts`.

### Phase 2: Provider Adapters & Model Router (`packages/core/src/model/`)
- Implement `openai-compatible.provider.ts` implementing `ModelProvider`.
- Implement `deterministic-provider.ts` implementing `ModelProvider`.
- Implement `model-router.ts` with primary/fallback routing, timeout races, and latency metrics.

### Phase 3: Intent Classification & Victor Core Facade (`packages/core/src/intelligence/`)
- Implement `intent-classifier.ts`.
- Implement `victor-core.ts` orchestrator.
- Update `personality.ts` with prompt versioning and injection guardrails.

### Phase 4: Integration with Web API Route (`apps/web/src/app/api/victor/chat/route.ts`)
- Refactor chat route to route requests through `VictorCore` and `ModelRouter`.

### Phase 5: Verification & Automated Test Suite (`packages/core/test/intelligence/`)
- `model-router.test.ts`: Primary provider routing, fallback execution, and latency metrics.
- `intent-classifier.test.ts`: Directive parsing, parameter extraction, and boundary handling.
- `prompt-versioning.test.ts`: Prompt injection isolation and versioning.
- `victor-core.test.ts`: End-to-end request normalization, typed response generation, and capability proposal emission.

### Phase 6: Review, Report & Handover
- Execute all checks (`npm test`, `npm run type-check`, `npm run build`, `npm run lint`).
- Generate `SYSTEM_COMPLETION_REPORT_SYSTEM_1.md`.
- Update `COMPLETION_LEDGER.md`.
