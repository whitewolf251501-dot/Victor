# Implementation Plan — System 4: Planning & Orchestration

**Date:** 2026-11-18  
**System:** System 4 — Planning & Orchestration  
**Status:** In Progress  

---

## 1. Objectives & Deliverables
1. **Shared Types (`packages/shared/src/types/plan.ts`):**
   - Formalize `PlanId`, `StepId`, `PlanStepState`, `PlanState`, `PlanStep`, `TaskPlan`, `PlanProgressEvent`, `RetryPolicy`, `RetryClassification`.
   - Re-export in `packages/shared/src/types/index.ts` and build `@victor/shared`.
2. **Database Migration (`supabase/migrations/20261101000007_planning_orchestration_hardening.sql`):**
   - Create `plans`, `plan_steps`, and `plan_events` with RLS, foreign keys cascading to tasks, indexes on `(owner_id, state)` and `(task_id)`.
3. **Core Planning Modules (`packages/core/src/planning/`):**
   - `plan-graph.ts`: Directed Acyclic Graph (DAG) validation, Kahn's algorithm for topological sorting and cycle detection, ready-step resolution, and step state transition enforcement.
   - `retry-classifier.ts`: Error classification (transient vs permanent), exponential backoff calculation with jitter, max retry bounding, and idempotency key consistency.
   - `task-planner.ts`: Plan generation, capability validation against `CapabilityRegistry`, and step parameter sanitization.
   - `workflow-orchestrator.ts`: Multi-step execution coordination, VTE integration, step timeout handling, cancellation signal propagation, L3 approval pause/resume handling, progress event emission, and crash recovery.
4. **API Integration (`apps/web/src/app/api/plans/route.ts`):**
   - Secure REST API routes for creating, listing, cancelling, and resuming plans with owner validation.
5. **Comprehensive Test Suite (`packages/core/test/planning/`):**
   - `plan-graph.test.ts`: Cycle detection, topological sort, missing dependency detection, state transitions.
   - `retry-classifier.test.ts`: Transient vs permanent classification, retry bounds, backoff calculation.
   - `workflow-orchestrator.test.ts`: End-to-end plan execution, DAG dependency sequencing, L3 approval pause/resume, cancellation, step timeout, crash recovery, and progress event emission.
6. **Documentation & Ledger:**
   - Generate `SYSTEM_COMPLETION_REPORT_SYSTEM_4.md` and update `COMPLETION_LEDGER.md`.

---

## 2. Sequenced Execution Steps

### Step 1: Types & Shared Contracts
- Add `packages/shared/src/types/plan.ts`.
- Export from `packages/shared/src/index.ts`.
- Compile `@victor/shared`.

### Step 2: Database Schema Hardening
- Create `supabase/migrations/20261101000007_planning_orchestration_hardening.sql`.

### Step 3: Core Planning Graph & Cycle Detection
- Implement `PlanGraph` in `packages/core/src/planning/plan-graph.ts`.
- Add test `packages/core/test/planning/plan-graph.test.ts`.

### Step 4: Retry Classifier & Resilience
- Implement `RetryClassifier` in `packages/core/src/planning/retry-classifier.ts`.
- Add test `packages/core/test/planning/retry-classifier.test.ts`.

### Step 5: Task Planner & Workflow Orchestrator
- Implement `TaskPlanner` in `packages/core/src/planning/task-planner.ts`.
- Implement `WorkflowOrchestrator` in `packages/core/src/planning/workflow-orchestrator.ts`.
- Add test `packages/core/test/planning/workflow-orchestrator.test.ts`.

### Step 6: Integration Verification & Monorepo Validation
- Run full test suite (`npm test`), lint, type checks, and Android build.
- Review diff and ensure zero regressions.

### Step 7: Completion Report & Ledger Update
- Write `SYSTEM_COMPLETION_REPORT_SYSTEM_4.md`.
- Mark System 4 Accepted 100% in `COMPLETION_LEDGER.md`.
