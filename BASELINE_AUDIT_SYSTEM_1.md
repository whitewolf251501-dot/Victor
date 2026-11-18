# Baseline Audit: System 1 — Victor Core (Intelligence)

**Date:** 2026-11-18  
**Repository:** `https://github.com/whitewolf251501-dot/Victor.git`  
**Branch:** `main`  
**Base Commit:** `a643b42 feat: complete end-to-end implementation for all 8 systems (Web, Android, VTE, Memory)`  
**Working Tree:** Clean with System 6 and System 7 verified implementations  

---

## 1. Executive Summary

System 1 (Victor Core — Intelligence) is the central reasoning, intent classification, model routing, and coordination brain of Victor Noctis. It owns request normalization, model provider abstraction, structured capability proposals, and coordinated response generation without usurping persistent storage (System 2/3), tool execution (System 5), or authorization (System 6).

An initial foundation exists:
- `packages/core/src/model/provider.interface.ts` defining `ModelProvider` (`generateResponse`, `streamResponse`, `isAvailable`, `getModelName`)
- `packages/core/src/model/gemini.provider.ts` integrating Google Generative AI behind the provider interface with API key redaction
- `packages/core/src/personality.ts` with Victor Noctis's personality prompt and multi-language rules (English, Hinglish, Gujarati)

However, auditing against `SYSTEM_SPECIFICATION.md` identifies critical gaps:
1. **Single Model Provider:** Only `GeminiProvider` exists. Acceptance Criterion 2 requires at least two model provider adapters behind the neutral interface (e.g. Gemini + OpenAI/Anthropic/Local LLM provider) with automated fallback.
2. **Missing Model Router:** There is no `ModelRouter` abstraction. The web chat route directly constructs `new GeminiProvider()` with no fallback, timeout escalation, or configurable routing.
3. **Missing Intelligence Core Facade:** There is no unified `IntelligenceCore` or `VictorCore` engine that normalizes input requests, classifies intents, queries context contracts, and produces typed structured outputs.
4. **Hardcoded Intent Parsing in Web Route:** Regex-based directive intent matching lives directly inside Next.js API route `apps/web/src/app/api/victor/chat/route.ts` instead of being an encapsulated, testable core component.
5. **No Structured Capability Proposals:** The model does not emit typed, policy-ready capability execution envelopes ready for VTE authorization.
6. **No Observability / Latency Metrics:** No structured telemetry recording latency, token budgets, selected provider, or fallback invocation.
7. **Zero Automated Tests:** System 1 currently has 0 automated tests in the repository.

---

## 2. Requirement-to-Implementation Gap Matrix

| Acceptance Criterion | Existing Implementation | Identified Gaps | Severity | Baseline Status |
|---|---|---|---|---|
| **AC-01: Documented Interface & Typed Response** | `provider.interface.ts` only has raw string responses. | Missing `CoreRequest`, `CoreResponse`, `NormalizedIntent`, and `CapabilityProposal` types. | HIGH | Partial (40%) |
| **AC-02: Multi-Provider Support & Adapters** | `GeminiProvider` only. | Missing second provider adapter (`OpenAICompatibleProvider` / `DeterministicModelProvider`) for fallback. | HIGH | Partial (50%) |
| **AC-03: Configurable Model Routing & Observability** | None. Direct invocation of Gemini in chat route. | Missing `ModelRouter` with priority routing, failover, latency tracking, and provider neutrality. | HIGH | Missing (0%) |
| **AC-04: Contract-Based Context & Planning** | Memory/Conversation called directly in chat route. | Core should invoke context and task planning interfaces via typed contracts without direct database queries. | MEDIUM | Partial (50%) |
| **AC-05: Structured Tool/Capability Proposals** | Regex in chat route detects actions. | Formal `IntentClassifier` and `ProposalEmitter` emitting typed capability proposals passing into System 6. | HIGH | Partial (35%) |
| **AC-06: Timeout, Fallback & Failure Resilience** | Gemini error sanitization. | Missing timeout races, automatic secondary provider fallback, and malformed output recovery. | HIGH | Missing (20%) |
| **AC-07: Versioned Prompts & Untrusted Isolation** | `personality.ts` with master prompt. | Prompts lack semantic versioning; user input and retrieved docs need clear untrusted tagging to prevent prompt injection. | MEDIUM | Partial (60%) |
| **AC-08: Secret & Chain-of-Thought Protection** | Regex API key scrubbing in Gemini errors. | Redaction must be universal across provider outputs; no internal secret or CoT leakage. | MEDIUM | Partial (70%) |
| **AC-09: Unit, Integration & Latency Test Suite** | None. | Zero automated tests for model providers, routing, fallback, intent classification, or prompt building. | CRITICAL | Missing (0%) |

---

## 3. Toolchain & Test Baseline

- **Node.js:** `v24.15.0`
- **TypeScript:** Strict mode enabled across monorepo
- **Current Tests:** 53 tests passing across System 6 and System 7 (0 failures)
- **Turborepo:** `build`, `test`, `type-check`, `lint` all passing with 0 errors

---

## 4. Remediation Plan

1. **Shared Types (`packages/shared/src/types/intelligence.ts`):**
   - Define `CoreRequest`, `CoreResponse`, `NormalizedIntent`, `CapabilityProposal`, `ModelRoutingConfig`, `ModelRoutingMetrics`.
2. **Multi-Provider & Router (`packages/core/src/intelligence/`):**
   - `model-router.ts`: Manages primary and fallback providers, checks availability, routes requests, handles timeouts, and tracks latency/fallback metrics.
   - `openai-compatible.provider.ts`: Second production-grade provider adapter supporting OpenAI, Groq, Anthropic-proxy, or Local LLMs (Ollama/vLLM) via standard endpoint/API key interface.
   - `deterministic-provider.ts`: Deterministic provider adapter for offline/CI environments and testing.
3. **Intent Understanding & Request Normalization:**
   - `intent-classifier.ts`: Normalizes user text, detects directives (`action`, `memory_command`, `chat`, `query`), and extracts structured parameters.
4. **Victor Core Engine (`packages/core/src/intelligence/victor-core.ts`):**
   - Coordinates intent classification, prompt construction, model routing, fallback execution, and structured proposal generation.
   - Guarantees all action proposals are routed into System 6 (VTE) for authorization.
5. **Prompt Hardening:**
   - Add prompt versioning (`PROMPT_VERSION = '2026.11.1'`) and untrusted input framing.
6. **Integration with `/api/victor/chat`:**
   - Connect `VictorCore` to the Next.js API chat route.
7. **Automated Test Suite:**
   - Comprehensive test suite in `packages/core/test/intelligence/` covering all 9 acceptance criteria.
