# System 1 — Victor Core — Intelligence

## Mission
Deliver a provider-independent intelligence core that understands requests, reasons, routes models, and coordinates the other systems without owning their responsibilities.

## Scope
- Request normalization and intent understanding.
- Model-provider abstraction and model routing.
- Reasoning/task coordination interfaces.
- Response generation and structured outputs.
- Core state boundaries, timeouts, cancellation, and fallback behavior.
- Policy-aware invocation of context, planner, and capability interfaces.

## Explicit non-scope
- Persistent memory storage and lifecycle (System 2).
- Conversation/session source of truth (System 3).
- Workflow persistence and scheduling (System 4).
- Capability implementation/dispatch (System 5).
- Authorization decisions and execution dispatch (System 6).
- Client UI or character rendering (System 8).

## Dependencies
Systems 3, 4, 5, 6, and 7 contracts; model provider credentials for live provider tests.

## Acceptance criteria
- [ ] A request can enter through a documented interface and produce a typed response.
- [ ] At least two model providers can be supported through adapters if credentials/services are available; otherwise adapter contract and deterministic test doubles are supplied and limitation is explicit.
- [ ] Model routing is configurable and observable; no provider-specific logic leaks across the core.
- [ ] Core can request context and planning through contracts without direct database access.
- [ ] Structured tool/capability proposals are emitted but cannot bypass System 6 authorization.
- [ ] Timeout, provider failure, malformed output, cancellation, and fallback paths are tested.
- [ ] Prompt and model configuration are versioned and protected from untrusted content.
- [ ] No secrets or hidden chain-of-thought are logged or exposed; provide concise rationale/decision metadata instead.
- [ ] Unit, integration, and contract tests pass; latency/error metrics are documented.

## Key risks
Over-centralizing business logic; provider lock-in; treating model output as trusted commands; leaking private context; unbounded latency/cost.

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
