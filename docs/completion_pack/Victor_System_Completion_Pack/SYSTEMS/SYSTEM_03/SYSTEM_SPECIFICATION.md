# System 3 — Context & Conversation

## Mission
Maintain coherent conversations and task continuity across sessions and authorized devices, assembling only relevant and permission-appropriate context.

## Scope
- Conversation and message lifecycle.
- Session state and active task references.
- Context assembly from conversation, memory, device, and task sources.
- Relevance ranking and context-window budgeting.
- Cross-device continuity and synchronization contracts.
- Conversation history pagination, retention, and safe summaries.

## Explicit non-scope
- Canonical memory extraction/storage (System 2).
- Core reasoning/model routing (System 1).
- Workflow execution (System 4).
- Device authentication/pairing (System 7).

## Dependencies
Systems 2, 7, 1, and 4 contracts.

## Acceptance criteria
- [ ] Conversations and messages persist with owner isolation and stable IDs.
- [ ] Context assembly is bounded, deterministic where possible, and includes provenance/time metadata.
- [ ] Only authorized, relevant memories and device context enter the model context.
- [ ] A task/conversation can be resumed on another authorized device without duplicating or corrupting state.
- [ ] Concurrent messages and updates have defined ordering/conflict behavior.
- [ ] Summaries preserve important decisions and open tasks without inventing facts.
- [ ] Deletion/retention rules propagate to derived summaries and indexes as required.
- [ ] Tests cover pagination, concurrent sessions, stale clients, missing memory, context overflow, and owner isolation.

## Key risks
Context leakage; stale or contradictory summaries; race conditions; unbounded prompt growth.

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
