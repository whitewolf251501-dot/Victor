# System 5 — Capability & Tool Fabric

## Mission
Make Victor extensible through a discoverable, versioned capability ecosystem with validated schemas and normalized results.

## Scope
- Capability registry and lifecycle.
- Capability descriptors, schemas, versions, scopes, risk metadata, and health.
- Discovery, selection, routing, and adapter interface.
- Cloud and local execution target abstraction.
- Input/output validation and result normalization.
- Timeout, retry metadata, idempotency, and capability observability.
- Initial integrations that are already present or explicitly approved.

## Explicit non-scope
- Final authorization/approval (System 6).
- Reasoning and intent (System 1).
- Workflow state ownership (System 4).
- Device pairing/authentication (System 7).

## Dependencies
Systems 1, 4, 6, and 7 contracts.

## Acceptance criteria
- [ ] Capabilities register with stable IDs and explicit versions.
- [ ] Every capability declares validated input/output schemas, scopes, risk, target, timeout, and idempotency behavior.
- [ ] Discovery filters by availability, permissions metadata, and compatibility.
- [ ] Invocation always passes through System 6; no direct executor bypass exists.
- [ ] Adapters normalize success, failure, timeout, denial, and partial results.
- [ ] A dispatched/queued response is never represented as completed success.
- [ ] Capability health and version incompatibility are observable.
- [ ] A sample capability can be added through registration/adapter conventions without editing core reasoning logic.
- [ ] Tests cover malformed schemas, unavailable adapters, version mismatch, timeout, duplicate invocation, malicious outputs, and authorization integration.

## Key risks
Tool sprawl; unsafe dynamic loading; capability spoofing; false success; privilege escalation through adapters.

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
