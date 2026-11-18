# System 4 — Planning & Orchestration

## Mission
Turn user goals into durable, observable, resumable plans and coordinate steps while leaving authorization to System 6.

## Scope
- Task model and lifecycle.
- Plan/step decomposition and dependency graph.
- Workflow execution coordination.
- Background scheduling and durable queue integration.
- Retries, timeouts, cancellation, compensation, and recovery.
- Progress events and human approval wait states.
- Task result aggregation and handoff.

## Explicit non-scope
- Final authorization and approval policy (System 6).
- Tool adapter implementation (System 5).
- Core reasoning/model selection (System 1).
- Conversation source of truth (System 3).

## Dependencies
Systems 1, 3, 5, 6, and 7 contracts; durable job infrastructure.

## Acceptance criteria
- [ ] Tasks and steps have durable IDs, explicit states, timestamps, and owner scope.
- [ ] Plans validate dependencies and reject cycles/invalid transitions.
- [ ] Long-running tasks survive process restart and recover safely.
- [ ] Retries are bounded, classified, and safe with idempotency keys.
- [ ] Approval-required steps pause safely and resume only after a valid approval decision.
- [ ] Cancellation and timeout behavior are defined and tested.
- [ ] Progress is emitted without falsely marking a step complete before verified results.
- [ ] Partial failures, compensation, and human handoff are documented.
- [ ] Tests cover crash/restart, duplicate queue delivery, race conditions, retries, cancellation, and stuck tasks.

## Key risks
Duplicate side effects; lost tasks; infinite retries; planner bypassing authorization; inaccurate progress.

## Required implementation deliverables
- Baseline audit of current implementation, tests, migrations, and integration points.
- Architecture and data-flow diagram reflecting the actual repository.
- Requirement-to-code-to-test traceability matrix.
- Implementation plan with dependency order and risk notes.
- Production-quality implementation consistent with repository conventions.
- Unit, integration, security, contract, and end-to-end tests appropriate to this system.
- Updated documentation, environment template, and migrations if applicable.
- `SYSTEM_COMPLETION_REPORT.md` with evidence and remaining limitations.

## Completion rule
This system is 100% only when every applicable acceptance criterion is implemented and verified, all global Definition of Done requirements are satisfied, and the owner/reviewer accepts the evidence. If an external credential, device, service, or environment is unavailable, clearly distinguish code-complete from integration-verified and do not claim full acceptance.
