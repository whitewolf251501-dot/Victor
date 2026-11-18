# System 6 — Trust & Execution Engine

## Mission
Act as the mandatory security and execution authority for every action Victor attempts, ensuring only authenticated, authorized, policy-compliant operations are dispatched and accurately verified.

## Scope
- Actor, owner, device, session, and token validation at execution boundary.
- Capability permission and scope evaluation.
- Risk classification and policy decisions.
- Approval creation, binding, expiry, and consumption.
- Execution request lifecycle and state machine.
- Idempotency, replay protection, dispatch authorization, and cancellation.
- Audit logging and reliable event publication.
- Result verification and false-success prevention.
- Cloud worker/local-agent trust boundaries.

## Explicit non-scope
- Model reasoning and intent (System 1).
- Capability discovery and adapter implementation (System 5).
- UI presentation of approval prompts (System 8).
- Device registration authority (System 7), though it consumes verified device trust.

## Dependencies
Systems 5, 7, and 4 contracts; trusted auth/device identity; durable database/event mechanism.

## Acceptance criteria
- [ ] Every action path, including internal/background/local-agent paths, is proven to pass through the engine.
- [ ] The engine derives actor identity from trusted authentication context, never from untrusted request fields.
- [ ] Owner/device/session authorization is enforced server-side and negative tests prove isolation.
- [ ] Permissions use least privilege and are checked at execution time, not only at UI/planning time.
- [ ] Risk policy distinguishes read-only, reversible, consequential, sensitive, and irreversible actions with configurable rules.
- [ ] Approvals are bound to the exact actor, device/session, capability/version, normalized input or input hash, and expiry; they cannot be reused for altered payloads.
- [ ] Execution has explicit states such as requested, denied, approval_required, authorized, queued, running, succeeded, failed, cancelled, and timed_out; transitions are validated.
- [ ] Idempotency and replay controls prevent duplicate side effects under retries or duplicate delivery.
- [ ] Audit records are durable, owner-scoped, tamper-resistant to the extent supported, and do not leak secrets.
- [ ] Dispatch and completion are separate; success requires capability-specific evidence or documented verification level.
- [ ] Local agents authenticate messages and cannot elevate scopes or impersonate another device.
- [ ] Revoked devices, expired tokens, forged owner IDs, prompt injection, malicious tool output, duplicate requests, and race conditions are tested.
- [ ] Recovery, cancellation, timeout, and partial failure behavior are tested.
- [ ] No critical/high security defects remain; threat model and residual risks are documented.

## Key risks
Authorization bypass; confused deputy; approval replay; duplicate irreversible action; audit gaps; false success; local-agent compromise.

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
