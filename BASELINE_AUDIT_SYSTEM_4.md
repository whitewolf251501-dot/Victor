# Baseline Audit — System 4: Planning & Orchestration

**Date:** 2026-11-18  
**Repository:** `https://github.com/whitewolf251501-dot/Victor.git`  
**Branch:** `main`  
**Commit:** HEAD  
**Auditor:** Principal Software Architect & Victor Engineering Lead  

---

## 1. System Mission & Scope
System 4 converts high-level user directives and goals into durable, observable, resumable multi-step execution plans. It coordinates step dependencies (DAG), handles retries, bounds concurrency, respects timeouts, manages crash recovery, emits progress events, and hands off L3 steps to System 6 (VTE) for owner approval without bypassing trust boundaries.

---

## 2. Current Implementation Baseline

### 2.1 Existing Artifacts & Code
1. **Shared Contracts (`packages/shared/src/types/task.ts`):**
   - Minimal definition of `TaskId`, `OperationId`, `TaskState`, `Operation`, `Task`.
   - Lacks dependency modeling (`dependencies: StepId[]`), retry configuration, idempotency tracking per step, DAG structures, and progress event payloads.
2. **Database Schema (`supabase/migrations/20261101000001_victor_foundation.sql`):**
   - Tables `tasks` and `operations` exist with basic RLS and status fields (`planned`, `running`, `completed`, `failed`).
   - Lacks step dependencies, idempotency keys, retry tracking, execution envelopes, and event logs.
3. **Web API (`apps/web/src/app/api/tasks/route.ts`):**
   - A single read-only `GET /api/tasks` endpoint listing raw task rows.
   - No plan creation, validation, execution loop, step progression, resumption, or cancellation APIs.
4. **Core Planning Engine (`packages/core/src/planning/`):**
   - Completely absent. No DAG cycle detector, no retry classifier, no task planner, no workflow orchestrator.

### 2.2 Acceptance Criteria Gap Analysis

| Criterion | Requirement Summary | Current Code Status | Gap / Required Action |
|:---|:---|:---|:---|
| **AC-01** | Tasks and steps have durable IDs, explicit states, timestamps, and owner scope. | Minimal in `types/task.ts` | Formalize `PlanId`, `StepId`, `PlanStep`, `TaskPlan` in `@victor/shared`; add migration for `plan_steps` & `plan_events`. |
| **AC-02** | Plans validate dependencies and reject cycles/invalid transitions. | Missing (0%) | Implement `PlanGraph` with Kahn's algorithm / DFS cycle detection and state machine validation. |
| **AC-03** | Long-running tasks survive process restart and recover safely. | Missing (0%) | Implement persistent plan checkpointing and crash recovery in `WorkflowOrchestrator`. |
| **AC-04** | Retries are bounded, classified, and safe with idempotency keys. | Missing (0%) | Implement `RetryClassifier` with transient error detection, exponential backoff, max retries, and idempotency key propagation. |
| **AC-05** | Approval-required steps pause safely and resume only after a valid approval decision. | Missing (0%) | Integrate with VTE `AuthorityEngine`: L3 steps transition to `waiting_approval` and pause plan until approved. |
| **AC-06** | Cancellation and timeout behavior are defined and tested. | Missing (0%) | Add `cancelPlan` with step abort signal and per-step `timeoutMs` enforcement. |
| **AC-07** | Progress is emitted without falsely marking a step complete before verified results. | Missing (0%) | Implement `PlanProgressEvent` emitter; only emit `step_completed` after VTE verified execution. |
| **AC-08** | Partial failures, compensation, and human handoff are documented. | Missing (0%) | Implement step failure isolation, partial failure state, and compensation action definitions. |
| **AC-09** | Tests cover crash/restart, duplicate queue delivery, race conditions, retries, cancellation, and stuck tasks. | Missing (0%) | Implement comprehensive test suite in `packages/core/test/planning/`. |

---

## 3. Security, Authority & VTE Invariants
1. **Never Bypass VTE:** The orchestrator must never execute tool adapters directly. All step execution must pass through `AuthorityEngine.evaluate()` and `ExecutionLifecycle.execute()`.
2. **Owner-Only Scoping:** Plans, tasks, steps, and progress events must be strictly scoped to `OwnerId`. Cross-tenant plan access or resumption must be blocked.
3. **No False Progress:** Progress percentages and status must reflect verified reality. A step cannot be reported completed until VTE returns verified result certification.

---

## 4. Conclusion
System 4 is currently at ~30% implementation (schema stubs only) and 0% verification. Implementation plan is established to bring System 4 to 100% verified completion.
